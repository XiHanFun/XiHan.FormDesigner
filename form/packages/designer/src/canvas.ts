/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计画布：按模板所见即所得地排出表单。字段用渲染器的字段渲染器与字段外壳画，控件不可交互；
// 容器与静态元素用渲染器的部件树；每个节点一块可选中的外框，容器的每个区域是一块放置区。

import type { ContainerNode, FieldNode, FormDocument, FormNode, KindRegistry, StaticNode } from '@xihan-form/core'
import type { FieldRenderer, FieldRendererContext, FieldRendererInstance, FieldSize, FormDesignerTranslations, FormRendererTranslations, OptionItem } from '@xihan-form/runtime'
import type { FormDropTarget, FormSelection } from './editor'
import { isValueOfKind } from '@xihan-form/core'
import { FORM_FIELD_RENDERERS } from '@xihan-form/runtime'
import { CONTAINER_BUILDERS, createFieldShell, STATIC_BUILDERS } from '@xihan-form/runtime/design'
import { createAuthoredElement, setAttributes, setText } from '@xihan-ui/web-components/authoring'

/** 画布需要设计器提供的能力与配置。 */
export interface CanvasHost {
  readonly ownerDocument: Document
  readonly registry: () => KindRegistry
  readonly fieldRenderers: () => Readonly<Record<string, FieldRenderer>> | undefined
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

/** 容器的区域属性里有数字的 span 时，区域可以拖右缘改跨度，返回总列数（span 的上限）；否则为 undefined。 */
export function spanColumns(registry: KindRegistry, kind: string): number | undefined {
  const definition = registry.get(kind)
  const span = definition?.type === 'container' ? definition.regionProperties.find(descriptor => descriptor.path.length === 1 && descriptor.path[0] === 'span') : undefined
  return span?.control.kind === 'number' ? span.control.max ?? undefined : undefined
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

/** 设计画布：整份文档变化时重排，选择变化时只改选中标记。 */
export class DesignCanvas {
  /** 画布表面：一个只用于排版的 <xh-form>，标签位置随表单设置。 */
  readonly element: HTMLElement
  readonly #host: CanvasHost
  readonly #root: HTMLFormElement
  #nodes = new Map<string, HTMLElement>()
  #regions = new Map<string, HTMLElement>()
  #instances: FieldRendererInstance[] = []

  constructor(host: CanvasHost) {
    this.#host = host
    const doc = host.ownerDocument
    this.#root = createAuthoredElement(doc, 'form', { 'data-xh-part': 'root', 'novalidate': true })
    this.element = createAuthoredElement(doc, 'xh-form', { 'validate-on': 'submit', 'data-part': 'surface' }, [this.#root])
  }

  /** 按文档重排整个画布。 */
  render(document: FormDocument): void {
    for (const instance of this.#instances)
      instance.destroy?.()
    this.#instances = []
    this.#nodes = new Map()
    this.#regions = new Map()
    ;(this.element as HTMLElement & { layout?: string }).layout = document.settings.labelPlacement === 'start' ? 'horizontal' : 'vertical'
    const children = document.children.map(node => this.#node(node, document))
    if (children.length === 0)
      children.push(createAuthoredElement(this.#host.ownerDocument, 'div', { 'data-part': 'canvas-empty' }, [this.#host.translations().emptyCanvas]))
    this.#root.replaceChildren(...children)
  }

  /** 把选中标记落到节点与区域上。 */
  select(selection: FormSelection): void {
    const nodes = new Set(selection.nodes)
    const regions = new Set(selection.regions ?? [])
    for (const [id, element] of this.#nodes)
      setAttributes(element, { 'data-selected': nodes.has(id) })
    for (const [id, element] of this.#regions)
      setAttributes(element, { 'data-selected': regions.has(id) })
  }

  /** 节点的外框；不在画布上时为 undefined。 */
  nodeElement(id: string): HTMLElement | undefined {
    return this.#nodes.get(id)
  }

  /** 区域的放置区；不在画布上时为 undefined。 */
  regionElement(id: string): HTMLElement | undefined {
    return this.#regions.get(id)
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
    const doc = this.#host.ownerDocument
    const t = this.#host.translations()
    const key = node.type === 'static' ? undefined : stringOf((node as { key?: unknown }).key)
    const tag = createAuthoredElement(doc, 'div', { 'data-part': 'node-tag', 'aria-hidden': 'true' }, [t.nodeTag(node.kind, key)])
    const body = createAuthoredElement(doc, 'div', { 'data-part': 'node-body' }, [this.#content(node, document)])
    const block = createAuthoredElement(doc, 'div', { 'data-part': 'node', 'data-node-id': node.id, 'data-node-type': node.type, 'data-kind': node.kind }, [tag, body])
    this.#nodes.set(node.id, block)
    return block
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
    const custom = this.#host.fieldRenderers()
    const renderer = (custom && Object.hasOwn(custom, node.kind) ? custom[node.kind] : undefined)
      ?? (Object.hasOwn(FORM_FIELD_RENDERERS, node.kind) ? FORM_FIELD_RENDERERS[node.kind] : undefined)
    if (renderer === undefined)
      return this.#placeholder(node.kind)
    const instance = renderer(this.#context(node))
    this.#instances.push(instance)
    const shell = createFieldShell(doc, node, instance.element)
    shell.update(this.#context(node))
    shell.element.inert = true
    return shell.element
  }

  #context(node: FieldNode): FieldRendererContext {
    const definition = this.#host.registry().get(node.kind)
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
      size: (stringOf(node.appearance.size) ?? 'md') as FieldSize,
      translations: this.#host.rendererTranslations(),
      setValue: () => {},
      commit: () => {},
    }
  }

  #static(node: StaticNode): HTMLElement {
    const build = Object.hasOwn(STATIC_BUILDERS, node.kind) ? STATIC_BUILDERS[node.kind] : undefined
    if (build === undefined)
      return this.#placeholder(node.kind)
    const view = build(this.#host.ownerDocument, node)
    view.update({ ...DESIGN_STATE, required: false })
    view.element.inert = true
    return view.element
  }

  #container(node: ContainerNode, document: FormDocument): HTMLElement {
    const doc = this.#host.ownerDocument
    const build = Object.hasOwn(CONTAINER_BUILDERS, node.kind) ? CONTAINER_BUILDERS[node.kind] : undefined
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
    const resizable = spanColumns(this.#host.registry(), node.kind) !== undefined
    for (const region of node.regions)
      view.slots.get(region.id)!.append(this.#region(region.id, region.children, document, resizable))
    return view.element
  }

  #region(id: string, children: readonly FormNode[], document: FormDocument, resizable = false): HTMLElement {
    const doc = this.#host.ownerDocument
    const blocks = children.map(child => this.#node(child, document))
    if (blocks.length === 0)
      blocks.push(createAuthoredElement(doc, 'div', { 'data-part': 'region-empty' }, [this.#host.translations().emptyRegion]))
    if (resizable)
      blocks.push(createAuthoredElement(doc, 'div', { 'data-part': 'span-handle', 'aria-hidden': 'true' }))
    const region = createAuthoredElement(doc, 'div', { 'data-part': 'region', 'data-region-id': id, 'data-form-region': true }, blocks)
    this.#regions.set(id, region)
    return region
  }

  #placeholder(kind: string): HTMLElement {
    const placeholder = createAuthoredElement(this.#host.ownerDocument, 'div', { 'data-part': 'node-placeholder' })
    setText(placeholder, this.#host.translations().kind(kind))
    return placeholder
  }
}
