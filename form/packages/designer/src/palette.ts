/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 物料与拖放的数据：按种类登记表排出物料分组，判断拖来的数据是物料还是画布上的节点。

import type { KindRegistry } from '@xihan-form/core'
import type { FormDesignerTranslations } from '@xihan-form/runtime'
import type { DesignerPaletteGroup, DesignerPaletteItem } from '@xihan-ui/designer-shell'

/** 物料随 item-activate 与拖动交出的数据。 */
export interface FormPalettePayload {
  readonly kind: string
}

/** 从画布上拖动节点时的数据；owner 是发起拖动的设计器，只在同一个设计器里放下。 */
export interface FormCanvasDragPayload {
  readonly source: 'form-canvas'
  readonly owner: object
  readonly nodes: readonly string[]
}

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

/** 物料数据里的种类；不是表单物料时为 undefined。 */
export function paletteKind(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null)
    return undefined
  const kind = (payload as Partial<FormPalettePayload>).kind
  return typeof kind === 'string' ? kind : undefined
}

/** 拖来的数据：表单物料给出种类，本设计器画布上的节点给出 id。 */
export function dragSubject(payload: unknown, owner: object): { readonly kind: string } | { readonly nodes: readonly string[] } | undefined {
  if (typeof payload !== 'object' || payload === null)
    return undefined
  const value = payload as { source?: unknown, payload?: unknown, owner?: unknown, nodes?: unknown }
  if (value.source === 'palette') {
    const kind = paletteKind(value.payload)
    return kind === undefined ? undefined : { kind }
  }
  if (value.source === 'form-canvas' && value.owner === owner && Array.isArray(value.nodes))
    return { nodes: value.nodes.filter((id): id is string => typeof id === 'string') }
  return undefined
}
