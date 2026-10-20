/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器的内置命令：工具栏、右键菜单与快捷键共用。能不能执行按当前选择、模式与只读判断，表格命令按当前文档试算；
// 右键菜单按选中的是节点、区域、表格布局的单元格还是什么都没选，取不同的缺省排列。

import type { FormDocument, KindRegistry } from '@xihan-form/core'
import type { FormDesignerTranslations } from '@xihan-form/runtime'
import type { DesignerCommand } from '@xihan-ui/designer-kit'
import type { DesignerCommandsTranslations, DesignerSettings, XhDesignerFrameElement } from '@xihan-ui/designer-shell'
import type { FormSelection } from './editor'
import type { XhFormDesigner } from './form-designer'
import type { FormDesignerInternals } from './internals'
import { findNode, findRegion, mergeTableCells, removeTableLine } from '@xihan-form/core'
import { designerHistoryCommands, designerPanelCommands, designerShellCommands } from '@xihan-ui/designer-shell'
import { ArrowDownIcon, ArrowUpIcon, CircleHelpIcon, ClipboardIcon, CopyIcon, CopyPlusIcon, CornerLeftUpIcon, EraserIcon, EyeIcon, FileCodeIcon, HandIcon, MapIcon, MonitorIcon, PanelLeftIcon, PencilIcon, RedoIcon, SaveIcon, ScissorsIcon, SettingsIcon, SmartphoneIcon, SquareDashedIcon, TableCellsMergeIcon, TableCellsSplitIcon, TableColumnInsertLeftIcon, TableColumnInsertRightIcon, TableColumnRemoveIcon, TableRowInsertAboveIcon, TableRowInsertBelowIcon, TableRowRemoveIcon, TabletIcon, TrashIcon, UndoIcon } from '@xihan-ui/icons'
import { internalsOf } from './internals'

/** 命令、面板与扩展装上时拿到的上下文。 */
export interface FormDesignerContext {
  /** 这个设计器实例。 */
  readonly designer: XhFormDesigner
  /** 此刻生效的设计器文案。 */
  readonly translations: FormDesignerTranslations
  /** 此刻生效的共用命令文案（designer-shell 语言包的 xh-designer-commands）：撤销、剪切、删除、设计与预览这些四款都有的命令。 */
  readonly commands: DesignerCommandsTranslations
  /** 此刻生效的设置：键是「分区 id.条目 id」，各分区没写的条目取了缺省值。 */
  readonly settings: DesignerSettings
  /** 设计器的外框：面板的开关经它；外框还没建出来时为 undefined。 */
  readonly frame: XhDesignerFrameElement | undefined
}

/** 设计器的命令。 */
export type FormDesignerCommand = DesignerCommand<FormDesignerContext>

/** 右键菜单落在哪类对象上：节点、区域、表格布局的单元格，或空白处。 */
export type FormMenuSubject = 'node' | 'region' | 'cell' | 'blank'

/** 表单文档站上设计器的一页，工具栏的「帮助」在新窗口打开它。 */
export const FORM_DESIGNER_HELP_URL = 'https://form.docs.xihanfun.com/guide/designer'

/** 设计器的面板 id：宿主写 defaultLayout、settingsPolicy（layout.panels.<面板 id>）时用；每块面板有一条开关命令 panel:<面板 id>。 */
export const FORM_DESIGNER_PANELS = {
  palette: 'palette',
  outline: 'outline',
  properties: 'properties',
  issues: 'issues',
  history: 'history',
} as const

/** 表格布局容器的种类，表格命令只认它。 */
const TABLE_KIND = 'table'

/** 工具栏的缺省排列；commandLayout 没写 toolbar 时用它，再把 placement 含 toolbar 的扩展命令追加成一组。 */
export const FORM_TOOLBAR_LAYOUT: readonly (readonly string[])[] = [
  ['undo', 'redo'],
  ['delete', 'duplicate'],
  ['design', 'preview'],
  ['pan-tool', 'width-full', 'width-tablet', 'width-phone'],
  ['panels', 'settings', 'help'],
]

/** 右键菜单各主体的缺省排列；commandLayout 没写 menu:<主体> 时用它。 */
export const FORM_MENU_LAYOUTS: Readonly<Record<FormMenuSubject, readonly (readonly string[])[]>> = {
  node: [['cut', 'copy', 'paste', 'duplicate'], ['select-parent', 'move-up', 'move-down'], ['delete']],
  region: [['paste'], ['select-parent'], ['delete']],
  cell: [['paste'], ['select-parent'], ['merge-cells', 'split-cell'], ['insert-row-above', 'insert-row-below', 'insert-column-left', 'insert-column-right'], ['remove-row', 'remove-column']],
  blank: [['paste'], ['edit-json']],
}

/** 选中工具条落在哪类选中上：眼下只有单个节点。 */
export type FormSelectionSubject = 'node'

/**
 * 选中工具条（命令落点 selection:<主体>）的缺省排列：选父级、上移、下移，创建副本、删除。
 * commandLayout 没写 selection:<主体> 时用它，再把 placement 含这个落点的扩展命令追加成一组。
 */
export const FORM_SELECTION_LAYOUTS: Readonly<Record<FormSelectionSubject, readonly (readonly string[])[]>> = {
  node: [['select-parent', 'move-up', 'move-down'], ['duplicate', 'delete']],
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

type SharedKey = { [K in keyof DesignerCommandsTranslations]: DesignerCommandsTranslations[K] extends string ? K : never }[keyof DesignerCommandsTranslations]

const shared = (key: SharedKey) => (context: FormDesignerContext): string => context.commands[key]

/** 只在可编辑时可用。 */
function editing(test: (state: CommandState) => boolean) {
  return (context: FormDesignerContext): boolean => {
    const state = stateOf(context)
    return state.edit && test(state)
  }
}

/** 内置命令。 */
export const FORM_COMMANDS: readonly FormDesignerCommand[] = Object.freeze([
  // designer-shell 的历史命令：撤销、重做的全名带上下一步的说明，重做另认 Ctrl+Y；清空历史先确认、不上工具栏
  ...designerHistoryCommands<FormDesignerContext>({
    history: ({ designer }) => internalsOf(designer).history(),
    disabled: ({ designer }) => designer.readonly === true,
    translations: context => context.commands,
    historyTranslations: ({ designer }) => internalsOf(designer).historyTranslations(),
    confirm: ({ designer }, options) => internalsOf(designer).confirm(options),
    announce: (context, message) => context.frame?.announce(message),
    icons: { undo: UndoIcon, redo: RedoIcon, clearHistory: EraserIcon },
  }),
  { id: 'copy', label: shared('copy'), icon: CopyIcon, enabled: context => stateOf(context).selection.nodes.length > 0, run: ({ designer }) => void designer.copy() },
  { id: 'cut', label: shared('cut'), icon: ScissorsIcon, enabled: editing(state => state.selection.nodes.length > 0), run: ({ designer }) => void designer.cut() },
  { id: 'paste', label: shared('paste'), icon: ClipboardIcon, enabled: context => context.designer.readonly !== true && context.designer.canPaste, run: ({ designer }) => void designer.paste() },
  { id: 'duplicate', label: shared('duplicate'), icon: CopyPlusIcon, shortcut: ['Mod', 'D'], enabled: editing(state => state.design && state.selection.nodes.length > 0), run: ({ designer }) => void designer.duplicate() },
  {
    id: 'delete',
    label: shared('delete'),
    icon: TrashIcon,
    tone: 'danger',
    shortcut: ['Delete'],
    enabled: editing(state => state.design && (state.regions.length > 0 ? regionsDeletable(state, state.internals.registry()) : state.selection.nodes.length > 0)),
    run: ({ designer }) => void designer.deleteSelection(),
  },
  {
    id: 'select-all',
    label: shared('selectAll'),
    icon: SquareDashedIcon,
    shortcut: ['Mod', 'A'],
    enabled: context => context.designer.schema.children.length > 0,
    run: ({ designer }) => designer.select({ nodes: designer.schema.children.map(node => node.id) }),
  },
  {
    id: 'select-parent',
    label: text('selectParent'),
    icon: CornerLeftUpIcon,
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
  { id: 'move-up', label: text('moveUp'), icon: ArrowUpIcon, enabled: editing(state => (soleNode(state)?.index ?? 0) > 0), run: context => stateOf(context).internals.moveSelected(-1) },
  {
    id: 'move-down',
    label: text('moveDown'),
    icon: ArrowDownIcon,
    enabled: editing((state) => {
      const sole = soleNode(state)
      return sole !== undefined && sole.index < sole.count - 1
    }),
    run: context => stateOf(context).internals.moveSelected(1),
  },
  {
    id: 'merge-cells',
    label: text('mergeCells'),
    icon: TableCellsMergeIcon,
    enabled: editing((state) => {
      const table = cellTable(state)
      return table !== undefined && state.regions.length >= 2 && feasible(() => mergeTableCells(state.document, table, state.regions))
    }),
    run: context => stateOf(context).internals.mergeCells(),
  },
  { id: 'split-cell', label: text('splitCell'), icon: TableCellsSplitIcon, enabled: editing(state => soleCell(state)?.spans === true), run: context => stateOf(context).internals.splitCell() },
  { id: 'insert-row-above', label: text('insertRowAbove'), icon: TableRowInsertAboveIcon, enabled: editing(state => soleCell(state) !== undefined), run: context => stateOf(context).internals.insertTableLine('row', false) },
  { id: 'insert-row-below', label: text('insertRowBelow'), icon: TableRowInsertBelowIcon, enabled: editing(state => soleCell(state) !== undefined), run: context => stateOf(context).internals.insertTableLine('row', true) },
  { id: 'insert-column-left', label: text('insertColumnLeft'), icon: TableColumnInsertLeftIcon, enabled: editing(state => soleCell(state) !== undefined), run: context => stateOf(context).internals.insertTableLine('column', false) },
  { id: 'insert-column-right', label: text('insertColumnRight'), icon: TableColumnInsertRightIcon, enabled: editing(state => soleCell(state) !== undefined), run: context => stateOf(context).internals.insertTableLine('column', true) },
  {
    id: 'remove-row',
    label: text('removeRow'),
    icon: TableRowRemoveIcon,
    tone: 'danger',
    enabled: editing((state) => {
      const cell = soleCell(state)
      return cell !== undefined && feasible(() => removeTableLine(state.document, cell.table, 'row', cell.row))
    }),
    run: context => stateOf(context).internals.removeTableLine('row'),
  },
  {
    id: 'remove-column',
    label: text('removeColumn'),
    icon: TableColumnRemoveIcon,
    tone: 'danger',
    enabled: editing((state) => {
      const cell = soleCell(state)
      return cell !== undefined && feasible(() => removeTableLine(state.document, cell.table, 'column', cell.column))
    }),
    run: context => stateOf(context).internals.removeTableLine('column'),
  },
  { id: 'design', label: shared('design'), icon: PencilIcon, checked: ({ designer }) => (designer.mode ?? 'design') === 'design', run: context => stateOf(context).internals.setMode('design') },
  { id: 'preview', label: shared('preview'), icon: EyeIcon, checked: ({ designer }) => designer.mode === 'preview', run: context => stateOf(context).internals.setMode('preview') },
  { id: 'width-full', label: text('widthFull'), icon: MonitorIcon, checked: ({ designer }) => (designer.previewWidth ?? 'full') === 'full', run: ({ designer }) => void (designer.previewWidth = 'full') },
  { id: 'width-tablet', label: text('widthTablet'), icon: TabletIcon, checked: ({ designer }) => designer.previewWidth === 'tablet', run: ({ designer }) => void (designer.previewWidth = 'tablet') },
  { id: 'width-phone', label: text('widthPhone'), icon: SmartphoneIcon, checked: ({ designer }) => designer.previewWidth === 'phone', run: ({ designer }) => void (designer.previewWidth = 'phone') },
  { id: 'save', label: text('save'), icon: SaveIcon, shortcut: ['Mod', 'S'], run: context => stateOf(context).internals.save() },
  // designer-shell 内置的面板、设置与帮助，文案取共用的那一桶；每块面板另有一条开关命令
  ...designerShellCommands<FormDesignerContext>({
    translations: context => context.commands,
    frame: context => context.frame,
    openSettings: ({ designer }) => designer.openSettings(),
    helpUrl: () => FORM_DESIGNER_HELP_URL,
    startTour: ({ designer }) => designer.startTour(),
    openJsonEditor: ({ designer }) => designer.openJsonEditor(),
    icons: { panels: PanelLeftIcon, settings: SettingsIcon, help: CircleHelpIcon, startTour: MapIcon, editJson: FileCodeIcon, panTool: HandIcon },
  }),
  // 页面结构与历史记录是内置扩展登记的面板，它们的开关命令随扩展面板一起生成
  ...designerPanelCommands<FormDesignerContext>({ panels: [FORM_DESIGNER_PANELS.palette, FORM_DESIGNER_PANELS.properties, FORM_DESIGNER_PANELS.issues], frame: context => context.frame }),
] satisfies FormDesignerCommand[])
