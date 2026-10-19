/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 页面结构面板的适配器：把模板排成树，树上的选中、标出、删除与挪动翻成编辑操作。
// 只有一个区域的容器省掉区域这一层，子节点直接挂在容器下；表格布局只列有内容的单元格。

import type { ContainerNode, FormDocument, FormNode, KindRegistry, Region } from '@xihan-form/core'
import type { FormDesignerTranslations } from '@xihan-form/runtime'
import type { IconRecord } from '@xihan-ui/core'
import type { DesignerOutlineAdapter, DesignerOutlineMove, DesignerOutlineNode } from '@xihan-ui/designer-shell'
import type { FormDesignerContext } from './commands'
import type { FormDropTarget } from './editor'
import { findNode, findRegion } from '@xihan-form/core'
import { createOutlinePanel } from '@xihan-ui/designer-shell'
import { ListTreeIcon } from '@xihan-ui/icons'
import { internalsOf } from './internals'

/** 表格布局与栅格的种类：区域行按「第几行第几列」「第几列」命名。 */
const TABLE_KIND = 'table'
const GRID_KIND = 'grid'

/** 节点名字下方的副文本：标签、标题或图例里第一个非空的。 */
function captionOf(node: FormNode): string | undefined {
  for (const name of ['label', 'title', 'legend']) {
    const value = node.basic[name]
    if (typeof value === 'string' && value.trim() !== '')
      return value
  }
  return undefined
}

/** 区域个数的上下限；种类没登记时按不限。 */
function regionLimits(registry: KindRegistry, container: ContainerNode): { readonly min: number, readonly max: number | null } {
  const definition = registry.get(container.kind)
  return definition?.type === 'container' ? definition.regions : { min: 1, max: null }
}

function numberOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** 区域行的名字：有标题用标题，表格布局写第几行第几列，栅格写第几列，其余写第几个区域。 */
function regionLabel(t: FormDesignerTranslations, container: ContainerNode, region: Region): string {
  const title = region.props.title
  if (typeof title === 'string' && title.trim() !== '')
    return title
  if (container.kind === TABLE_KIND)
    return t.outlineCell(numberOf(region.props.row) + 1, numberOf(region.props.column) + 1)
  const index = container.regions.indexOf(region) + 1
  return container.kind === GRID_KIND ? t.outlineColumn(index) : t.outlineRegion(index)
}

/**
 * 页面结构的树：顶层节点 → 容器 → 区域 → 节点。节点写「种类 · 数据键」，副文本是标签或标题，带种类的图标（有的话）；
 * 区域行不能挪，能不能删跟着工具栏删区域的规矩（表格布局不删、删完不少于下限）。
 */
export function formOutlineNodes(document: FormDocument, registry: KindRegistry, t: FormDesignerTranslations, icons: ReadonlyMap<string, IconRecord> = new Map()): DesignerOutlineNode[] {
  const node = (item: FormNode): DesignerOutlineNode => {
    const caption = captionOf(item)
    const icon = icons.get(item.kind)
    const base: DesignerOutlineNode = {
      id: item.id,
      label: t.nodeTag(item.kind, item.type === 'static' ? undefined : item.key),
      ...(caption === undefined ? {} : { description: caption }),
      ...(icon === undefined ? {} : { icon }),
    }
    if (item.type !== 'container')
      return base
    const limits = regionLimits(registry, item)
    if (limits.max === 1)
      return { ...base, children: (item.regions[0]?.children ?? []).map(node) }
    const regions = item.kind === TABLE_KIND ? item.regions.filter(region => region.children.length > 0) : item.regions
    const deletable = item.kind !== TABLE_KIND && item.regions.length > limits.min
    return {
      ...base,
      children: regions.map(region => ({ id: region.id, label: regionLabel(t, item, region), movable: false, deletable, children: region.children.map(node) })),
    }
  }
  return document.children.map(node)
}

/**
 * 树上的一次挪动换成编辑模型的放置位置：父行是区域就放进它，是省掉区域层的容器就放进它唯一的区域，顶层为 null；
 * 位次从「先摘后插」换成按挪动前的子节点计。父行放不进节点时为 undefined。
 */
export function formOutlineTarget(document: FormDocument, registry: KindRegistry, move: DesignerOutlineMove): FormDropTarget | undefined {
  let parent: string | null
  if (move.parent === null || findRegion(document, move.parent) !== undefined) {
    parent = move.parent
  }
  else {
    const owner = findNode(document, move.parent)?.node
    if (owner?.type !== 'container' || regionLimits(registry, owner).max !== 1 || owner.regions[0] === undefined)
      return undefined
    parent = owner.regions[0].id
  }
  const siblings = (parent === null ? document.children : findRegion(document, parent)!.region.children).map(child => child.id)
  const staying = siblings.filter(id => id !== move.id)
  const next = staying[move.index]
  return { parent, index: next === undefined ? siblings.length : siblings.indexOf(next) }
}

/** 表单的页面结构适配器：选中区域时选区域，否则选节点；删除先选中再走设计器的删除；挪动经编辑模型判定并执行。 */
export const FORM_OUTLINE_ADAPTER: DesignerOutlineAdapter<FormDesignerContext> = {
  nodes: ({ designer, translations }) => {
    const internals = internalsOf(designer)
    return formOutlineNodes(designer.schema, internals.registry(), translations, internals.kindIcons())
  },
  selection: ({ designer }) => {
    const selection = designer.getSelection()
    return (selection.regions?.length ?? 0) > 0 ? selection.regions! : selection.nodes
  },
  select: ({ designer }, ids) => {
    const first = ids[0]
    if (first === undefined)
      return
    if (findRegion(designer.schema, first) !== undefined) {
      designer.select({ regions: [...ids] })
      internalsOf(designer).revealRegion(first)
      return
    }
    designer.select({ nodes: [...ids] })
    designer.revealNode(first)
  },
  highlight: ({ designer }, id) => internalsOf(designer).highlight(id),
  remove: ({ designer }, ids) => {
    const regions = ids.filter(id => findRegion(designer.schema, id) !== undefined)
    designer.select(regions.length > 0 ? { regions } : { nodes: [...ids] })
    designer.deleteSelection()
  },
  canMove: ({ designer }, move) => {
    const internals = internalsOf(designer)
    const target = designer.readonly === true ? undefined : formOutlineTarget(designer.schema, internals.registry(), move)
    return target !== undefined && internals.editor().canDrop([move.id], target)
  },
  move: ({ designer }, move) => {
    const internals = internalsOf(designer)
    const target = designer.readonly === true ? undefined : formOutlineTarget(designer.schema, internals.registry(), move)
    if (target !== undefined)
      internals.editor().moveNodes([move.id], target)
  },
}

/** 页面结构面板：缺省在左栏物料下面；只读时能选、能标出，不能删、不能挪。 */
export const FORM_OUTLINE_PANEL = createOutlinePanel(FORM_OUTLINE_ADAPTER, {
  region: { icon: ListTreeIcon },
  readonly: ({ designer }) => designer.readonly === true,
})
