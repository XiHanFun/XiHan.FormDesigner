/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 列表容器（子表单、子表）的部件树：<xh-field> 包住 <xh-field-array>，标题、整份列表的错误文案与状态由字段给出。
// 子表单按列表排布：一行一个 item，行号、行内容与把手各占一块，行内容由渲染器按行的数据路径渲染；
// 子表按表格排布：表头与各行放进 table 部件，行内一个字段占一个 item-cell，列头取字段标签。

import type { ContainerNode, NodeState } from '@xihan-form/core'
import type { FieldSize } from './types'
import { assign, host, make, stringOf, text } from './dom'

/** 列表容器的外壳。 */
export interface ListShell {
  /** `<xh-field>` 宿主。 */
  readonly element: HTMLElement
  /** `<xh-field-array>` 宿主。 */
  readonly array: HTMLElement
  /** 行所在的容器：列表排布是 root，行排在新增把手前面；表格排布是 table，行排在表头后面。 */
  readonly rows: HTMLElement
  /** 表格排布的列 id（行内节点的 id），顺序即列序；列表排布时为 `undefined`。 */
  readonly columns: readonly string[] | undefined
  /** 行容器里第一行所在的位置：没有行时是新增把手（列表排布）或 `null`（表格排布）。 */
  readonly firstRow: () => Element | null
  /** 状态、错误文案与新增把手的文字变化时调用。 */
  readonly update: (state: NodeState, error: string | undefined, addText: string) => void
}

/** 列表里的一行。 */
export interface ListRow {
  readonly item: HTMLElement
  /** 行号。 */
  readonly label: HTMLElement
  /** 列表排布的行内容，由渲染器填入；表格排布时为 `undefined`。 */
  readonly content: HTMLElement | undefined
  /** 表格排布按列 id 的格子，由渲染器填入；列表排布时为空。 */
  readonly cells: ReadonlyMap<string, HTMLElement>
}

/** 按表格排布的列表容器种类。 */
const TABLE_KINDS: ReadonlySet<string> = new Set(['subtable'])

/** 控件尺寸由矮到高。 */
const SIZES: readonly FieldSize[] = ['sm', 'md', 'lg']

/** 子表各列字段里最高的一档尺寸：字段没写尺寸时取 `size`；没有字段列时为 `undefined`。 */
function tallestSize(children: ContainerNode['regions'][number]['children'], size: FieldSize): FieldSize | undefined {
  let tallest: FieldSize | undefined
  for (const child of children) {
    if (child.type !== 'field')
      continue
    const own = SIZES.find(item => item === child.appearance.size) ?? size
    if (tallest === undefined || SIZES.indexOf(own) > SIZES.indexOf(tallest))
      tallest = own
  }
  return tallest
}

/**
 * 建列表容器的外壳：标题取 `basic.title`，`data.movable` 不为 `false` 时可以换序；子表的列取行内节点的标签。
 * `size` 是字段没写尺寸时的缺省档；子表各列最高一档不是 md 时，行号与把手按这一档的控件高居中。
 */
export function createListShell(doc: Document, node: ContainerNode, size: FieldSize): ListShell {
  const element = host(doc, 'xh-field')
  const fieldRoot = make(doc, 'div', 'root')
  const label = make(doc, 'label', 'label')
  text(label, stringOf(node.basic.title) ?? '')
  const array = host(doc, 'xh-field-array')
  array.setAttribute('data-xh-part', 'control')
  if (node.data.movable !== false)
    assign(array, 'movable', true)
  const root = make(doc, 'div', 'root')
  const add = make(doc, 'button', 'add-trigger', { type: 'button' })
  let rows = root
  let columns: readonly string[] | undefined
  let firstRow = (): Element | null => root.firstElementChild
  if (TABLE_KINDS.has(node.kind)) {
    const children = node.regions[0]?.children ?? []
    columns = children.map(child => child.id)
    assign(array, 'layout', 'table')
    assign(array, 'columns', children.map(child => ({ id: child.id, label: child.type === 'field' ? stringOf(child.basic.label) ?? '' : '' })))
    const cellSize = tallestSize(children, size)
    if (cellSize !== undefined && cellSize !== 'md')
      array.style.setProperty('--xh-field-array-cell-control-h', `var(--xh-control-h-${cellSize})`)
    const table = make(doc, 'div', 'table')
    const header = make(doc, 'div', 'header')
    header.append(...columns.map(id => make(doc, 'div', 'column-header', { value: id })))
    table.append(header)
    root.append(table)
    rows = table
    firstRow = () => header.nextElementSibling
  }
  root.append(add)
  array.append(root)
  const error = make(doc, 'p', 'error-text')
  fieldRoot.append(label, array, error)
  element.append(fieldRoot)
  return {
    element,
    array,
    rows,
    columns,
    firstRow,
    update: (state, message, addText) => {
      assign(element, 'disabled', state.disabled ? true : undefined)
      assign(element, 'readOnly', state.readOnly ? true : undefined)
      assign(element, 'required', state.required ? true : undefined)
      assign(array, 'disabled', state.disabled ? true : undefined)
      assign(array, 'readOnly', state.readOnly ? true : undefined)
      text(error, message ?? '')
      text(add, addText)
    },
  }
}

/** 建一行：行号、行内容（表格排布时是各列的格子），以及换序与删除把手（不可换序时只有删除）。 */
export function createListRow(doc: Document, movable: boolean, columns: readonly string[] | undefined): ListRow {
  const item = make(doc, 'div', 'item')
  const label = make(doc, 'div', 'item-label')
  const action = make(doc, 'div', 'item-action')
  if (movable)
    action.append(make(doc, 'button', 'move-up-trigger', { type: 'button' }), make(doc, 'button', 'move-down-trigger', { type: 'button' }))
  action.append(make(doc, 'button', 'item-delete-trigger', { type: 'button' }))
  if (columns === undefined) {
    const content = make(doc, 'div', 'item-content')
    item.append(label, content, action)
    return { item, label, content, cells: new Map() }
  }
  const cells = new Map(columns.map(id => [id, make(doc, 'div', 'item-cell', { value: id })]))
  item.append(label, ...cells.values(), action)
  return { item, label, content: undefined, cells }
}
