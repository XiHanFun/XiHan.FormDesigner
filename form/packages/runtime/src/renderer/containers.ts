/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 容器与静态元素的部件树：栅格、标签页、卡片、折叠、分组、表格布局，以及分隔线、段落、标题、提示、图片、条码与二维码。
// 标签页与折叠只建宿主元素加 collection，区域内容放进带 slot 的子节点，由元素搬进对应的面板；其余照 UI 文档写部件树。
// 每个区域给出一个放子节点的位置；状态只管隐藏与分组的禁用，字段自己的状态由字段处理。

import type { ContainerNode, NodeState, StaticNode } from '@xihan-form/core'
import { assign, attr, host, make, numberOf, stringOf, text } from './dom'

/** 容器的节点：宿主元素与每个区域放子节点的位置。 */
export interface ContainerView {
  /** 容器的宿主元素。 */
  readonly element: HTMLElement
  /** 区域 id → 放这个区域子节点的元素。 */
  readonly slots: ReadonlyMap<string, HTMLElement>
  /** 容器的联动状态变化时调用。 */
  readonly update: (state: NodeState) => void
}

/** 静态元素的节点。 */
export interface StaticView {
  /** 静态元素的宿主元素。 */
  readonly element: HTMLElement
  /** 联动状态变化时调用。 */
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

/** 每个区域一个带 slot 的子节点，slot 名是前缀加区域 id；collection 的值同样是区域 id，标题取区域的 title。 */
function slotted(doc: Document, element: HTMLElement, node: ContainerNode, prefix: string): Map<string, HTMLElement> {
  const slots = new Map<string, HTMLElement>()
  for (const region of node.regions) {
    const slot = make(doc, 'div', undefined, { slot: `${prefix}:${region.id}` })
    element.append(slot)
    slots.set(region.id, slot)
  }
  assign(element, 'collection', node.regions.map(region => ({ value: region.id, label: stringOf(region.props.title) ?? '' })))
  return slots
}

const tabs: ContainerBuilder = (doc, node) => {
  const element = host(doc, 'xh-tabs')
  const slots = slotted(doc, element, node, 'panel')
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
  const slots = slotted(doc, element, node, 'content')
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

const HEADING_TAGS = { 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' } as const

const heading: StaticBuilder = (doc, node) => {
  const element = host(doc, 'xh-typography')
  const level = (numberOf(node.appearance.level) ?? 3) as keyof typeof HEADING_TAGS
  const title = make(doc, HEADING_TAGS[level], 'heading', { level: String(level) })
  text(title, stringOf(node.basic.content) ?? '')
  const root = make(doc, 'div', 'root')
  root.append(title)
  element.append(root)
  return { element, update: hiding(element) }
}

const alert: StaticBuilder = (doc, node) => {
  const element = host(doc, 'xh-alert')
  assign(element, 'tone', stringOf(node.appearance.tone) ?? 'info')
  const content = make(doc, 'div', 'content')
  const title = stringOf(node.basic.title) ?? ''
  if (title !== '') {
    const heading = make(doc, 'div', 'title')
    text(heading, title)
    content.append(heading)
  }
  const description = stringOf(node.basic.content) ?? ''
  if (description !== '') {
    const body = make(doc, 'div', 'description')
    text(body, description)
    content.append(body)
  }
  const root = make(doc, 'div', 'root')
  root.append(content)
  element.append(root)
  return { element, update: hiding(element) }
}

const image: StaticBuilder = (doc, node) => {
  const element = host(doc, 'xh-image')
  const alt = stringOf(node.basic.alt) ?? ''
  assign(element, 'src', stringOf(node.basic.src) || undefined)
  assign(element, 'alt', alt)
  const root = make(doc, 'div', 'root')
  const width = numberOf(node.appearance.width)
  if (width !== undefined)
    root.style.setProperty('--xh-image-w', `${width}px`)
  const fallback = make(doc, 'div', 'fallback')
  text(fallback, alt)
  root.append(make(doc, 'img', 'image'), fallback)
  element.append(root)
  return { element, update: hiding(element) }
}

/** 码的根部件是 `<svg>`，按 SVG 命名空间建。 */
function svgRoot(doc: Document): SVGSVGElement {
  const root = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  root.setAttribute('data-xh-part', 'root')
  return root
}

const barcode: StaticBuilder = (doc, node) => {
  const element = host(doc, 'xh-bar-code')
  assign(element, 'format', stringOf(node.basic.format) ?? 'code128')
  assign(element, 'value', stringOf(node.basic.value) ?? '')
  if (node.appearance.showText === false)
    assign(element, 'text', false)
  element.append(svgRoot(doc))
  return { element, update: hiding(element) }
}

const qrcode: StaticBuilder = (doc, node) => {
  const element = host(doc, 'xh-matrix-code')
  assign(element, 'format', stringOf(node.basic.format) ?? 'qr')
  assign(element, 'value', stringOf(node.basic.value) ?? '')
  element.append(svgRoot(doc))
  return { element, update: hiding(element) }
}

/** 内置静态元素的部件树。 */
export const STATIC_BUILDERS: Readonly<Record<string, StaticBuilder>> = Object.freeze({ divider, paragraph, heading, alert, image, barcode, qrcode })
