/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 内建右键菜单的条目：按当前选择列出命令。选中节点时是剪贴板、层级与删除；选中区域时是粘贴、选父级与删除，
// 表格布局的单元格另有合并、拆分与插入删除行列；什么都没选时只有粘贴。能不能执行按编辑模型与表格命令判断。

import type { FormDocument, KindRegistry } from '@xihan-form/core'
import type { FormDesignerTranslations } from '@xihan-form/runtime'
import type { FormSelection } from './editor'
import { findNode, findRegion, mergeTableCells, removeTableLine } from '@xihan-form/core'

/** 菜单命令。 */
export type MenuCommand
  = | 'copy' | 'cut' | 'paste' | 'duplicate' | 'delete'
    | 'select-parent' | 'move-up' | 'move-down'
    | 'merge-cells' | 'split-cell'
    | 'insert-row-above' | 'insert-row-below' | 'insert-column-left' | 'insert-column-right'
    | 'remove-row' | 'remove-column'

/** 菜单里的一条。 */
export interface MenuEntry {
  readonly value: MenuCommand
  readonly disabled: boolean
  /** 删除一类命令为 danger。 */
  readonly tone?: 'danger'
  /** 这一条之前画一条分隔线。 */
  readonly separatorBefore?: boolean
}

/** 列菜单要用到的状态。 */
export interface MenuContext {
  readonly document: FormDocument
  readonly registry: KindRegistry
  readonly selection: FormSelection
  readonly readonly: boolean
  readonly canPaste: boolean
}

/** 表格布局容器的种类，表格命令只认它。 */
const TABLE_KIND = 'table'

const LABELS: Readonly<Record<MenuCommand, keyof FormDesignerTranslations>> = {
  'copy': 'copy',
  'cut': 'cut',
  'paste': 'paste',
  'duplicate': 'duplicate',
  'delete': 'delete',
  'select-parent': 'selectParent',
  'move-up': 'moveUp',
  'move-down': 'moveDown',
  'merge-cells': 'mergeCells',
  'split-cell': 'splitCell',
  'insert-row-above': 'insertRowAbove',
  'insert-row-below': 'insertRowBelow',
  'insert-column-left': 'insertColumnLeft',
  'insert-column-right': 'insertColumnRight',
  'remove-row': 'removeRow',
  'remove-column': 'removeColumn',
}

/** 命令的文案。 */
export function menuLabel(command: MenuCommand, t: FormDesignerTranslations): string {
  return t[LABELS[command]] as string
}

/** 表格命令按当前文档试算一遍，算得出来才可执行。 */
function feasible(run: () => unknown): boolean {
  try {
    run()
    return true
  }
  catch {
    return false
  }
}

function numberOf(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function nodeEntries(context: MenuContext): MenuEntry[] {
  const { document, selection } = context
  const edit = !context.readonly
  const last = findNode(document, selection.nodes.at(-1)!)
  const single = selection.nodes.length === 1
  const count = last === undefined ? 0 : (last.region === null ? document.children : last.region.children).length
  return [
    { value: 'copy', disabled: false },
    { value: 'cut', disabled: !edit },
    { value: 'paste', disabled: !edit || !context.canPaste },
    { value: 'duplicate', disabled: !edit },
    { value: 'select-parent', disabled: last === undefined || last.region === null, separatorBefore: true },
    { value: 'move-up', disabled: !edit || !single || last === undefined || last.index === 0 },
    { value: 'move-down', disabled: !edit || !single || last === undefined || last.index >= count - 1 },
    { value: 'delete', disabled: !edit, tone: 'danger', separatorBefore: true },
  ]
}

function regionEntries(context: MenuContext, regions: readonly string[]): MenuEntry[] {
  const { document } = context
  const edit = !context.readonly
  const found = findRegion(document, regions[0]!)
  if (found === undefined)
    return []
  const { container, region } = found
  const definition = context.registry.get(container.kind)
  const min = definition?.type === 'container' ? definition.regions.min : 1
  const table = container.kind === TABLE_KIND
  const entries: MenuEntry[] = [
    { value: 'paste', disabled: !edit || !context.canPaste },
    { value: 'select-parent', disabled: false, separatorBefore: true },
  ]
  if (table) {
    const single = regions.length === 1
    const row = numberOf(region.props.row, 0)
    const column = numberOf(region.props.column, 0)
    const spans = numberOf(region.props.rowSpan, 1) > 1 || numberOf(region.props.columnSpan, 1) > 1
    entries.push(
      { value: 'merge-cells', disabled: !edit || regions.length < 2 || !feasible(() => mergeTableCells(document, container.id, regions)), separatorBefore: true },
      { value: 'split-cell', disabled: !edit || !single || !spans },
      { value: 'insert-row-above', disabled: !edit || !single, separatorBefore: true },
      { value: 'insert-row-below', disabled: !edit || !single },
      { value: 'insert-column-left', disabled: !edit || !single },
      { value: 'insert-column-right', disabled: !edit || !single },
      { value: 'remove-row', disabled: !edit || !single || !feasible(() => removeTableLine(document, container.id, 'row', row)), tone: 'danger', separatorBefore: true },
      { value: 'remove-column', disabled: !edit || !single || !feasible(() => removeTableLine(document, container.id, 'column', column)), tone: 'danger' },
    )
    return entries
  }
  entries.push({ value: 'delete', disabled: !edit || container.regions.length - regions.length < min, tone: 'danger', separatorBefore: true })
  return entries
}

/** 按当前选择列出菜单条目。 */
export function menuEntries(context: MenuContext): MenuEntry[] {
  const regions = context.selection.regions ?? []
  if (regions.length > 0)
    return regionEntries(context, regions)
  if (context.selection.nodes.length > 0)
    return nodeEntries(context)
  return [{ value: 'paste', disabled: context.readonly || !context.canPaste }]
}
