/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 容器与静态元素的部件树：栅格、标签页、卡片、折叠、分组、表格布局、分隔线、段落，照 UI 文档的写法。
// 每个区域给出一个放子节点的位置；状态只管隐藏与分组的禁用，字段自己的状态由字段处理。

import type { ContainerNode, NodeState, StaticNode } from '@xihan-form/core'
import { assign, attr, host, make, numberOf, stringOf, text } from './dom'

/** 容器的节点：宿主元素与每个区域放子节点的位置。 */
export interface ContainerView {
  readonly element: HTMLElement
  readonly slots: ReadonlyMap<string, HTMLElement>
  readonly update: (state: NodeState) => void
}

/** 静态元素的节点。 */
export interface StaticView {
  readonly element: HTMLElement
  readonly update: (state: NodeState) => void
}

/** 按种类建容器节点。 */
export type ContainerBuilder = (doc: Document, node: ContainerNode) => ContainerView

/** 按种类建静态元素节点。 */
export type StaticBuilder = (doc: Document, node: StaticNode) => StaticView

function hiding(element: HTMLElement): (state: NodeState) => void {
  return (state) => {
    element.hidden = state.hidden
  }
}

const grid: ContainerBuilder = (doc, node) => {
  const element = host(doc, 'xh-grid')
  attr(element, 'cols', '12')
  attr(element, 'gap', stringOf(node.appearance.gap))
  const root = make(doc, 'div', 'root')
  const slots = new Map<string, HTMLElement>()
  for (const region of node.regions) {
    const item = make(doc, 'div', 'item')
    attr(item, 'span', String(numberOf(region.props.span) ?? 12))
    const offset = numberOf(region.props.offset)
    if (offset !== undefined && offset > 0)
      attr(item, 'offset', String(offset))
    root.append(item)
    slots.set(region.id, item)
  }
  element.append(root)
  return { element, slots, update: hiding(element) }
}

const tabs: ContainerBuilder = (doc, node) => {
  const element = host(doc, 'xh-tabs')
  const list = make(doc, 'div', 'list')
  const root = make(doc, 'div', 'root')
  root.append(list)
  const slots = new Map<string, HTMLElement>()
  for (const region of node.regions) {
    const trigger = make(doc, 'button', 'trigger', { type: 'button', value: region.id })
    text(trigger, stringOf(region.props.title) ?? '')
    list.append(trigger)
    const content = make(doc, 'div', 'content', { value: region.id })
    root.append(content)
    slots.set(region.id, content)
  }
  list.append(make(doc, 'div', 'indicator'))
  attr(list, 'aria-label', stringOf(node.basic.title) ?? '')
  element.append(root)
  assign(element, 'defaultValue', node.regions[0]?.id)
  return { element, slots, update: hiding(element) }
}

const card: ContainerBuilder = (doc, node) => {
  const element = host(doc, 'xh-card')
  const root = make(doc, 'div', 'root')
  const title = stringOf(node.basic.title) ?? ''
  if (title !== '') {
    const header = make(doc, 'div', 'header')
    const heading = make(doc, 'div', 'title')
    text(heading, title)
    header.append(heading)
    root.append(header)
  }
  const content = make(doc, 'div', 'content')
  root.append(content)
  element.append(root)
  return { element, slots: new Map([[node.regions[0]!.id, content]]), update: hiding(element) }
}

const collapse: ContainerBuilder = (doc, node) => {
  const element = host(doc, 'xh-accordion')
  const root = make(doc, 'div', 'root')
  const slots = new Map<string, HTMLElement>()
  for (const region of node.regions) {
    const item = make(doc, 'div', 'item', { value: region.id })
    const trigger = make(doc, 'button', 'trigger', { type: 'button' })
    const caption = make(doc, 'span')
    text(caption, stringOf(region.props.title) ?? '')
    trigger.append(caption, make(doc, 'span', 'indicator'))
    const header = make(doc, 'h3', 'header')
    header.append(trigger)
    const content = make(doc, 'div', 'content')
    item.append(header, content)
    root.append(item)
    slots.set(region.id, content)
  }
  element.append(root)
  if (node.appearance.multiple !== false)
    assign(element, 'multiple', true)
  assign(element, 'collapsible', true)
  assign(element, 'defaultValue', node.regions.filter(region => region.props.expanded !== false).map(region => region.id))
  return { element, slots, update: hiding(element) }
}

const fieldset: ContainerBuilder = (doc, node) => {
  const element = host(doc, 'xh-fieldset')
  const root = make(doc, 'fieldset', 'root')
  const legend = make(doc, 'legend', 'legend')
  text(legend, stringOf(node.basic.legend) ?? '')
  root.append(legend)
  element.append(root)
  return {
    element,
    slots: new Map([[node.regions[0]!.id, root]]),
    update: (state) => {
      element.hidden = state.hidden
      assign(element, 'disabled', state.disabled ? true : undefined)
    },
  }
}

const table: ContainerBuilder = (doc, node) => {
  const element = host(doc, 'xh-grid')
  attr(element, 'cols', String(numberOf(node.appearance.columns) ?? 1))
  attr(element, 'rows', String(numberOf(node.appearance.rows) ?? 1))
  attr(element, 'ruled', node.appearance.bordered === false ? undefined : '')
  const root = make(doc, 'div', 'root')
  const slots = new Map<string, HTMLElement>()
  const cells = [...node.regions].sort((a, b) => (numberOf(a.props.row) ?? 0) - (numberOf(b.props.row) ?? 0) || (numberOf(a.props.column) ?? 0) - (numberOf(b.props.column) ?? 0))
  for (const region of cells) {
    const item = make(doc, 'div', 'item')
    attr(item, 'span', String(numberOf(region.props.columnSpan) ?? 1))
    attr(item, 'row-span', String(numberOf(region.props.rowSpan) ?? 1))
    root.append(item)
    slots.set(region.id, item)
  }
  element.append(root)
  return { element, slots, update: hiding(element) }
}

/** 内置容器的部件树；列表容器（子表单、子表）不在其中。 */
export const CONTAINER_BUILDERS: Readonly<Record<string, ContainerBuilder>> = Object.freeze({ grid, tabs, card, collapse, fieldset, table })

const divider: StaticBuilder = (doc, node) => {
  const element = host(doc, 'xh-separator')
  const root = make(doc, 'div', 'root')
  const label = stringOf(node.basic.label) ?? ''
  if (label !== '') {
    const content = make(doc, 'span', 'content')
    text(content, label)
    root.append(make(doc, 'div', 'line'), content, make(doc, 'div', 'line'))
    assign(element, 'decorative', true)
  }
  element.append(root)
  return { element, update: hiding(element) }
}

const paragraph: StaticBuilder = (doc, node) => {
  const element = host(doc, 'xh-typography')
  assign(element, 'size', stringOf(node.appearance.size))
  const body = make(doc, 'p', 'paragraph')
  text(body, stringOf(node.basic.content) ?? '')
  const root = make(doc, 'div', 'root')
  root.append(body)
  element.append(root)
  return { element, update: hiding(element) }
}

/** 内置静态元素的部件树。 */
export const STATIC_BUILDERS: Readonly<Record<string, StaticBuilder>> = Object.freeze({ divider, paragraph })
