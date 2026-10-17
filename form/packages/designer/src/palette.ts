/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 物料与拖放的数据：按种类登记表排出物料分组，判断拖来的数据是新建某种类、一段片段，还是画布上的节点。

import type { KindRegistry } from '@xihan-form/core'
import type { FormDesignerTranslations } from '@xihan-form/runtime'
import type { DesignerPaletteGroup, DesignerPaletteItem } from '@xihan-ui/designer-shell'
import type { FormClipboard } from './editor'

/** 物料随 item-activate 与拖动交出的数据：新建某个种类，或插入一段片段（如模板库里的一组字段）。 */
export type FormPalettePayload = { readonly kind: string } | { readonly clipboard: FormClipboard }

/** 从画布上拖动节点时的数据；owner 是发起拖动的设计器，只在同一个设计器里放下。 */
export interface FormCanvasDragPayload {
  readonly source: 'form-canvas'
  readonly owner: object
  readonly nodes: readonly string[]
}

/** 拖放片段：任意来源（如扩展的模板库面板）经 startDrag 交来的一段节点，松手时按粘贴的规则换 id 插入。 */
export interface FormFragmentDragPayload {
  readonly source: 'form-clipboard'
  readonly clipboard: FormClipboard
}

/** 拖来的东西：新建的种类、未经检查的片段，或本设计器画布上的节点。 */
export type FormDragSubject = { readonly kind: string } | { readonly clipboard: unknown } | { readonly nodes: readonly string[] }

/** 按种类的 category 分组，组与组内都按登记顺序；名称取文案。 */
export function paletteGroups(registry: KindRegistry, t: FormDesignerTranslations): DesignerPaletteGroup[] {
  const groups = new Map<string, DesignerPaletteItem[]>()
  for (const definition of registry.list()) {
    const items = groups.get(definition.category) ?? []
    items.push({ id: definition.kind, label: t.kind(definition.kind), payload: { kind: definition.kind } satisfies FormPalettePayload })
    groups.set(definition.category, items)
  }
  return [...groups].map(([category, items]) => ({ id: category, label: t.category(category), items }))
}

/** 物料数据里的种类；不是新建种类的物料时为 undefined。 */
export function paletteKind(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null)
    return undefined
  const kind = (payload as { kind?: unknown }).kind
  return typeof kind === 'string' ? kind : undefined
}

/** 物料数据：新建的种类，或未经检查的片段；都不是时为 undefined。 */
export function paletteSubject(payload: unknown): { readonly kind: string } | { readonly clipboard: unknown } | undefined {
  const kind = paletteKind(payload)
  if (kind !== undefined)
    return { kind }
  if (typeof payload === 'object' && payload !== null && 'clipboard' in payload)
    return { clipboard: payload.clipboard }
  return undefined
}

/** 拖来的数据：物料给出种类或片段，form-clipboard 给出片段，本设计器画布上的节点给出 id。 */
export function dragSubject(payload: unknown, owner: object): FormDragSubject | undefined {
  if (typeof payload !== 'object' || payload === null)
    return undefined
  const value = payload as { source?: unknown, payload?: unknown, owner?: unknown, nodes?: unknown, clipboard?: unknown }
  if (value.source === 'palette')
    return paletteSubject(value.payload)
  if (value.source === 'form-clipboard')
    return { clipboard: value.clipboard }
  if (value.source === 'form-canvas' && value.owner === owner && Array.isArray(value.nodes))
    return { nodes: value.nodes.filter((id): id is string => typeof id === 'string') }
  return undefined
}
