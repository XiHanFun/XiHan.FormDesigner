/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的内置命令：工具栏、右键菜单与快捷键共用。能不能执行按当前选择、模式与只读判断，表格命令按当前文档试算；
// 右键菜单按选中的是节点、区域、表格布局的单元格还是什么都没选，取不同的缺省排列。

import type { FormDocument, KindRegistry } from '@xihan-form/core'
import type { FormDesignerTranslations } from '@xihan-form/runtime'
import type { DesignerCommand } from '@xihan-ui/designer-kit'
import type { FormSelection } from './editor'
import type { XhFormDesigner } from './form-designer'
import type { FormDesignerInternals } from './internals'
import { findNode, findRegion, mergeTableCells, removeTableLine } from '@xihan-form/core'
import { internalsOf } from './internals'

/** 命令、面板与扩展装上时拿到的上下文。 */
export interface FormDesignerContext {
  readonly designer: XhFormDesigner
  /** 此刻生效的设计器文案。 */
  readonly translations: FormDesignerTranslations
}

/** 设计器的命令。 */
export type FormDesignerCommand = DesignerCommand<FormDesignerContext>

/** 右键菜单落在哪类对象上：节点、区域、表格布局的单元格，或空白处。 */
export type FormMenuSubject = 'node' | 'region' | 'cell' | 'blank'

/** 表格布局容器的种类，表格命令只认它。 */
const TABLE_KIND = 'table'

/** 删除一类的内置命令：右键菜单里以 danger 语气显示。 */
export const DANGER_COMMANDS: ReadonlySet<string> = new Set(['delete', 'remove-row', 'remove-column'])

/** 工具栏的缺省排列；commandLayout 没写 toolbar 时用它，再把 placement 含 toolbar 的扩展命令追加成一组。 */
export const FORM_TOOLBAR_LAYOUT: readonly (readonly string[])[] = [
  ['undo', 'redo'],
  ['delete', 'duplicate'],
  ['design', 'preview'],
  ['width-full', 'width-tablet', 'width-phone'],
]

/** 右键菜单各主体的缺省排列；commandLayout 没写 menu:<主体> 时用它。 */
export const FORM_MENU_LAYOUTS: Readonly<Record<FormMenuSubject, readonly (readonly string[])[]>> = {
  node: [['copy', 'cut', 'paste', 'duplicate'], ['select-parent', 'move-up', 'move-down'], ['delete']],
  region: [['paste'], ['select-parent'], ['delete']],
  cell: [['paste'], ['select-parent'], ['merge-cells', 'split-cell'], ['insert-row-above', 'insert-row-below', 'insert-column-left', 'insert-column-right'], ['remove-row', 'remove-column']],
  blank: [['paste']],
}

/** 当前选择对应的右键菜单主体。 */
export function menuSubject(document: FormDocument, selection: FormSelection): FormMenuSubject {
  const region = selection.regions?.[0]
  if (region !== undefined)
    return findRegion(document, region)?.container.kind === TABLE_KIND ? 'cell' : 'region'
  return selection.nodes.length > 0 ? 'node' : 'blank'
}

/** 命令此刻要看的设计器状态。 */
interface CommandState {
  readonly document: FormDocument
  readonly selection: FormSelection
  readonly regions: readonly string[]
  readonly edit: boolean
  readonly design: boolean
  readonly internals: FormDesignerInternals
}

function stateOf({ designer }: FormDesignerContext): CommandState {
  const selection = designer.getSelection()
  return {
    document: designer.schema,
    selection,
    regions: selection.regions ?? [],
    edit: designer.readonly !== true,
    design: (designer.mode ?? 'design') === 'design',
    internals: internalsOf(designer),
  }
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

/** 唯一选中的节点在同一层里的位置。 */
function soleNode(state: CommandState): { readonly index: number, readonly count: number } | undefined {
  if (state.selection.nodes.length !== 1 || state.regions.length > 0)
    return undefined
  const found = findNode(state.document, state.selection.nodes[0]!)
  return found === undefined ? undefined : { index: found.index, count: (found.region === null ? state.document.children : found.region.children).length }
}

/** 选中的区域能不能删：不是表格布局，删完不少于容器的区域下限。 */
function regionsDeletable(state: CommandState, registry: KindRegistry): boolean {
  const found = state.regions[0] === undefined ? undefined : findRegion(state.document, state.regions[0])
  if (found === undefined || found.container.kind === TABLE_KIND)
    return false
  const definition = registry.get(found.container.kind)
  const min = definition?.type === 'container' ? definition.regions.min : 1
  return found.container.regions.length - state.regions.length >= min
}

/** 唯一选中的表格单元格：所在表格与它的行列和跨度。 */
function soleCell(state: CommandState): { readonly table: string, readonly row: number, readonly column: number, readonly spans: boolean } | undefined {
  if (state.regions.length !== 1)
    return undefined
  const found = findRegion(state.document, state.regions[0]!)
  if (found === undefined || found.container.kind !== TABLE_KIND)
    return undefined
  const props = found.region.props
  return {
    table: found.container.id,
    row: numberOf(props.row, 0),
    column: numberOf(props.column, 0),
    spans: numberOf(props.rowSpan, 1) > 1 || numberOf(props.columnSpan, 1) > 1,
  }
}

/** 选中的单元格所在的表格；没有选单元格时为 undefined。 */
function cellTable(state: CommandState): string | undefined {
  const found = state.regions[0] === undefined ? undefined : findRegion(state.document, state.regions[0])
  return found?.container.kind === TABLE_KIND ? found.container.id : undefined
}

type TextKey = { [K in keyof FormDesignerTranslations]: FormDesignerTranslations[K] extends string ? K : never }[keyof FormDesignerTranslations]

const text = (key: TextKey) => (context: FormDesignerContext): string => context.translations[key]

/** 只在可编辑时可用。 */
function editing(test: (state: CommandState) => boolean) {
  return (context: FormDesignerContext): boolean => {
    const state = stateOf(context)
    return state.edit && test(state)
  }
}

/** 内置命令。 */
export const FORM_COMMANDS: readonly FormDesignerCommand[] = Object.freeze([
  { id: 'undo', label: text('undo'), shortcut: ['Mod', 'Z'], enabled: context => context.designer.readonly !== true && context.designer.canUndo, run: ({ designer }) => void designer.undo() },
  { id: 'redo', label: text('redo'), shortcut: ['Mod', 'Shift', 'Z'], enabled: context => context.designer.readonly !== true && context.designer.canRedo, run: ({ designer }) => void designer.redo() },
  { id: 'copy', label: text('copy'), enabled: context => stateOf(context).selection.nodes.length > 0, run: ({ designer }) => void designer.copy() },
  { id: 'cut', label: text('cut'), enabled: editing(state => state.selection.nodes.length > 0), run: ({ designer }) => void designer.cut() },
  { id: 'paste', label: text('paste'), enabled: context => context.designer.readonly !== true && context.designer.canPaste, run: ({ designer }) => void designer.paste() },
  { id: 'duplicate', label: text('duplicate'), shortcut: ['Mod', 'D'], enabled: editing(state => state.design && state.selection.nodes.length > 0), run: ({ designer }) => void designer.duplicate() },
  {
    id: 'delete',
    label: text('delete'),
    shortcut: ['Delete'],
    enabled: editing(state => state.design && (state.regions.length > 0 ? regionsDeletable(state, state.internals.registry()) : state.selection.nodes.length > 0)),
    run: ({ designer }) => void designer.deleteSelection(),
  },
  {
    id: 'select-all',
    label: text('selectAll'),
    shortcut: ['Mod', 'A'],
    enabled: context => context.designer.schema.children.length > 0,
    run: ({ designer }) => designer.select({ nodes: designer.schema.children.map(node => node.id) }),
  },
  {
    id: 'select-parent',
    label: text('selectParent'),
    enabled: (context) => {
      const state = stateOf(context)
      if (state.regions.length > 0)
        return true
      const last = state.selection.nodes.at(-1)
      const found = last === undefined ? undefined : findNode(state.document, last)
      return found !== undefined && found.region !== null
    },
    run: context => stateOf(context).internals.selectParent(),
  },
  { id: 'move-up', label: text('moveUp'), enabled: editing(state => (soleNode(state)?.index ?? 0) > 0), run: context => stateOf(context).internals.moveSelected(-1) },
  {
    id: 'move-down',
    label: text('moveDown'),
    enabled: editing((state) => {
      const sole = soleNode(state)
      return sole !== undefined && sole.index < sole.count - 1
    }),
    run: context => stateOf(context).internals.moveSelected(1),
  },
  {
    id: 'merge-cells',
    label: text('mergeCells'),
    enabled: editing((state) => {
      const table = cellTable(state)
      return table !== undefined && state.regions.length >= 2 && feasible(() => mergeTableCells(state.document, table, state.regions))
    }),
    run: context => stateOf(context).internals.mergeCells(),
  },
  { id: 'split-cell', label: text('splitCell'), enabled: editing(state => soleCell(state)?.spans === true), run: context => stateOf(context).internals.splitCell() },
  { id: 'insert-row-above', label: text('insertRowAbove'), enabled: editing(state => soleCell(state) !== undefined), run: context => stateOf(context).internals.insertTableLine('row', false) },
  { id: 'insert-row-below', label: text('insertRowBelow'), enabled: editing(state => soleCell(state) !== undefined), run: context => stateOf(context).internals.insertTableLine('row', true) },
  { id: 'insert-column-left', label: text('insertColumnLeft'), enabled: editing(state => soleCell(state) !== undefined), run: context => stateOf(context).internals.insertTableLine('column', false) },
  { id: 'insert-column-right', label: text('insertColumnRight'), enabled: editing(state => soleCell(state) !== undefined), run: context => stateOf(context).internals.insertTableLine('column', true) },
  {
    id: 'remove-row',
    label: text('removeRow'),
    enabled: editing((state) => {
      const cell = soleCell(state)
      return cell !== undefined && feasible(() => removeTableLine(state.document, cell.table, 'row', cell.row))
    }),
    run: context => stateOf(context).internals.removeTableLine('row'),
  },
  {
    id: 'remove-column',
    label: text('removeColumn'),
    enabled: editing((state) => {
      const cell = soleCell(state)
      return cell !== undefined && feasible(() => removeTableLine(state.document, cell.table, 'column', cell.column))
    }),
    run: context => stateOf(context).internals.removeTableLine('column'),
  },
  { id: 'design', label: text('design'), checked: ({ designer }) => (designer.mode ?? 'design') === 'design', run: context => stateOf(context).internals.setMode('design') },
  { id: 'preview', label: text('preview'), checked: ({ designer }) => designer.mode === 'preview', run: context => stateOf(context).internals.setMode('preview') },
  { id: 'width-full', label: text('widthFull'), checked: ({ designer }) => (designer.previewWidth ?? 'full') === 'full', run: ({ designer }) => void (designer.previewWidth = 'full') },
  { id: 'width-tablet', label: text('widthTablet'), checked: ({ designer }) => designer.previewWidth === 'tablet', run: ({ designer }) => void (designer.previewWidth = 'tablet') },
  { id: 'width-phone', label: text('widthPhone'), checked: ({ designer }) => designer.previewWidth === 'phone', run: ({ designer }) => void (designer.previewWidth = 'phone') },
  { id: 'save', label: text('save'), shortcut: ['Mod', 'S'], run: context => stateOf(context).internals.save() },
] satisfies FormDesignerCommand[])
