/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计画布：按模板所见即所得地排出表单。字段用渲染器的字段渲染器与字段外壳画，控件不可交互；
// 容器与静态元素用渲染器的部件树；每个节点一块可选中的外框，容器的每个区域是一块放置区。

import type { ContainerNode, FieldNode, FormDocument, FormNode, KindRegistry, StaticNode } from '@xihan-form/core'
import type { FieldRendererContext, FieldRendererInstance, FieldSize, FormDesignerTranslations, FormRendererTranslations, FormRuntimeModel, OptionItem } from '@xihan-form/runtime'
import type { FormDropTarget, FormSelection } from './editor'
import { isValueOfKind, numberControl } from '@xihan-form/core'
import { createFieldShell } from '@xihan-form/runtime/design'
import { createAuthoredElement, setAttributes, setText } from '@xihan-ui/web-components/authoring'

/** 画布需要设计器提供的能力与配置。 */
export interface CanvasHost {
  readonly ownerDocument: Document
  /** 按扩展合出的运行时模型：种类与各种类的渲染。 */
  readonly model: () => FormRuntimeModel
  readonly translations: () => FormDesignerTranslations
  readonly rendererTranslations: () => FormRendererTranslations
}

/** 指针落点：节点、区域，或空白处。 */
export type CanvasTarget
  = | { readonly kind: 'node', readonly id: string }
    | { readonly kind: 'region', readonly id: string }
    | { readonly kind: 'blank' }

/** 画布上的一个放置位置。 */
export interface CanvasDrop {
  readonly target: FormDropTarget
  /** 放进的列表：区域的放置区，或顶层的表单。 */
  readonly list: HTMLElement
  /** 插入点后面的节点块；插在末尾时为 undefined。 */
  readonly before: HTMLElement | undefined
  /** 插入点前面的节点块；插在开头时为 undefined。 */
  readonly after: HTMLElement | undefined
}

const DESIGN_STATE = { hidden: false, disabled: false, readOnly: false } as const

/**
 * 容器的区域属性里有带上限的数字 span 时，区域可以拖右缘改跨度，返回 span 的取值范围（上限即总列数，下限缺省为 1）；
 * 否则为 undefined。
 */
export function spanRange(registry: KindRegistry, kind: string): { readonly min: number, readonly max: number } | undefined {
  const definition = registry.get(kind)
  const span = definition?.type === 'container' ? definition.regionProperties.find(descriptor => descriptor.path.length === 1 && descriptor.path[0] === 'span') : undefined
  const control = span === undefined ? undefined : numberControl(span.control)
  return control?.max === undefined ? undefined : { min: control.min ?? 1, max: control.max }
}

/** 容器外框上下边缘多宽以内算放在容器前后，像素。 */
const CONTAINER_EDGE = 16

function stringOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** 容器自己的区域里离点最近的一个；收起的区域（没有尺寸）不算。 */
function nearestRegion(owner: HTMLElement, point: { readonly x: number, readonly y: number }): HTMLElement | undefined {
  let best: HTMLElement | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (const region of owner.querySelectorAll<HTMLElement>('[data-region-id]')) {
    if (region.closest('[data-node-id]') !== owner)
      continue
    const rect = region.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0)
      continue
    const dx = Math.max(rect.left - point.x, 0, point.x - rect.right)
    const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom)
    const distance = Math.hypot(dx, dy)
    if (distance < bestDistance) {
      best = region
      bestDistance = distance
    }
  }
  return best
}

/** 两个同 id 的容器节点只差在区域里的子节点：其余字段，以及各区域除 children 以外的字段，都是同一个引用。 */
function sameShell(before: ContainerNode, node: ContainerNode): boolean {
  const fields = (value: object): Readonly<Record<string, unknown>> => value as Readonly<Record<string, unknown>>
  const keys = Object.keys(node)
  if (keys.length !== Object.keys(before).length || node.regions.length !== before.regions.length)
    return false
  if (keys.some(key => key !== 'regions' && fields(node)[key] !== fields(before)[key]))
    return false
  return node.regions.every((region, index) => {
    const other = before.regions[index]!
    const regionKeys = Object.keys(region)
    return regionKeys.length === Object.keys(other).length && regionKeys.every(key => key === 'children' || fields(region)[key] === fields(other)[key])
  })
}

/** 把 parent 的子节点调成依次是 desired：已在位的不动，不要的移除，其余按位插入；尽量少挪，免得里面的元素断开又重连。 */
function reconcile(parent: Element, desired: readonly Element[]): void {
  const wanted = new Set<Node>(desired)
  let cursor = parent.firstChild
  for (const element of desired) {
    while (cursor !== null && cursor !== element && !wanted.has(cursor)) {
      const next = cursor.nextSibling
      cursor.remove()
      cursor = next
    }
    if (cursor === element)
      cursor = cursor.nextSibling
    else
      parent.insertBefore(element, cursor)
  }
  while (cursor !== null) {
    const next = cursor.nextSibling
    cursor.remove()
    cursor = next
  }
}

/** 一次排版留下的块：节点 id 到节点块、区域 id 到放置区、节点块画的节点对象与字段的渲染实例。 */
interface CanvasBlocks {
  readonly nodes: Map<string, HTMLElement>
  readonly regions: Map<string, HTMLElement>
  readonly drawn: Map<string, FormNode>
  readonly instances: Map<string, FieldRendererInstance>
}

function emptyBlocks(): CanvasBlocks {
  return { nodes: new Map(), regions: new Map(), drawn: new Map(), instances: new Map() }
}

/** 设计画布：文档变化时按节点复用着重排，选择变化时只改选中标记。 */
export class DesignCanvas {
  /** 画布表面：一个只用于排版的 <xh-form>，标签位置随表单设置。 */
  readonly element: HTMLElement
  readonly #host: CanvasHost
  readonly #root: HTMLFormElement
  #blocks = emptyBlocks()
  /** 复用着重排时上一次排版留下的块，只在 render 期间有值。 */
  #previous: CanvasBlocks | undefined
  /** 页面结构里标出的节点或区域；重排后照样标在新的外框上。 */
  #highlighted: string | null = null

  constructor(host: CanvasHost) {
    this.#host = host
    const doc = host.ownerDocument
    this.#root = createAuthoredElement(doc, 'form', { 'data-xh-part': 'root', 'novalidate': true })
    this.element = createAuthoredElement(doc, 'xh-form', { 'validate-on': 'submit', 'data-part': 'surface' }, [this.#root])
  }

  /**
   * 按文档排画布。reuse 为 true 时按节点复用上一次排好的块：同一个节点对象原样沿用（连同里面的全部节点），
   * 容器只是区域里的子节点变了时沿用它的外框与区域、只调各区域的子节点，其余按新文档重建，换下的字段渲染实例最后 destroy；
   * 为 false 时整份重建，扩展、文案或配置变了时用。
   */
  render(document: FormDocument, reuse = false): void {
    const previous = this.#blocks
    if (!reuse) {
      for (const instance of previous.instances.values())
        instance.destroy?.()
    }
    this.#blocks = emptyBlocks()
    this.#previous = reuse ? previous : undefined
    try {
      ;(this.element as HTMLElement & { layout?: string }).layout = document.settings.labelPlacement === 'start' ? 'horizontal' : 'vertical'
      const children = document.children.map(node => this.#node(node, document))
      if (children.length === 0)
        children.push((reuse ? this.#root.querySelector<HTMLElement>(':scope > [data-part="canvas-empty"]') : null) ?? createAuthoredElement(this.#host.ownerDocument, 'div', { 'data-part': 'canvas-empty' }, [this.#host.translations().emptyCanvas]))
      reconcile(this.#root, children)
    }
    finally {
      this.#previous = undefined
    }
    if (reuse) {
      for (const [id, instance] of previous.instances) {
        if (this.#blocks.instances.get(id) !== instance)
          instance.destroy?.()
      }
    }
    this.highlight(this.#highlighted)
  }

  /** 标出一个节点或区域（写 data-highlighted，样式同悬停），null 撤掉；不改选择、不滚动。 */
  highlight(id: string | null): void {
    if (this.#highlighted !== null)
      (this.#blocks.nodes.get(this.#highlighted) ?? this.#blocks.regions.get(this.#highlighted))?.removeAttribute('data-highlighted')
    this.#highlighted = id
    if (id !== null)
      (this.#blocks.nodes.get(id) ?? this.#blocks.regions.get(id))?.setAttribute('data-highlighted', '')
  }

  /** 把选中标记落到节点与区域上。 */
  select(selection: FormSelection): void {
    const nodes = new Set(selection.nodes)
    const regions = new Set(selection.regions ?? [])
    for (const [id, element] of this.#blocks.nodes)
      setAttributes(element, { 'data-selected': nodes.has(id) })
    for (const [id, element] of this.#blocks.regions)
      setAttributes(element, { 'data-selected': regions.has(id) })
  }

  /** 节点的外框；不在画布上时为 undefined。 */
  nodeElement(id: string): HTMLElement | undefined {
    return this.#blocks.nodes.get(id)
  }

  /** 区域的放置区；不在画布上时为 undefined。 */
  regionElement(id: string): HTMLElement | undefined {
    return this.#blocks.regions.get(id)
  }

  /**
   * 拖跨度时画出还没写进模板的区域属性：按给定的容器节点在画布外另建一份外壳，把其中各区域格子的特性写到画布上对应的格子上，
   * 再让容器元素重新铺一次；不挪动、不重建任何节点块。容器不在画布上或没有渲染方式时什么都不做。
   */
  previewContainer(node: ContainerNode): void {
    const live = this.#blocks.nodes.get(node.id)?.querySelector<HTMLElement>(':scope > [data-part="node-body"] > *')
    const build = this.#host.model().containerRenderers.get(node.kind)
    if (live === null || live === undefined || build === undefined)
      return
    const view = build(this.#host.ownerDocument, node)
    for (const region of node.regions) {
      const source = view.slots.get(region.id)
      const target = this.#blocks.regions.get(region.id)?.parentElement
      if (source === undefined || target === null || target === undefined)
        continue
      for (const { name, value } of source.attributes) {
        if (target.getAttribute(name) !== value)
          target.setAttribute(name, value)
      }
    }
    ;(live as HTMLElement & { requestUpdate?: () => void }).requestUpdate?.()
  }

  /** 事件目标对应的节点或区域：落在区域空白处时是区域，落在区域里的子节点上时是子节点。 */
  targetOf(target: EventTarget | null): CanvasTarget {
    const element = target instanceof Element ? target : null
    const node = element?.closest<HTMLElement>('[data-node-id]')
    const region = element?.closest<HTMLElement>('[data-region-id]')
    if (region?.dataset.regionId !== undefined && this.element.contains(region) && (!node || node.contains(region)))
      return { kind: 'region', id: region.dataset.regionId }
    if (node?.dataset.nodeId !== undefined && this.element.contains(node))
      return { kind: 'node', id: node.dataset.nodeId }
    return { kind: 'blank' }
  }

  /**
   * 视口坐标处的放置位置：指针下最内层的区域（不在任何区域里时是顶层），按节点块的竖向中线算插入下标。
   * 一并给出放进的列表与插入点前后的节点块，供画插入线。
   */
  dropAt(point: { readonly x: number, readonly y: number }): CanvasDrop {
    const hit = this.#host.ownerDocument.elementsFromPoint(point.x, point.y).find(element => this.element.contains(element))
    const list = this.#listAt(hit, point)
    const blocks = Array.from(list.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child.dataset.nodeId !== undefined)
    const found = blocks.findIndex((block) => {
      const rect = block.getBoundingClientRect()
      return point.y < rect.top + rect.height / 2
    })
    const index = found === -1 ? blocks.length : found
    return {
      target: { parent: list === this.#root ? null : list.dataset.regionId!, index },
      list,
      before: blocks[index],
      after: index > 0 ? blocks[index - 1] : undefined,
    }
  }

  /**
   * 放进哪个列表：指针落在容器外框里、却不在它的任何区域里（栅格的空隙、卡片的标题）时，
   * 贴着外框上下边缘放在容器前后，否则放进它最近的可见区域；其余情况取指针所在的最内层区域。
   */
  #listAt(hit: Element | undefined, point: { readonly x: number, readonly y: number }): HTMLElement {
    const region = hit?.closest<HTMLElement>('[data-region-id]') ?? undefined
    const owner = hit?.closest<HTMLElement>('[data-node-id]') ?? undefined
    if (owner !== undefined && owner.dataset.nodeType === 'container' && this.element.contains(owner) && (region === undefined || !owner.contains(region))) {
      const rect = owner.getBoundingClientRect()
      const edge = Math.min(rect.height / 4, CONTAINER_EDGE)
      if (point.y > rect.top + edge && point.y < rect.bottom - edge) {
        const nearest = nearestRegion(owner, point)
        if (nearest !== undefined)
          return nearest
      }
    }
    return region !== undefined && this.element.contains(region) ? region : this.#root
  }

  #node(node: FormNode, document: FormDocument): HTMLElement {
    const previous = this.#previous
    const reused = previous?.nodes.get(node.id)
    const before = previous?.drawn.get(node.id)
    if (previous !== undefined && reused !== undefined && before === node) {
      this.#adopt(node, previous)
      return reused
    }
    if (previous !== undefined && reused !== undefined && before?.type === 'container' && node.type === 'container' && sameShell(before, node)) {
      const regions = node.regions.map(region => previous.regions.get(region.id))
      if (regions.every(region => region !== undefined)) {
        const resizable = this.#host.model().containerRenderers.has(node.kind) && spanRange(this.#host.model().registry, node.kind) !== undefined
        node.regions.forEach((region, index) => this.#fill(regions[index]!, region.id, region.children, document, resizable))
        this.#blocks.nodes.set(node.id, reused)
        this.#blocks.drawn.set(node.id, node)
        return reused
      }
    }
    const doc = this.#host.ownerDocument
    const t = this.#host.translations()
    const key = node.type === 'static' ? undefined : stringOf((node as { key?: unknown }).key)
    const tag = createAuthoredElement(doc, 'div', { 'data-part': 'node-tag', 'aria-hidden': 'true' }, [t.nodeTag(node.kind, key)])
    const body = createAuthoredElement(doc, 'div', { 'data-part': 'node-body' }, [this.#content(node, document)])
    const block = createAuthoredElement(doc, 'div', { 'data-part': 'node', 'data-node-id': node.id, 'data-node-type': node.type, 'data-kind': node.kind }, [tag, body])
    this.#blocks.nodes.set(node.id, block)
    this.#blocks.drawn.set(node.id, node)
    return block
  }

  /** 原样沿用一个节点上一次排好的块，连同它里面的区域、节点块与字段渲染实例。 */
  #adopt(node: FormNode, previous: CanvasBlocks): void {
    const block = previous.nodes.get(node.id)
    if (block !== undefined)
      this.#blocks.nodes.set(node.id, block)
    this.#blocks.drawn.set(node.id, node)
    const instance = previous.instances.get(node.id)
    if (instance !== undefined)
      this.#blocks.instances.set(node.id, instance)
    if (node.type !== 'container')
      return
    for (const region of node.regions) {
      const element = previous.regions.get(region.id)
      if (element !== undefined)
        this.#blocks.regions.set(region.id, element)
      for (const child of region.children)
        this.#adopt(child, previous)
    }
  }

  #content(node: FormNode, document: FormDocument): HTMLElement {
    if (node.type === 'field')
      return this.#field(node)
    if (node.type === 'static')
      return this.#static(node)
    return this.#container(node, document)
  }

  #field(node: FieldNode): HTMLElement {
    const doc = this.#host.ownerDocument
    const renderer = this.#host.model().fieldRenderers.get(node.kind)
    if (renderer === undefined)
      return this.#placeholder(node.kind)
    const instance = renderer(this.#context(node))
    this.#blocks.instances.set(node.id, instance)
    const shell = createFieldShell(doc, node, instance.element)
    shell.update(this.#context(node))
    shell.element.inert = true
    return shell.element
  }

  #context(node: FieldNode): FieldRendererContext {
    const definition = this.#host.model().registry.get(node.kind)
    const initial = node.basic.initialValue
    const value = definition?.type === 'field'
      ? (initial !== undefined && isValueOfKind(definition.valueKind(node.data), initial) ? initial : definition.emptyValue(node.data))
      : undefined
    const options: readonly OptionItem[] = Array.isArray(node.data.options) ? node.data.options as unknown as readonly OptionItem[] : []
    return {
      document: this.#host.ownerDocument,
      node,
      path: [node.key],
      value,
      state: { ...DESIGN_STATE, required: node.validation.some(rule => rule.kind === 'required') },
      error: undefined,
      options: { status: 'ready', items: options },
      searchOptions: undefined,
      reloadOptions: undefined,
      loadChildren: undefined,
      size: (stringOf(node.appearance.size) ?? 'md') as FieldSize,
      translations: this.#host.rendererTranslations(),
      uploadFile: undefined,
      setValue: () => {},
      commit: () => {},
    }
  }

  #static(node: StaticNode): HTMLElement {
    const build = this.#host.model().staticRenderers.get(node.kind)
    if (build === undefined)
      return this.#placeholder(node.kind)
    const view = build(this.#host.ownerDocument, node)
    view.update({ ...DESIGN_STATE, required: false })
    view.element.inert = true
    return view.element
  }

  #container(node: ContainerNode, document: FormDocument): HTMLElement {
    const doc = this.#host.ownerDocument
    const build = this.#host.model().containerRenderers.get(node.kind)
    if (build === undefined) {
      const frame = createAuthoredElement(doc, 'div', { 'data-part': 'list' }, [
        createAuthoredElement(doc, 'div', { 'data-part': 'list-title' }, [stringOf(node.basic.title) || this.#host.translations().kind(node.kind)]),
      ])
      for (const region of node.regions)
        frame.append(this.#region(region.id, region.children, document))
      return frame
    }
    const view = build(doc, node)
    view.update({ ...DESIGN_STATE, required: false })
    const resizable = spanRange(this.#host.model().registry, node.kind) !== undefined
    for (const region of node.regions)
      view.slots.get(region.id)!.append(this.#region(region.id, region.children, document, resizable))
    return view.element
  }

  #region(id: string, children: readonly FormNode[], document: FormDocument, resizable = false): HTMLElement {
    const region = createAuthoredElement(this.#host.ownerDocument, 'div', { 'data-part': 'region', 'data-region-id': id, 'data-form-region': true })
    this.#fill(region, id, children, document, resizable)
    return region
  }

  /** 把放置区的子节点调成这些节点的块：空区域放一行提示，可拖跨度时末尾是跨度把手，已有的提示与把手沿用。 */
  #fill(region: HTMLElement, id: string, children: readonly FormNode[], document: FormDocument, resizable: boolean): void {
    const doc = this.#host.ownerDocument
    const blocks = children.map(child => this.#node(child, document))
    if (blocks.length === 0)
      blocks.push(region.querySelector<HTMLElement>(':scope > [data-part="region-empty"]') ?? createAuthoredElement(doc, 'div', { 'data-part': 'region-empty' }, [this.#host.translations().emptyRegion]))
    if (resizable)
      blocks.push(region.querySelector<HTMLElement>(':scope > [data-part="span-handle"]') ?? createAuthoredElement(doc, 'div', { 'data-part': 'span-handle', 'aria-hidden': 'true' }))
    reconcile(region, blocks)
    this.#blocks.regions.set(id, region)
  }

  #placeholder(kind: string): HTMLElement {
    const placeholder = createAuthoredElement(this.#host.ownerDocument, 'div', { 'data-part': 'node-placeholder' })
    setText(placeholder, this.#host.translations().kind(kind))
    return placeholder
  }
}
