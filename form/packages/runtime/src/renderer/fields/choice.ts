/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 选择类字段：下拉、组合框、单选组、多选组、按钮组、勾选框、开关。
// 组合框、按钮组与开关只建宿主元素，部件由元素按标准结构生成；其余照 UI 文档写部件树，条目节点按值复用。
// 选项来自上下文的 options：静态选项或加载结果。

import type { KeyedChildren } from '@xihan-ui/web-components/authoring'
import type { OptionItem } from '../../state/options'
import type { FieldRenderer, FieldRendererContext } from '../types'
import type { ContextRef } from './shared'
import { createGeneratedElement, reconcile } from '@xihan-ui/web-components/authoring'
import { assign, attr, host, make, stringOf, text } from '../dom'
import { fromList, on, paintCommon, toList } from './shared'

function itemsOf(context: FieldRendererContext): readonly OptionItem[] {
  return context.options?.items ?? []
}

function collectionOf(items: readonly OptionItem[]): { value: string, label: string, disabled?: boolean }[] {
  return items.map(item => ({ value: item.value, label: item.label, ...(item.disabled === true ? { disabled: true } : {}) }))
}

/** 选项同步：选项换了才重写元素的 collection 与条目节点，条目节点按值复用，文字与禁用随选项更新。 */
function optionSync(element: HTMLElement, parent: Element, build: (doc: Document) => { item: HTMLElement, text: Element }): (items: readonly OptionItem[]) => void {
  const keys: KeyedChildren = new WeakMap()
  const texts = new WeakMap<Element, Element>()
  let last: readonly OptionItem[] | undefined
  return (items) => {
    if (items === last)
      return
    last = items
    assign(element, 'collection', collectionOf(items))
    syncItems(parent, items, keys, texts, build)
  }
}

function syncItems(parent: Element, items: readonly OptionItem[], keys: KeyedChildren, texts: WeakMap<Element, Element>, build: (doc: Document) => { item: HTMLElement, text: Element }): void {
  const doc = parent.ownerDocument
  reconcile(parent, items, keys, item => item.value, (item, reuse) => {
    let node = reuse as HTMLElement | undefined
    if (node === undefined) {
      const built = build(doc)
      node = built.item
      texts.set(node, built.text)
    }
    attr(node, 'value', item.value)
    attr(node, 'aria-disabled', item.disabled === true ? 'true' : undefined)
    text(texts.get(node)!, item.label)
    return node
  })
}

function generated(doc: Document, tag: 'div' | 'span' | 'button', name: string): HTMLElement {
  const node = createGeneratedElement(doc, tag)
  node.setAttribute('data-xh-part', name)
  return node
}

/** 下拉：`xh-select`，多选时把选中项画成标签。 */
export const selectField: FieldRenderer = (context) => {
  const doc = context.document
  const multiple = context.node.data.multiple === true
  const element = host(doc, 'xh-select')
  const trigger = make(doc, 'button', 'trigger', { type: 'button' })
  const tagList = make(doc, 'span', 'tag-list')
  const overflow = make(doc, 'span', 'overflow-tag')
  tagList.append(overflow)
  trigger.append(make(doc, 'span', 'value-text'), ...(multiple ? [tagList] : []), make(doc, 'span', 'indicator'))
  const control = make(doc, 'div', 'control')
  control.append(trigger)
  const list = make(doc, 'div', 'list')
  const empty = make(doc, 'div', 'empty')
  const loading = make(doc, 'div', 'loading')
  const content = make(doc, 'div', 'content')
  content.append(list, empty, loading)
  const positioner = make(doc, 'div', 'positioner')
  positioner.append(content)
  const root = make(doc, 'div', 'root')
  root.append(control, positioner)
  element.append(root)
  if (multiple)
    assign(element, 'multiple', true)
  const syncOptions = optionSync(element, list, (owner) => {
    const item = generated(owner, 'div', 'item')
    const itemText = make(owner, 'span', 'item-text')
    item.append(itemText, make(owner, 'span', 'item-indicator'))
    return { item, text: itemText }
  })
  const tagKeys: KeyedChildren = new WeakMap()
  const select = element as HTMLElement & { tags?: readonly { value: string, label: string }[], updateComplete?: Promise<boolean> }
  const renderTags = (): void => {
    if (!multiple)
      return
    const tags = select.tags ?? []
    reconcile(tagList, tags, tagKeys, tag => tag.value, (tag, reuse) => {
      const node = (reuse as HTMLElement | undefined) ?? generated(doc, 'span', 'tag')
      attr(node, 'value', tag.value)
      text(node, tag.label)
      return node
    })
    tagList.append(overflow)
  }
  const ref: ContextRef = { current: context }
  on<{ value: string[] }>(element, 'value-change', detail => ref.current.setValue(fromList(detail.value, multiple)))
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next, { placeholder: true })
    syncOptions(itemsOf(next))
    text(loading, next.translations.optionsLoading)
    text(empty, next.translations.optionsEmpty)
    assign(element, 'loading', next.options?.status === 'loading' ? true : undefined)
    assign(element, 'value', toList(next.value))
    void select.updateComplete?.then(renderTags)
  }
  update(context)
  return { element, update }
}

function groupField(tag: 'xh-radio-group' | 'xh-checkbox-group', toUi: (value: unknown) => unknown, fromUi: (value: unknown) => string | string[] | null): FieldRenderer {
  return (context) => {
    const doc = context.document
    const element = host(doc, tag)
    const root = make(doc, 'div', 'root')
    element.append(root)
    assign(element, 'orientation', stringOf(context.node.appearance.orientation))
    const syncOptions = optionSync(element, root, (owner) => {
      const item = generated(owner, 'div', 'item')
      const itemText = make(owner, 'span', 'item-text')
      item.append(make(owner, 'input', 'hidden-input'), make(owner, 'span', 'indicator'), itemText)
      return { item, text: itemText }
    })
    const ref: ContextRef = { current: context }
    on<{ value: unknown }>(element, 'value-change', detail => ref.current.setValue(fromUi(detail.value)))
    const update = (next: FieldRendererContext): void => {
      ref.current = next
      paintCommon(element, next)
      syncOptions(itemsOf(next))
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

function checkable(tag: 'xh-checkbox' | 'xh-switch'): FieldRenderer {
  return (context) => {
    const doc = context.document
    const element = host(doc, tag)
    if (tag === 'xh-checkbox') {
      const control = make(doc, 'button', 'root', { type: 'button' })
      control.append(make(doc, 'span', 'indicator'), make(doc, 'input', 'hidden-input'))
      element.append(control)
    }
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
