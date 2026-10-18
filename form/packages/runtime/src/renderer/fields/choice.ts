/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 选择类字段：下拉、组合框、树选择、级联、单选组、多选组、按钮组、列表、穿梭框、勾选框、开关。
// 都只建宿主元素，部件由元素按标准结构生成；有选项的写成元素的 collection。
// 选项来自上下文的 options：静态选项或加载结果。

import type { OptionItem } from '../../state/options'
import type { FieldRenderer, FieldRendererContext } from '../types'
import type { ContextRef } from './shared'
import { assign, host, stringOf } from '../dom'
import { fromList, on, paintCommon, toList } from './shared'

function itemsOf(context: FieldRendererContext): readonly OptionItem[] {
  return context.options?.items ?? []
}

function collectionOf(items: readonly OptionItem[]): { value: string, label: string, disabled?: boolean }[] {
  return items.map(item => ({ value: item.value, label: item.label, ...(item.disabled === true ? { disabled: true } : {}) }))
}

/** 下拉：`xh-select`，多选标签、空态、在途与取数失败的提示和重试钮由元素按标准结构生成；重试交给 reloadOptions。 */
export const selectField: FieldRenderer = (context) => {
  const element = host(context.document, 'xh-select')
  const multiple = context.node.data.multiple === true
  if (multiple)
    assign(element, 'multiple', true)
  const syncCollection = collectionSync(element)
  const ref: ContextRef = { current: context }
  on<{ value: string[] }>(element, 'value-change', detail => ref.current.setValue(fromList(detail.value, multiple)))
  element.addEventListener('retry', () => ref.current.reloadOptions?.())
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next, { placeholder: true })
    assign(element, 'empty', next.translations.optionsEmpty)
    assign(element, 'loading', next.options?.status === 'loading' ? true : undefined)
    assign(element, 'error', next.options?.status === 'error' ? true : undefined)
    syncCollection(itemsOf(next))
    assign(element, 'value', toList(next.value))
  }
  update(context)
  return { element, update }
}

function groupField(tag: 'xh-radio-group' | 'xh-checkbox-group', toUi: (value: unknown) => unknown, fromUi: (value: unknown) => string | string[] | null): FieldRenderer {
  return (context) => {
    const element = host(context.document, tag)
    assign(element, 'orientation', stringOf(context.node.appearance.orientation))
    const syncCollection = collectionSync(element)
    const ref: ContextRef = { current: context }
    on<{ value: unknown }>(element, 'value-change', detail => ref.current.setValue(fromUi(detail.value)))
    const update = (next: FieldRendererContext): void => {
      ref.current = next
      paintCommon(element, next)
      syncCollection(itemsOf(next))
      assign(element, 'value', toUi(next.value))
    }
    update(context)
    return { element, update }
  }
}

/** 单选组：`xh-radio-group`，UI 的 `null` 即未选。 */
export const radioGroupField: FieldRenderer = groupField(
  'xh-radio-group',
  value => (typeof value === 'string' ? value : null),
  value => (typeof value === 'string' ? value : null),
)

/** 多选组：`xh-checkbox-group`。 */
export const checkboxGroupField: FieldRenderer = groupField(
  'xh-checkbox-group',
  value => toList(value),
  value => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []),
)

/** 选项换了才重写元素的 collection。 */
function collectionSync(element: HTMLElement): (items: readonly OptionItem[]) => void {
  let last: readonly OptionItem[] | undefined
  return (items) => {
    if (items === last)
      return
    last = items
    assign(element, 'collection', collectionOf(items))
  }
}

/** 组合框：`xh-combobox`，输入串筛选候选：有选项来源时交给 searchOptions 由宿主筛，静态选项按文字包含筛。 */
export const comboboxField: FieldRenderer = (context) => {
  const element = host(context.document, 'xh-combobox')
  const multiple = context.node.data.multiple === true
  if (multiple)
    assign(element, 'multiple', true)
  const ref: ContextRef = { current: context }
  let query = ''
  let last: readonly OptionItem[] | undefined
  const show = (items: readonly OptionItem[]): void => {
    const keyword = query.trim().toLocaleLowerCase()
    const matched = ref.current.searchOptions !== undefined || keyword === ''
      ? items
      : items.filter(item => item.label.toLocaleLowerCase().includes(keyword))
    assign(element, 'collection', collectionOf(matched))
  }
  on<{ value: string[] }>(element, 'value-change', detail => ref.current.setValue(fromList(detail.value, multiple)))
  on<{ inputValue: string }>(element, 'input-value-change', (detail) => {
    query = detail.inputValue
    if (ref.current.searchOptions !== undefined)
      ref.current.searchOptions(query)
    else
      show(itemsOf(ref.current))
  })
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next, { placeholder: true })
    assign(element, 'empty', next.translations.optionsEmpty)
    assign(element, 'loading', next.options?.status === 'loading' ? true : undefined)
    const items = itemsOf(next)
    if (items !== last) {
      last = items
      show(items)
    }
    assign(element, 'value', toList(next.value))
  }
  update(context)
  return { element, update }
}

interface TreeNodeData {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean
  readonly children?: TreeNodeData[]
  readonly hasChildren?: boolean
}

/** 选项树写成 xh-tree-select 的节点：值、文字、禁用、子项，以及等懒加载的 hasChildren。 */
function treeOf(items: readonly OptionItem[]): TreeNodeData[] {
  return items.map(item => ({
    value: item.value,
    label: item.label,
    ...(item.disabled === true ? { disabled: true } : {}),
    ...(item.children === undefined ? {} : { children: treeOf(item.children) }),
    ...(item.hasChildren === true ? { hasChildren: true } : {}),
  }))
}

/** 树选择：`xh-tree-select`，选项树是 collection；带 hasChildren 的节点首次展开时经 loadChildren 向宿主要它的子项。 */
export const treeSelectField: FieldRenderer = (context) => {
  const element = host(context.document, 'xh-tree-select') as HTMLElement & { loadChildren?: (request: { node: { value: string } }) => Promise<TreeNodeData[]> }
  const multiple = context.node.data.multiple === true
  if (multiple)
    assign(element, 'multiple', true)
  const ref: ContextRef = { current: context }
  if (context.loadChildren !== undefined)
    element.loadChildren = request => ref.current.loadChildren!(request.node.value).then(treeOf)
  let last: readonly OptionItem[] | undefined
  on<{ value: string[] }>(element, 'value-change', detail => ref.current.setValue(fromList(detail.value, multiple)))
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next, { placeholder: true })
    assign(element, 'loading', next.options?.status === 'loading' ? true : undefined)
    const items = itemsOf(next)
    if (items !== last) {
      last = items
      assign(element, 'collection', treeOf(items))
    }
    assign(element, 'value', toList(next.value))
  }
  update(context)
  return { element, update }
}

/** 一条路径：全是字符串的数组，否则为 `undefined`。 */
function pathOf(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? [...value] : undefined
}

/** 级联的字段值写给 UI：单选是一条路径，多选是路径数组；形状不对的路径不写。 */
function cascaderValueOf(value: unknown, multiple: boolean): string[] | string[][] {
  if (!multiple)
    return pathOf(value) ?? []
  return Array.isArray(value) ? value.map(pathOf).filter((path): path is string[] => path !== undefined && path.length > 0) : []
}

/**
 * 级联：`xh-cascader`，选项树是 collection；单选的值是从根到所选节点的一条路径，多选是路径数组，没选时都是空数组。
 * 带 hasChildren 的节点首次展开时经 loadChildren 向宿主要它的直接子项，在途、失败与重试由元素在那一列末尾给出。
 */
export const cascaderField: FieldRenderer = (context) => {
  const element = host(context.document, 'xh-cascader') as HTMLElement & { loadChildren?: (request: { node: { value: string } }) => Promise<TreeNodeData[]> }
  const multiple = context.node.data.multiple === true
  if (multiple)
    assign(element, 'multiple', true)
  const ref: ContextRef = { current: context }
  if (context.loadChildren !== undefined)
    element.loadChildren = request => ref.current.loadChildren!(request.node.value).then(treeOf)
  on<{ value: string[][] }>(element, 'value-change', (detail) => {
    ref.current.setValue(multiple ? detail.value.map(path => [...path]) : [...(detail.value[0] ?? [])])
  })
  let items: readonly OptionItem[] | undefined
  let shown: { value: unknown } | undefined
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next, { placeholder: true })
    assign(element, 'loading', next.options?.status === 'loading' ? true : undefined)
    if (itemsOf(next) !== items) {
      items = itemsOf(next)
      assign(element, 'collection', treeOf(items))
    }
    if (shown === undefined || shown.value !== next.value) {
      shown = { value: next.value }
      assign(element, 'value', cascaderValueOf(next.value, multiple))
    }
  }
  update(context)
  return { element, update }
}

/** 按钮组：`xh-toggle-group`，单选或多选；UI 交回单个值、数组或 `null`。 */
export const toggleGroupField: FieldRenderer = (context) => {
  const element = host(context.document, 'xh-toggle-group')
  const multiple = context.node.data.multiple === true
  if (multiple)
    assign(element, 'multiple', true)
  const syncCollection = collectionSync(element)
  const ref: ContextRef = { current: context }
  on<{ value: string | string[] | null }>(element, 'value-change', (detail) => {
    ref.current.setValue(fromList(toList(detail.value), multiple))
  })
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next)
    syncCollection(itemsOf(next))
    assign(element, 'value', multiple ? toList(next.value) : (typeof next.value === 'string' ? next.value : null))
  }
  update(context)
  return { element, update }
}

/** 列表：`xh-listbox`，平铺的单选或多选；选项写成 collection，取数在途时报在途，没有选项时空态文字取表单的 optionsEmpty。 */
export const listboxField: FieldRenderer = (context) => {
  const element = host(context.document, 'xh-listbox')
  const multiple = context.node.data.multiple === true
  if (multiple)
    assign(element, 'selectionMode', 'multiple')
  const syncCollection = collectionSync(element)
  const ref: ContextRef = { current: context }
  let empty: string | undefined
  on<{ value: string[] }>(element, 'value-change', detail => ref.current.setValue(fromList(detail.value, multiple)))
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next)
    if (next.translations.optionsEmpty !== empty) {
      empty = next.translations.optionsEmpty
      assign(element, 'translations', { empty })
    }
    assign(element, 'loading', next.options?.status === 'loading' ? true : undefined)
    syncCollection(itemsOf(next))
    assign(element, 'value', toList(next.value))
  }
  update(context)
  return { element, update }
}

/** 穿梭框：`xh-transfer`，值是搬到右侧的选项值，顺序同 UI 交回的；选项是两侧共用的 collection，取数在途时两侧报在途。 */
export const transferField: FieldRenderer = (context) => {
  const element = host(context.document, 'xh-transfer')
  const syncCollection = collectionSync(element)
  const ref: ContextRef = { current: context }
  on<{ value: string[] }>(element, 'value-change', detail => ref.current.setValue([...detail.value]))
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next)
    assign(element, 'loading', next.options?.status === 'loading' ? true : undefined)
    syncCollection(itemsOf(next))
    assign(element, 'value', toList(next.value))
  }
  update(context)
  return { element, update }
}

function checkable(tag: 'xh-checkbox' | 'xh-switch'): FieldRenderer {
  return (context) => {
    const element = host(context.document, tag)
    const ref: ContextRef = { current: context }
    on<{ checked: boolean }>(element, 'checked-change', detail => ref.current.setValue(detail.checked === true))
    const update = (next: FieldRendererContext): void => {
      ref.current = next
      paintCommon(element, next)
      assign(element, 'checked', next.value === true)
    }
    update(context)
    return { element, update }
  }
}

/** 勾选框：`xh-checkbox`。 */
export const checkboxField: FieldRenderer = checkable('xh-checkbox')

/** 开关：`xh-switch`。 */
export const switchField: FieldRenderer = checkable('xh-switch')
