/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 列表容器（子表单、子表）的外壳：<xh-field> 包住 <xh-field-array>，都只建宿主元素；
// 标题与整份列表的错误文案写到字段的属性上，<xh-field-array> 写成 slot="control" 放进字段的标准结构。
// 行号、换序与删除把手、表头和新增把手由 <xh-field-array> 按标准结构铺出；渲染器只给每行的内容：
// 子表单一行一个 slot="item-content:<行 key>" 的节点，子表一行每列一个 slot="item-cell:<行 key>:<列 id>" 的节点，
// 都是 <xh-field-array> 的直接子节点，由元素挪进对应的格子，换序时跟着行走。

import type { ContainerNode, NodeState } from '@xihan-form/core'
import type { FieldSize } from './types'
import { assign, host, make, numberOf, stringOf } from './dom'

/** 列表容器的外壳。 */
export interface ListShell {
  /** `<xh-field>` 宿主。 */
  readonly element: HTMLElement
  /** `<xh-field-array>` 宿主，各行内容节点挂在它下面。 */
  readonly array: HTMLElement
  /** 表格排布的列 id（行内节点的 id），顺序即列序；列表排布时为 `undefined`。 */
  readonly columns: readonly string[] | undefined
  /** 状态、错误文案与新增把手的文字变化时调用。 */
  readonly update: (state: NodeState, error: string | undefined, addText: string) => void
}

/** 列表里一行的内容节点：还不知道行 key 时藏着，给了 key 才写上 slot。 */
export interface ListRow {
  /** 列表排布的行内容，由渲染器填入；表格排布时为 `undefined`。 */
  readonly content: HTMLElement | undefined
  /** 表格排布按列 id 的格子内容，由渲染器填入；列表排布时为空。 */
  readonly cells: ReadonlyMap<string, HTMLElement>
  /** 这一行的全部内容节点。 */
  readonly nodes: readonly HTMLElement[]
  /** 写上行 key：内容节点的 slot 按它取名，随后显示出来。 */
  readonly place: (key: string) => void
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
 * 建列表容器的外壳：标题取 `basic.title`，`data.movable` 不为 `false` 时可以换序；子表的列取行内节点的标签，
 * 字段写了 `appearance.columnMinWidth` 时那一列不窄于它（px），放不下时表格区横向滚动。
 * `size` 是字段没写尺寸时的缺省档；子表各列最高一档不是 md 时，行号与把手按这一档的控件高居中。
 */
export function createListShell(doc: Document, node: ContainerNode, size: FieldSize): ListShell {
  const element = host(doc, 'xh-field')
  assign(element, 'label', stringOf(node.basic.title) ?? '')
  assign(element, 'errorText', '')
  const array = host(doc, 'xh-field-array')
  array.setAttribute('slot', 'control')
  if (node.data.movable !== false)
    assign(array, 'movable', true)
  let columns: readonly string[] | undefined
  if (TABLE_KINDS.has(node.kind)) {
    const children = node.regions[0]?.children ?? []
    columns = children.map(child => child.id)
    assign(array, 'layout', 'table')
    assign(array, 'columns', children.map((child) => {
      const minWidth = child.type === 'field' ? numberOf(child.appearance.columnMinWidth) : undefined
      return { id: child.id, label: child.type === 'field' ? stringOf(child.basic.label) ?? '' : '', ...(minWidth === undefined ? {} : { minWidth }) }
    }))
    const cellSize = tallestSize(children, size)
    if (cellSize !== undefined && cellSize !== 'md')
      array.style.setProperty('--xh-field-array-cell-control-h', `var(--xh-control-h-${cellSize})`)
  }
  element.append(array)
  let addLabel: string | undefined
  return {
    element,
    array,
    columns,
    update: (state, message, addText) => {
      assign(element, 'disabled', state.disabled ? true : undefined)
      assign(element, 'readOnly', state.readOnly ? true : undefined)
      assign(element, 'required', state.required ? true : undefined)
      assign(array, 'disabled', state.disabled ? true : undefined)
      assign(array, 'readOnly', state.readOnly ? true : undefined)
      assign(element, 'errorText', message ?? '')
      if (addText !== addLabel) {
        addLabel = addText
        assign(array, 'translations', { addTrigger: addText })
      }
    },
  }
}

/** 还不知道行 key 时内容节点的 slot：对不上任何格子，元素也就不把里面的部件当作者写的结构。 */
const PENDING_SLOT = 'form-row-pending'

/** 建一行的内容节点（表格排布时每列一个），挂到 `array` 下，给出行 key 前藏着。 */
export function createListRow(doc: Document, array: HTMLElement, columns: readonly string[] | undefined): ListRow {
  const content = columns === undefined ? make(doc, 'div', undefined, { 'data-form-region': '' }) : undefined
  const cells = new Map((columns ?? []).map(id => [id, make(doc, 'div', undefined, { 'data-form-cell': '' })]))
  const nodes = content === undefined ? [...cells.values()] : [content]
  for (const node of nodes) {
    node.hidden = true
    node.setAttribute('slot', PENDING_SLOT)
    array.append(node)
  }
  return {
    content,
    cells,
    nodes,
    place: (key) => {
      if (content !== undefined)
        content.setAttribute('slot', `item-content:${key}`)
      for (const [id, cell] of cells)
        cell.setAttribute('slot', `item-cell:${key}:${id}`)
      for (const node of nodes)
        node.hidden = false
    },
  }
}
