/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// <xh-form-designer>：表单设计器。编辑模型在 editor.ts，画布在 canvas.ts；版式交给 <xh-designer-frame>：
// 物料、属性与问题列表是面板，停靠、显隐与大小按设置里的布局，画布常驻。预览态换成 <xh-form-renderer>，只留工具栏。
// 设置对话框（openSettings()）里是基础分区与各扩展的分区，值经 settings 与 settings-change 交给宿主。

import type { FormDocument, FormNode, FormOperation, FormSchemaIssue, RuleList } from '@xihan-form/core'
import type { FileUploader, FormDesignerTranslations, FormRendererTranslations, OptionLoader, XhFormRenderer } from '@xihan-form/runtime'
import type { JsonPath, JsonValue } from '@xihan-ui/core/json'
import type { VisualEnvironmentStorageError } from '@xihan-ui/core/visual-environment'
import type { ExecuteOptions, ExtensionHost, HistorySnapshot } from '@xihan-ui/designer-kit'
import type { PropertySwatchOption } from '@xihan-ui/designer-kit/properties'
import type { CommandToolbar, DesignerCommandLayout, DesignerCommandsTranslations, DesignerFrameEventMap, DesignerFrameRegion, DesignerHistoryTranslations, DesignerIssuesEventMap, DesignerLayout, DesignerLayoutPolicy, DesignerPaletteEventMap, DesignerPanelHost, DesignerPropertiesEventMap, DesignerPropertyDescriptor, DesignerSettings, DesignerSettingsEventMap, DesignerSettingsHost, DesignerSettingsPolicy, DesignerSettingsSection, DesignerStatusItem, PanRequestDetail } from '@xihan-ui/designer-shell'
import type { ExpressionEngine } from '@xihan-ui/expression'
import type { PointerSession } from '@xihan-ui/pointer'
import type { PropertyValues } from '@xihan-ui/web-components/authoring'
import type { DialogService } from '@xihan-ui/web-components/services'
import type { CanvasDrop, CanvasTarget } from './canvas'
import type { FormDesignerContext } from './commands'
import type { FormClipboard, FormDropTarget, FormEditor, FormSelection } from './editor'
import type { FormDesignerExtension, FormDesignerModel } from './extensions'
import type { FormDesignerMode } from './internals'
import type { FormCanvasDragPayload, FormDragSubject } from './palette'
import type { PropertyView } from './properties'
import { createDocument, findNode, findRegion, kindLabel, PROPERTY_GROUPS, validateDocument, walkNodes } from '@xihan-form/core'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS, DEFAULT_FORM_RENDERER_TRANSLATIONS, defineFormRenderer, FORM_RENDERER_TAG } from '@xihan-form/runtime'
import { detectKbdPlatform } from '@xihan-ui/core/hotkey'
import { commandForShortcut, createExtensionHost, HISTORY_NUDGE_MERGE_WITHIN, nudgeMergeKey, snapshotHistory } from '@xihan-ui/designer-kit'
import { applyToolbarCustomization, arrangeCommands, createCommandToolbar, createDesignerSettingsHost, createPanelHost, createStatusItem, defineDesignerShellElement, DESIGNER_COMMANDS_EN_US, DESIGNER_FRAME_REGIONS, DESIGNER_HISTORY_EN_US, DESIGNER_SETTING_KEYS, designerLayoutPolicy, registerDropTarget, renderCommandMenu, resolveSettings, runCommand, startDrag, toolbarCustomizationOf, toolbarDisplayOf, toolbarSettingsSource, toolbarVisibleOf, XhDesignerFrameElement, XhDesignerIssuesElement, XhDesignerPaletteElement, XhDesignerPropertiesElement, XhDesignerSettingsElement } from '@xihan-ui/designer-shell'
import { createExpressionEngine } from '@xihan-ui/expression'
import { CircleAlertIcon, LayoutGridIcon, SlidersHorizontalIcon } from '@xihan-ui/icons'
import { createPointerSession } from '@xihan-ui/pointer'
import { onXhConfigChange } from '@xihan-ui/web-components'
import { BOOLEAN_CONVERTER, createAuthoredElement, emitEvent, registerElement, setAttributes, setText, XhConfigController, XhReactiveElement } from '@xihan-ui/web-components/authoring'
import { defineXhElement, XhButtonElement, XhContextMenuElement, XhExpressionInputElement, XhIconElement, XhMenuElement, XhToolbarElement, XhTooltipElement } from '@xihan-ui/web-components/define'
import { createDialogService } from '@xihan-ui/web-components/services'
import { DesignCanvas, spanColumns } from './canvas'
import { checkFormClipboard, readFormClipboard, writeFormClipboard } from './clipboard'
import { FORM_MENU_LAYOUTS, FORM_SELECTION_LAYOUTS, FORM_TOOLBAR_LAYOUT, menuSubject } from './commands'
import { createFormEditor } from './editor'
import { createFormDesignerModel, FORM_DESIGNER_EXTENSION } from './extensions'
import { describeFormOperations } from './history-labels'
import { provideInternals } from './internals'
import { issueFocus, issueItems } from './issues'
import { dragSubject, paletteGroups, paletteSubject } from './palette'
import { propertyErrors, propertyOperations, propertyView } from './properties'
import { RuleLists } from './rule-lists'
import { hasRuleList } from './rules'

/** 设计器的标签名。 */
export const FORM_DESIGNER_TAG = 'xh-form-designer'

export type { FormDesignerMode } from './internals'

/** 预览宽度：全宽、平板、手机，设计态画布同样生效。 */
export type FormPreviewWidth = 'full' | 'tablet' | 'phone'

/** schema-change 的来源。 */
export type FormSchemaChangeKind = 'execute' | 'undo' | 'redo' | 'load'

/** 设计器派发的事件。 */
export interface FormDesignerEventMap {
  /** 模板变了：执行操作、撤销、重做或换了 `schema`；`schema` 是变化后的模板，`operations` 是这一步实际应用的操作。 */
  'schema-change': CustomEvent<{ schema: FormDocument, operations: readonly FormOperation[], kind: FormSchemaChangeKind }>
  /** 选择变了。 */
  'selection-change': CustomEvent<FormSelection>
  /** 有没有未保存修改的状态变了。 */
  'dirty-change': CustomEvent<{ dirty: boolean }>
  /** 模板问题变了；`issues` 是当前全部问题。 */
  'issues-change': CustomEvent<{ issues: readonly FormSchemaIssue[] }>
  /** 用户要保存：按了 Ctrl / ⌘ + S 或点了保存命令。保存由宿主做，存好后调用 `markSaved()`。 */
  'save': CustomEvent<Record<string, never>>
  /** 双击了画布上的节点。 */
  'node-dblclick': CustomEvent<{ id: string }>
  /** 要在节点上打开右键菜单，`x`、`y` 是视口坐标；可取消，取消后不打开内建菜单。 */
  'node-contextmenu': CustomEvent<{ id: string, x: number, y: number }>
  /** 要在画布空白处打开右键菜单；可取消，取消后不打开内建菜单。 */
  'blank-contextmenu': CustomEvent<{ x: number, y: number }>
  /** 在设计态与预览态之间切换了。 */
  'mode-change': CustomEvent<{ mode: FormDesignerMode }>
  /**
   * 在设置对话框里改了一条设置，或在外框上挪了面板（键是 layout.panels，值是整份布局）：设计器已换成新的 settings 并生效
   * （主题、主题色、状态栏与面板布局）；value 为 undefined 表示删掉这个键、回到缺省值。宿主存起来，下次赋回 settings。
   */
  'settings-change': CustomEvent<{ key: string, value: JsonValue | undefined, settings: DesignerSettings }>
  /** 读写 settingsStorageKey 指的本机存储失败（内容不是对象、无痕窗口、配额满）；设置留在内存里。 */
  'settings-storage-error': CustomEvent<VisualEnvironmentStorageError>
  /**
   * 撤销历史变了：执行（含并入上一步）、撤销、重做、跳转、装载、清空与保存之后都派发，拖动跨度这样的事务进行中不派发。
   * detail 是此刻的 historyState。
   */
  'history-change': CustomEvent<HistorySnapshot>
}

const CLIPBOARD_EVENTS = ['copy', 'cut', 'paste'] as const

/** 撤销步数上限的缺省值。 */
const DEFAULT_HISTORY_LIMIT = 100

/** 预览态登记的区：只留顶栏、工具栏、画布与状态栏。 */
const PREVIEW_REGIONS: ReadonlySet<string> = new Set(['header', 'toolbar', 'canvas', 'status'])

/** 不能输入文字的 input 类型：焦点在这些上面时，撤销、复制这些键仍归设计器。 */
const NON_TEXT_INPUTS: ReadonlySet<string> = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'])

/** 焦点在能输入文字的地方（输入框、文本框、可编辑区）：撤销、全选、复制粘贴这些键归它自己。 */
function isTextEntry(target: EventTarget | null): boolean {
  const element = target as Element | null
  if (element === null || typeof element.closest !== 'function')
    return false
  if (element.localName === 'textarea')
    return true
  if (element.localName === 'input')
    return !NON_TEXT_INPUTS.has((element as HTMLInputElement).type)
  return element.closest('[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]') !== null
}

const NO_EXTENSIONS: readonly FormDesignerExtension[] = Object.freeze([])

type InspectorTab = 'properties' | RuleList

const INSPECTOR_TABS: readonly InspectorTab[] = ['properties', 'validation', 'linkage']

const TAB_LABELS: Readonly<Record<InspectorTab, 'propertiesTab' | 'validationTab' | 'linkageTab'>> = {
  properties: 'propertiesTab',
  validation: 'validationTab',
  linkage: 'linkageTab',
}

/** 设计器的各个部件；面板与画布按 slot 放进外框的同名区。 */
interface DesignerParts {
  readonly frame: XhDesignerFrameElement
  /** 扩展登记的面板。 */
  readonly panels: DesignerPanelHost<FormDesignerContext>
  readonly toolbar: HTMLElement
  readonly commandBar: CommandToolbar<FormDesignerContext>
  /** 顶栏中段的插入钮：图标在上、种类名在下；没有 header 命令时不在外框里。 */
  readonly headerBar: CommandToolbar<FormDesignerContext>
  readonly canvas: HTMLElement
  readonly palette: HTMLElement
  readonly catalog: XhDesignerPaletteElement
  readonly dropIndicator: HTMLElement
  /** 选中一个节点时挂进它的外框，没有时不在文档里。 */
  /** 选中节点右下角的选中工具条：外层是挂进节点外框的那一块，里面是命令工具栏。 */
  readonly nodeToolbar: HTMLElement
  readonly selectionBar: CommandToolbar<FormDesignerContext>
  /** 属性区：属性、校验规则、联动规则三个页签，页签那一排紧贴在卡片的面板头下面。 */
  readonly inspectorTabs: HTMLElement & { value?: string, requestUpdate?: () => void }
  readonly tabTriggers: Readonly<Record<InspectorTab, HTMLButtonElement>>
  readonly tabList: HTMLElement
  readonly inspector: XhDesignerPropertiesElement
  readonly issues: HTMLElement
  readonly problems: XhDesignerIssuesElement
  /** 内建右键菜单：触发区不可交互，由画布的右键在指针处打开。 */
  readonly menu: HTMLElement & { updateComplete?: Promise<unknown> }
  readonly menuTrigger: HTMLElement
  readonly menuContent: HTMLElement
  /** 设置对话框：外框的兄弟节点。 */
  readonly settings: XhDesignerSettingsElement
  /** 状态栏左段：选中的对象，没选中时是字段数。 */
  readonly selectionStatus: DesignerStatusItem
  /** 状态栏右段：预览宽度，点了回到全宽。 */
  readonly widthStatus: DesignerStatusItem
}

/**
 * 文案里接上种类自带的显示名（扩展登记的种类用 label 按语言给）：种类名、节点标签与问题说明里的种类都换成它，
 * 没写 label 的种类照语言包。
 */
function withKindLabels(t: FormDesignerTranslations, labelOf: (kind: string) => string | undefined): FormDesignerTranslations {
  return {
    ...t,
    kind: kind => labelOf(kind) ?? t.kind(kind),
    nodeTag: (kind, key) => t.nodeTag(labelOf(kind) ?? kind, key),
    issue: (issue) => {
      const kind = issue.params?.kind
      const label = typeof kind === 'string' ? labelOf(kind) : undefined
      return t.issue(label === undefined ? issue : { ...issue, params: { ...issue.params, kind: label } })
    },
  }
}

function sameIssues(a: readonly FormSchemaIssue[], b: readonly FormSchemaIssue[]): boolean {
  return a.length === b.length && JSON.stringify(a) === JSON.stringify(b)
}

/**
 * `<xh-form-designer>`：可视化编辑表单模板，物料、画布、属性与问题列表都在里面；
 * 模板的保存与权限交给宿主，经 `schema-change`、`save` 事件与 `markSaved()` 往来。
 */
export class XhFormDesigner extends XhReactiveElement {
  static override properties = {
    expressionEngine: { attribute: false },
    commandLayout: { attribute: false },
    previewValues: { attribute: false },
    loadOptions: { attribute: false },
    uploadFile: { attribute: false },
    translations: { attribute: false },
    // 三态：没写为 undefined，写 "false" 为 false，其余写法为 true
    readonly: { converter: BOOLEAN_CONVERTER },
    mode: { converter: { fromAttribute: (value: string | null) => (value === 'preview' ? 'preview' : 'design') } },
    previewWidth: { attribute: 'preview-width', converter: { fromAttribute: (value: string | null) => (value === 'tablet' || value === 'phone' ? value : 'full') } },
    defaultLayout: { attribute: false },
    settings: { attribute: false },
    settingsPolicy: { attribute: false },
    settingsStorageKey: { attribute: 'settings-storage-key', converter: { fromAttribute: (value: string | null) => value ?? undefined } },
    historyLimit: { attribute: 'history-limit', converter: { fromAttribute: (value: string | null) => (value === null || value === '' ? undefined : Number(value)) } },
    brands: { attribute: false },
    registerBrand: { attribute: false },
  }

  /** 校验表达式与预览用，缺省为 createExpressionEngine()。 */
  declare expressionEngine: ExpressionEngine | undefined
  /**
   * 顶栏、工具栏与右键菜单的排列：位置（header、toolbar、menu:node、menu:region、menu:cell、menu:blank）→ 若干组命令 id，内置命令与扩展命令混排。
   * 写了某个位置就只显示列出的；没写的位置用内置的缺省排列，再把 placement 含它的扩展命令追加成一组。
   */
  declare commandLayout: DesignerCommandLayout | undefined
  /** 预览的示例数据。 */
  declare previewValues: Readonly<Record<string, JsonValue>> | undefined
  /** 预览的选项加载。 */
  declare loadOptions: OptionLoader | undefined
  /** 预览里文件字段的上传函数，与渲染器的同名属性一样交给 xh-file-upload；组件自己不发请求。 */
  declare uploadFile: FileUploader | undefined
  /** 元素自己的文案，压在全局配置之上。 */
  declare translations: Partial<FormDesignerTranslations> | undefined
  /** 可选择、浏览与预览，不能修改。attribute 按三态读：没写或写 "false" 为可修改，其余写法为只读。 */
  declare readonly: boolean | undefined
  /** 设计态或预览态，缺省 design。 */
  declare mode: FormDesignerMode | undefined
  /** 预览宽度，缺省 full。 */
  declare previewWidth: FormPreviewWidth | undefined
  /**
   * 宿主的缺省面板布局：用户没存过布局（settings 里没有 layout.panels）时用它，「恢复默认布局」也回到它；写了的字段整项覆盖
   * 内置缺省（物料在左栏、属性在右栏、问题在下栏，全部显示）。面板 id 见 FORM_DESIGNER_PANELS。用户挪了面板、改了显隐或大小，
   * 整份布局写进设置的 layout.panels 并派发 settings-change。预览态不显示面板，不动布局。
   */
  declare defaultLayout: DesignerLayout | undefined
  /**
   * 设置的值：扁平的键值，键是「分区 id.条目 id」，如 general.theme；没写的键取条目的缺省值。
   * 赋值即生效；用户在设置对话框里改了以后设计器换成新的一份并派发 settings-change。
   */
  declare settings: DesignerSettings | undefined
  /** 宿主对设置条目的管控：键是条目键或分区 id，hidden 不显示，locked 只读、说明换成「由所在系统管理」。 */
  declare settingsPolicy: DesignerSettingsPolicy | undefined
  /**
   * 设置存在根所在窗口 localStorage 的哪个键下：给了，连上文档时若没赋 settings 就从这里读，用户改了设置就写回去，
   * 标了 secret 的条目不存；读写失败派发 settings-storage-error。不给就不读写。同名 attribute settings-storage-key。
   */
  declare settingsStorageKey: string | undefined
  /** 设置里主题色的预设：value 是品牌 id（写成设计器根上的 data-brand），color 是色板格子的颜色。不给且没给 registerBrand 时没有主题色这一项。 */
  declare brands: readonly PropertySwatchOption[] | undefined
  /** 注册自定义主题色，形状与 @xihan-ui/tokens 的 registerBrand 相同；给了才许在设置里自定义主题色。 */
  declare registerBrand: ((id: string, color: string) => () => void) | undefined
  /** 撤销步数上限，缺省 100；在下一次装载（赋 schema）时生效。同名 attribute history-limit。 */
  declare historyLimit: number | undefined

  readonly #config = new XhConfigController(this)
  readonly #editor: FormEditor
  readonly #canvas: DesignCanvas
  readonly #rules: RuleLists
  #defaultEngine: ExpressionEngine | undefined
  #issues: readonly FormSchemaIssue[] = []
  #dirty = false
  #parts: DesignerParts | undefined
  #extensions: readonly FormDesignerExtension[] | undefined
  #model: FormDesignerModel = createFormDesignerModel(NO_EXTENSIONS)
  readonly #host: ExtensionHost<FormDesignerExtension> = createExtensionHost<FormDesignerExtension, FormDesignerContext>({
    builtins: [FORM_DESIGNER_EXTENSION],
    context: () => this.#context(),
  })

  #platform: 'mac' | 'other' | undefined
  #frameRegionsKey = ''
  /** 上次交给外框的区表；扩展的面板宿主换过外框的区后，这一份就不再是外框手上的那一份。 */
  #frameRegionList: readonly DesignerFrameRegion[] | undefined
  /** 上次交给外框的布局管控与换算它的 settingsPolicy：settingsPolicy 没换就沿用同一个对象。 */
  #layoutPolicy: { readonly source: DesignerSettingsPolicy | undefined, readonly policy: DesignerLayoutPolicy } | undefined
  #preview: XhFormRenderer | undefined
  #rendered: FormDocument | undefined
  #clipboard: FormClipboard | undefined
  #propertyView: PropertyView | undefined
  #propertySource: { readonly document: FormDocument, readonly selection: FormSelection } | undefined
  #releaseDropTarget: (() => void) | undefined
  #dropList: HTMLElement | undefined
  #suppressClick = false
  #issuesShown: readonly FormSchemaIssue[] | undefined
  /** 拖来的片段按哪一组扩展检查过、结果如何：拖动中反复悬停不重复校验。 */
  #settingsHost: DesignerSettingsHost | undefined
  #settingsHostOptions: readonly unknown[] = []
  #settingsSectionsKey = ''
  #settingsSectionList: readonly DesignerSettingsSection[] = []
  #settingsDialogKey = ''
  /** 上次交给设置对话框「工具栏」页的按钮表数据：内容没变就不重设，免得按钮表重铺。 */
  #toolbarSourceKey = ''
  /** 此刻生效的设置：各分区没写的条目取了缺省值。 */
  #resolvedSettings: DesignerSettings = {}
  #fragments = new WeakMap<object, { readonly extensions: readonly FormDesignerExtension[] | undefined, readonly clipboard: FormClipboard | undefined }>()
  /** 事务里已经执行的操作，提交时作为一次 execute 报出。 */
  #pending: FormOperation[] = []
  /** 正在拖的跨度把手：调用即取消，跨度回到按下时。 */
  #cancelSpanDrag: (() => void) | undefined
  /** 清空历史前的确认框，第一次用到时建。 */
  #dialogs: DialogService | undefined
  /** 刚连上文档或所在处的配置（语言、文案）变了：画布与物料要按新配置重排；只是选择变了时不重排。 */
  #configStale = true
  #releaseConfigWatch: (() => void) | undefined

  constructor() {
    super()
    this.#editor = createFormEditor({ document: createDocument(), describe: describeFormOperations(() => this.#t()) })
    this.#canvas = new DesignCanvas({
      ownerDocument: this.ownerDocument,
      model: () => this.#model.runtime,
      translations: () => this.#t(),
      rendererTranslations: () => this.#config.translations<FormRendererTranslations>('xh-form-renderer', DEFAULT_FORM_RENDERER_TRANSLATIONS),
    })
    this.#rules = new RuleLists({
      ownerDocument: this.ownerDocument,
      editor: this.#editor,
      registry: () => this.#editor.registry,
      translations: () => this.#t(),
      readonly: () => this.readonly === true,
      expressionEngine: () => this.#engine(),
      settled: () => this.updateComplete,
    })
    provideInternals(this, {
      registry: () => this.#editor.registry,
      setMode: mode => this.#setMode(mode),
      save: () => void emitEvent(this, 'save', {}),
      selectParent: () => {
        const parent = this.#parentOf(this.#editor.selection)
        if (parent !== undefined)
          this.#editor.select({ nodes: [parent] })
      },
      moveSelected: (step) => {
        const nodes = this.#editor.selection.nodes
        if (nodes.length === 1)
          this.#moveBy(nodes[0]!, step)
      },
      mergeCells: () => {
        const cell = this.#selectedCell()
        if (cell !== undefined && this.readonly !== true)
          this.#editor.mergeCells(cell.table, this.#editor.selection.regions ?? [], { label: () => this.#t().mergeCells })
      },
      splitCell: () => {
        const cell = this.#selectedCell()
        if (cell !== undefined && this.readonly !== true)
          this.#editor.splitCell(cell.table, cell.region, { label: () => this.#t().splitCell })
      },
      insertTableLine: (axis, after) => {
        const cell = this.#selectedCell()
        if (cell === undefined || this.readonly === true)
          return
        const at = axis === 'row' ? cell.row + (after ? cell.rowSpan : 0) : cell.column + (after ? cell.columnSpan : 0)
        const text = axis === 'row' ? (after ? 'insertRowBelow' : 'insertRowAbove') : (after ? 'insertColumnRight' : 'insertColumnLeft')
        this.#editor.insertTableLine(cell.table, axis, at, { label: () => this.#t()[text] })
      },
      removeTableLine: (axis) => {
        const cell = this.#selectedCell()
        if (cell !== undefined && this.readonly !== true)
          this.#editor.removeTableLine(cell.table, axis, axis === 'row' ? cell.row : cell.column, { label: () => this.#t()[axis === 'row' ? 'removeRow' : 'removeColumn'] })
      },
      history: () => this.#editor.history,
      historyTranslations: () => this.#config.translations<DesignerHistoryTranslations>('xh-designer-history', DESIGNER_HISTORY_EN_US),
      confirm: (options) => {
        this.#dialogs ??= createDialogService()
        return this.#dialogs.confirm(options)
      },
      editor: () => this.#editor,
      highlight: id => this.#canvas.highlight(id),
      revealRegion: (id) => {
        this.#openRegion(id)
        this.#canvas.regionElement(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      },
    })
    this.#editor.subscribe((change) => {
      if (change.kind === 'selection') {
        this.#canvas.select(change.selection)
        emitEvent(this, 'selection-change', change.selection)
        this.requestUpdate()
        return
      }
      if (this.#editor.history.inTransaction) {
        if (change.cause === 'execute')
          this.#pending.push(...change.operations)
        this.requestUpdate()
        return
      }
      const pending = this.#pending
      this.#pending = []
      this.#documentChanged()
      if (change.cause === 'commit' && pending.length > 0)
        emitEvent(this, 'schema-change', { schema: change.document, operations: pending, kind: 'execute' })
      else if (change.cause === 'execute' || change.cause === 'undo' || change.cause === 'redo')
        emitEvent(this, 'schema-change', { schema: change.document, operations: change.operations, kind: change.cause })
      else if (change.cause === 'reset')
        emitEvent(this, 'schema-change', { schema: change.document, operations: change.operations, kind: 'load' })
      emitEvent(this, 'history-change', this.historyState)
    })
  }

  /** 当前模板；赋值即装载：清空历史与选择，赋回当前这一份不重新装载。 */
  get schema(): FormDocument {
    return this.#editor.document
  }

  set schema(value: FormDocument) {
    if (value === this.#editor.document)
      return
    this.#cancelSpanDrag?.()
    this.#editor.load(value, { historyLimit: this.historyLimit ?? DEFAULT_HISTORY_LIMIT })
  }

  /**
   * 扩展：种类、渲染、属性编辑器、编辑方式、规则、命令与面板都从这里来，内置扩展自动排在最前；画布、预览与校验用同一份。
   * 赋值时当场合并查重，冲突抛 DesignerExtensionError、什么都不变；各扩展的 setup 在元素连上文档时调用、断开时清理。
   * 同一个扩展对象换了引用当作卸下再装上，宿主要保持引用稳定。
   */
  get extensions(): readonly FormDesignerExtension[] | undefined {
    return this.#extensions
  }

  set extensions(value: readonly FormDesignerExtension[] | undefined) {
    if (value === this.#extensions)
      return
    const model = createFormDesignerModel(value ?? NO_EXTENSIONS)
    this.#ensureParts().panels.assign(model.extensions, this.#context())
    if (this.isConnected)
      this.#host.assign(value ?? NO_EXTENSIONS)
    const old = this.#extensions
    this.#extensions = value
    this.#model = model
    this.#editor.setExtensions(value ?? NO_EXTENSIONS)
    this.#documentChanged()
    this.requestUpdate('extensions', old)
  }

  /** 有可撤销的修改。 */
  get canUndo(): boolean {
    return this.#editor.history.canUndo
  }

  /** 有可重做的修改。 */
  get canRedo(): boolean {
    return this.#editor.history.canRedo
  }

  /** 内部剪贴板里有内容可粘贴。 */
  get canPaste(): boolean {
    return this.#clipboard !== undefined
  }

  /** 有没保存的修改：上次 `markSaved` 之后改过。 */
  get dirty(): boolean {
    return this.#editor.history.dirty
  }

  /** 撤销历史的快照：各步的说明按此刻的语言取好，位置号用于 goToHistory。 */
  get historyState(): HistorySnapshot {
    return snapshotHistory(this.#editor.history)
  }

  /** 跳到撤销历史里的一步或起点（historyState 里的位置号），一次跳到；只读、预览、拖动中或位置号不认识时返回 false。 */
  goToHistory(position: number): boolean {
    const history = this.#editor.history
    if (this.readonly === true || (this.mode ?? 'design') !== 'design' || history.inTransaction)
      return false
    return history.goTo(position)
  }

  /** 清空撤销与重做；模板与是否已保存不变。只读或拖动中什么都不做。 */
  clearHistory(): void {
    const history = this.#editor.history
    if (this.readonly !== true && !history.inTransaction)
      history.clear()
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#configStale = true
    this.#releaseConfigWatch ??= onXhConfigChange(() => {
      this.#configStale = true
    }, this)
    const parts = this.#ensureParts()
    for (const type of CLIPBOARD_EVENTS)
      this.addEventListener(type, this.#onClipboard)
    this.#releaseDropTarget ??= registerDropTarget<unknown>(parts.canvas, {
      over: (point, payload) => this.#dragOver(point, payload),
      drop: (point, payload) => this.#drop(point, payload),
      leave: () => this.#showDrop(undefined),
    })
    this.#host.assign(this.#extensions ?? NO_EXTENSIONS)
    this.requestUpdate()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    for (const type of CLIPBOARD_EVENTS)
      this.removeEventListener(type, this.#onClipboard)
    this.#releaseDropTarget?.()
    this.#releaseDropTarget = undefined
    this.#releaseConfigWatch?.()
    this.#releaseConfigWatch = undefined
    this.#cancelSpanDrag?.()
    this.#host.dispose()
    this.#settingsHost?.dispose()
    this.#settingsHost = undefined
    this.#dialogs?.dispose()
    this.#dialogs = undefined
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed)
    const parts = this.#ensureParts()
    const mode = this.mode ?? 'design'
    const t = this.#t()
    const configStale = this.#configStale
    this.#configStale = false
    this.#syncSettings(parts, changed)
    setAttributes(parts.frame, { 'data-mode': mode, 'data-width': this.previewWidth ?? 'full', 'data-readonly': this.readonly === true, 'aria-label': t.label })
    this.#syncStatus(t)
    if (changed.has('mode'))
      this.#syncMode()
    if (this.#rendered !== this.#editor.document || changed.has('extensions') || changed.has('translations') || configStale)
      this.#renderCanvas()
    this.#syncPreview()
    this.#syncProperties(changed, t)
    // 属性卡片的副标题取这一轮算出的编辑对象，所以先更新属性面板再设区；面板开关命令的文字取区的标题，所以设完区再铺工具栏
    this.#syncRegions(parts.frame, t, mode)
    this.#syncLayout(parts.frame)
    this.#syncToolbar(t)
    this.#syncPalette(changed, t, configStale)
    this.#syncIssues(changed, t)
    this.#syncNodeToolbar(t)
    this.#syncRuleTabs(t)
    parts.panels.update(this.#context(t))
  }

  /** 页签文案与可用：校验规则只给登记了校验种类的单个字段或容器，联动规则只给单个节点；当前页签不可用时回到属性页签。 */
  #syncRuleTabs(t: FormDesignerTranslations): void {
    const parts = this.#ensureParts()
    const selection = this.#editor.selection
    const id = selection.nodes.length === 1 && (selection.regions?.length ?? 0) === 0 ? selection.nodes[0] : undefined
    const node = id === undefined ? undefined : findNode(this.#editor.document, id)?.node
    this.#rules.sync(this.#editor.document, node, this.#issues)
    const enabled: Readonly<Record<InspectorTab, boolean>> = {
      properties: true,
      validation: node !== undefined && hasRuleList(node, 'validation', this.#editor.registry),
      linkage: node !== undefined,
    }
    setAttributes(parts.tabList, { 'aria-label': t.properties })
    let changed = false
    for (const tab of INSPECTOR_TABS) {
      const trigger = parts.tabTriggers[tab]
      setText(trigger, t[TAB_LABELS[tab]])
      if (trigger.disabled !== !enabled[tab]) {
        trigger.disabled = !enabled[tab]
        changed = true
      }
    }
    const current = parts.inspectorTabs.value as InspectorTab | undefined
    if (current !== undefined && !enabled[current]) {
      parts.inspectorTabs.value = 'properties'
      changed = true
    }
    if (changed)
      parts.inspectorTabs.requestUpdate?.()
  }

  /** 执行一组操作并记为一步撤销；返回新模板。 */
  execute(operations: readonly FormOperation[], options?: ExecuteOptions): FormDocument {
    return this.#editor.execute(operations, options)
  }

  /** 撤销一步；只读、正在拖动跨度或没有可撤销的时返回 false。 */
  undo(): boolean {
    return this.readonly !== true && !this.#editor.history.inTransaction && this.#editor.undo()
  }

  /** 重做一步；只读、正在拖动跨度或没有可重做的时返回 false。 */
  redo(): boolean {
    return this.readonly !== true && !this.#editor.history.inTransaction && this.#editor.redo()
  }

  /** 把当前模板记为已保存：`dirty` 变为 false，并派发 `dirty-change`。 */
  markSaved(): void {
    this.#editor.markSaved()
    this.#syncDirty()
  }

  /** 按种类新建节点并选中它；目标缺省为选中节点之后，没有选中时为末尾。目标不收时返回 undefined。 */
  addNode(kind: string, target?: FormDropTarget): FormNode | undefined {
    if (this.readonly === true)
      return undefined
    return this.#editor.addNode(kind, target)
  }

  /** 选中节点或区域：给了非空的 regions 就选区域，否则选 nodes。 */
  select(selection: Partial<FormSelection>): void {
    this.#editor.select(selection)
  }

  /** 当前的选择。 */
  getSelection(): FormSelection {
    return this.#editor.selection
  }

  /** 打开设置对话框，给了分区 id 就显示那一页：基础是 general，扩展的分区用它们自己的 id。 */
  openSettings(section?: string): void {
    this.#ensureParts().settings.show(section)
  }

  /** 删除选中的节点或区域；只读或什么都没删时返回 false。 */
  deleteSelection(): boolean {
    return this.readonly !== true && this.#editor.deleteSelection()
  }

  /** 复制选中的节点，放进这个设计器的剪贴板并返回；没有选中时返回 undefined。 */
  copy(): FormClipboard | undefined {
    const copied = this.#editor.copy()
    if (copied !== undefined)
      this.#clipboard = copied
    return copied
  }

  /** 复制并删除选中的节点；只读或没有选中时返回 undefined。 */
  cut(): FormClipboard | undefined {
    if (this.readonly === true)
      return undefined
    const copied = this.#editor.cut()
    if (copied !== undefined)
      this.#clipboard = copied
    return copied
  }

  /** 粘贴：给了内容就粘贴它，否则粘贴最近一次复制或剪切的内容；返回新的选择。 */
  paste(clipboard?: FormClipboard): FormSelection {
    if (this.readonly === true)
      return { nodes: [] }
    return this.#editor.paste(clipboard ?? this.#clipboard)
  }

  /** 复制选中节点并紧跟在原节点之后粘贴，不改动剪贴板；返回新的选择。 */
  duplicate(): FormSelection {
    if (this.readonly === true)
      return { nodes: [] }
    return this.#editor.duplicate()
  }

  /** 检查模板结构，规则里的表达式用 expressionEngine 检查。 */
  validate(): readonly FormSchemaIssue[] {
    return validateDocument(this.#editor.document, { extensions: this.#extensions, expressionEngine: this.#engine() })
  }

  /** 滚动到节点：必要时先切到所在的标签页、展开所在的折叠项。 */
  scrollToNode(id: string): void {
    this.#openAncestors(id)
    this.#canvas.nodeElement(id)?.scrollIntoView({ block: 'center', inline: 'nearest' })
  }

  /** 节点不在可见区内时才滚动到它。 */
  revealNode(id: string): void {
    this.#openAncestors(id)
    this.#canvas.nodeElement(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  /** 设计器文案：语言包垫底，种类自带的显示名压上去，元素自己的 translations 再压在最上面。 */
  #t(): FormDesignerTranslations {
    const pack = this.#config.translations<FormDesignerTranslations>('xh-form-designer', DEFAULT_FORM_DESIGNER_TRANSLATIONS)
    const registry = this.#editor.registry
    const locale = this.#config.locale
    const labeled = withKindLabels(pack, kind => kindLabel(registry.get(kind), locale))
    const own = Object.entries(this.translations ?? {}).filter(([, value]) => value !== undefined)
    return own.length === 0 ? labeled : { ...labeled, ...Object.fromEntries(own) }
  }

  /** 四款共用的命令文案：designer-shell 语言包的 xh-designer-commands。 */
  #commandTexts(): DesignerCommandsTranslations {
    return this.#config.translations<DesignerCommandsTranslations>('xh-designer-commands', DESIGNER_COMMANDS_EN_US)
  }

  /** 交给命令、面板与扩展 setup 的上下文。 */
  #context(t: FormDesignerTranslations = this.#t()): FormDesignerContext {
    return { designer: this, translations: t, commands: this.#commandTexts(), settings: this.#resolvedSettings, frame: this.#parts?.frame }
  }

  #kbdPlatform(): 'mac' | 'other' {
    this.#platform ??= detectKbdPlatform()
    return this.#platform
  }

  /** 问题的说明：扩展的 issueText 优先，没有时取文案。 */
  #describe(issue: FormSchemaIssue, t: FormDesignerTranslations): string {
    return this.#model.runtime.issueText(issue) ?? t.issue(issue)
  }

  /** 选中的表格单元格（取第一个）所在的表格与它的行列和跨度；没选表格单元格时为 undefined。 */
  #selectedCell(): { table: string, region: string, row: number, column: number, rowSpan: number, columnSpan: number } | undefined {
    const first = this.#editor.selection.regions?.[0]
    const found = first === undefined ? undefined : findRegion(this.#editor.document, first)
    if (found === undefined || found.container.kind !== 'table')
      return undefined
    const props = found.region.props
    const number = (value: unknown, fallback: number): number => (typeof value === 'number' ? value : fallback)
    return {
      table: found.container.id,
      region: found.region.id,
      row: number(props.row, 0),
      column: number(props.column, 0),
      rowSpan: number(props.rowSpan, 1),
      columnSpan: number(props.columnSpan, 1),
    }
  }

  #engine(): ExpressionEngine {
    return this.expressionEngine ?? (this.#defaultEngine ??= createExpressionEngine())
  }

  #ensureParts(): DesignerParts {
    if (this.#parts !== undefined)
      return this.#parts
    const doc = this.ownerDocument
    const commandBar = createCommandToolbar<FormDesignerContext>(doc, { platform: this.#kbdPlatform() })
    const headerBar = createCommandToolbar<FormDesignerContext>(doc, { display: 'stacked', platform: this.#kbdPlatform() })
    headerBar.element.slot = 'header-center'
    const toolbar = createAuthoredElement(doc, 'div', { 'data-part': 'command-bar', 'slot': 'toolbar' }, [commandBar.element])
    const dropIndicator = createAuthoredElement(doc, 'div', { 'data-part': 'drop-indicator', 'aria-hidden': 'true', 'hidden': true })
    const canvas = createAuthoredElement(doc, 'div', { 'data-part': 'canvas', 'slot': 'canvas', 'tabindex': '0' }, [this.#canvas.element, dropIndicator])
    const catalog = createAuthoredElement(doc, 'xh-designer-palette', { 'data-part': 'catalog', 'searchable': true })
    const palette = createAuthoredElement(doc, 'div', { 'data-part': 'palette', 'slot': 'palette' }, [catalog])
    const inspector = createAuthoredElement(doc, 'xh-designer-properties', { 'data-part': 'inspector', 'collapsible': true, 'toggle-limit': '3' })
    const tabTriggers = Object.fromEntries(INSPECTOR_TABS.map(tab => [tab, createAuthoredElement(doc, 'button', { 'data-xh-part': 'trigger', 'type': 'button', 'value': tab })])) as Record<InspectorTab, HTMLButtonElement>
    const tabList = createAuthoredElement(doc, 'div', { 'data-xh-part': 'list' }, [...INSPECTOR_TABS.map(tab => tabTriggers[tab]), createAuthoredElement(doc, 'div', { 'data-xh-part': 'indicator' })])
    const panel = (tab: InspectorTab, child: HTMLElement): HTMLElement => createAuthoredElement(doc, 'div', { 'data-xh-part': 'content', 'value': tab }, [child])
    const inspectorTabs: DesignerParts['inspectorTabs'] = createAuthoredElement(doc, 'xh-tabs', { 'data-part': 'inspector-tabs', 'slot': 'properties', 'size': 'sm' }, [
      createAuthoredElement(doc, 'div', { 'data-xh-part': 'root' }, [
        tabList,
        panel('properties', inspector),
        panel('validation', this.#rules.element('validation')),
        panel('linkage', this.#rules.element('linkage')),
      ]),
    ])
    inspectorTabs.value = 'properties'
    inspectorTabs.addEventListener('value-change', (event) => {
      if (event.target !== inspectorTabs)
        return
      event.stopPropagation()
      inspectorTabs.value = (event as CustomEvent<{ value: string }>).detail.value
    })
    const problems = createAuthoredElement(doc, 'xh-designer-issues', { 'data-part': 'problems', 'group-by': 'target' })
    const issues = createAuthoredElement(doc, 'div', { 'data-part': 'issues', 'slot': 'issues' }, [problems])
    const menuTrigger = createAuthoredElement(doc, 'div', { 'data-xh-part': 'trigger', 'inert': true })
    const menuContent = createAuthoredElement(doc, 'div', { 'data-xh-part': 'content' })
    const menu = createAuthoredElement(doc, 'xh-context-menu', { 'data-part': 'menu', 'size': 'sm' }, [
      createAuthoredElement(doc, 'div', { 'data-xh-part': 'root' }, [menuTrigger, createAuthoredElement(doc, 'div', { 'data-xh-part': 'positioner' }, [menuContent])]),
    ])
    menu.addEventListener('select', this.#onMenuSelect)
    menu.addEventListener('open-change', this.#onMenuOpenChange)
    // 状态栏：左段写选中的对象，右段写预览宽度，点了回到全宽
    const selectionStatus = createStatusItem(doc, { value: '' })
    selectionStatus.element.slot = 'status-start'
    const widthStatus = createStatusItem(doc, { value: '', action: () => void (this.previewWidth = 'full') })
    widthStatus.element.slot = 'status-end'
    // 问题列表带计数的严重程度开关放进它所在卡片的面板头
    const issueSummary = problems.summary
    issueSummary.slot = 'issues-actions'
    const frame = createAuthoredElement(doc, 'xh-designer-frame', { 'data-part': 'frame', 'role': 'application' }, [toolbar, palette, canvas, inspectorTabs, issues, issueSummary, selectionStatus.element, widthStatus.element, menu])
    // 三个零件只画内容，标题、副标题与帮助由外框画在卡片的面板头上
    catalog.headless = true
    inspector.headless = true
    problems.headless = true
    frame.addEventListener('layout-change', this.#onLayoutChange)
    // 快捷键在整个设计器里认：画布、物料、属性与问题列表
    this.addEventListener('keydown', this.#onKeyDown)
    canvas.addEventListener('click', this.#onCanvasClick)
    canvas.addEventListener('dblclick', this.#onCanvasDblclick)
    canvas.addEventListener('contextmenu', this.#onCanvasContextMenu)
    canvas.addEventListener('pointerdown', this.#onCanvasPointerDown)
    canvas.addEventListener('pan-request', this.#onPanRequest)
    catalog.addEventListener('item-activate', this.#onPaletteActivate)
    problems.addEventListener('issue-activate', this.#onIssueActivate)
    inspector.addEventListener('property-change', this.#onPropertyChange)
    inspector.addEventListener('property-commit', this.#onPropertyCommit)
    const settings = createAuthoredElement(doc, 'xh-designer-settings', { 'data-part': 'settings' })
    settings.addEventListener('settings-change', this.#onSettingsChange)
    this.replaceChildren(frame, settings)
    // 面板头的命令（如历史记录的清空）按设计器此刻的命令表铺
    const panels = createPanelHost<FormDesignerContext>(frame, { commands: () => this.#model.commands })
    this.#parts = { frame, panels, toolbar, commandBar, headerBar, canvas, palette, catalog, dropIndicator, ...this.#buildNodeToolbar(doc), inspectorTabs, tabTriggers, tabList, inspector, issues, problems, menu, menuTrigger, menuContent, settings, selectionStatus, widthStatus }
    this.#prepareMenu(this.#parts)
    panels.assign(this.#model.extensions, this.#context())
    return this.#parts
  }

  /**
   * 设置：建好设置宿主（主题色预设、注册函数或存储键变了就重建），给了存储键又没赋 settings 时从存储读；settings 变了
   * 把主题与主题色落到设计器上；算出此刻生效的设置，交给设置对话框。
   */
  #syncSettings(parts: DesignerParts, changed: PropertyValues): void {
    const options = [this.brands, this.registerBrand, this.settingsStorageKey]
    let fresh = false
    if (!this.#settingsHost || options.some((value, index) => value !== this.#settingsHostOptions[index])) {
      this.#settingsHost?.dispose()
      this.#settingsHostOptions = options
      const storageKey = this.settingsStorageKey
      this.#settingsHost = storageKey === undefined
        ? createDesignerSettingsHost({ root: this, brands: this.brands, registerBrand: this.registerBrand })
        : createDesignerSettingsHost({
            root: this,
            brands: this.brands,
            registerBrand: this.registerBrand,
            storageKey,
            onStorageError: detail => emitEvent(this, 'settings-storage-error', detail),
          })
      if (storageKey !== undefined && this.settings === undefined)
        this.settings = this.#settingsHost.load()
      fresh = true
    }
    if (fresh || changed.has('settings'))
      this.#settingsHost.apply(this.settings ?? {})
    const sections = this.#model.settings
    const sectionsKey = JSON.stringify(sections)
    if (sectionsKey !== this.#settingsSectionsKey) {
      this.#settingsSectionsKey = sectionsKey
      this.#settingsSectionList = sections
    }
    this.#resolvedSettings = resolveSettings(this.#settingsSectionList, this.settings)
    const dialog = parts.settings
    const general = { brands: this.brands, customBrand: this.registerBrand !== undefined }
    const policy: DesignerSettingsPolicy = { ...this.settingsPolicy }
    const dialogKey = JSON.stringify([general.brands, general.customBrand, policy])
    if (dialogKey !== this.#settingsDialogKey) {
      this.#settingsDialogKey = dialogKey
      dialog.general = general
      dialog.policy = policy
    }
    if (dialog.sections !== this.#settingsSectionList)
      dialog.sections = this.#settingsSectionList
    if (dialog.settings !== this.settings)
      dialog.settings = this.settings
    if (dialog.frame !== parts.frame)
      dialog.frame = parts.frame
  }

  /** 设置对话框里改了一条：换成新的 settings，给了存储键就存起来，再派发 settings-change。 */
  readonly #onSettingsChange = (event: Event): void => {
    event.stopPropagation()
    this.#commitSettings((event as DesignerSettingsEventMap['settings-change']).detail)
  }

  /** 外框改了面板布局：整份写进设置的 layout.panels，与在设置对话框里改一条一样。外框的事件不冒出设计器。 */
  readonly #onLayoutChange = (event: Event): void => {
    event.stopPropagation()
    const key = DESIGNER_SETTING_KEYS.layout
    const value = (event as DesignerFrameEventMap['layout-change']).detail.layout as unknown as JsonValue
    this.#commitSettings({ key, value, settings: { ...this.settings, [key]: value } })
  }

  /** 换成新的 settings，给了存储键就存起来，再派发 settings-change。 */
  #commitSettings(detail: DesignerSettingsEventMap['settings-change']['detail']): void {
    this.settings = detail.settings
    this.#settingsHost?.save(detail.settings, this.#settingsSectionList)
    emitEvent(this, 'settings-change', detail)
  }

  /** 设置里的状态栏开关，缺省开。 */
  #statusBarOn(): boolean {
    return this.#resolvedSettings[DESIGNER_SETTING_KEYS.statusBar] !== false
  }

  /** 把设置里存的布局、宿主的缺省布局与从 settingsPolicy 换算的管控交给外框；没变的不重设。 */
  #syncLayout(frame: XhDesignerFrameElement): void {
    const stored = this.settings?.[DESIGNER_SETTING_KEYS.layout]
    const layout = typeof stored === 'object' && stored !== null && !Array.isArray(stored) ? stored as unknown as DesignerLayout : undefined
    if (frame.layout !== layout)
      frame.layout = layout
    if (frame.defaultLayout !== this.defaultLayout)
      frame.defaultLayout = this.defaultLayout
    if (this.#layoutPolicy === undefined || this.#layoutPolicy.source !== this.settingsPolicy)
      this.#layoutPolicy = { source: this.settingsPolicy, policy: designerLayoutPolicy(this.settingsPolicy) }
    if (frame.layoutPolicy !== this.#layoutPolicy.policy)
      frame.layoutPolicy = this.#layoutPolicy.policy
  }

  /** 状态栏：左段写选中的对象（字段写种类与字段名，区域写所在容器，多选写个数，没选中写字段数），右段写预览宽度。 */
  #syncStatus(t: FormDesignerTranslations): void {
    const parts = this.#ensureParts()
    const document = this.#editor.document
    const { nodes, regions = [] } = this.#editor.selection
    const count = nodes.length + regions.length
    if (count > 1) {
      parts.selectionStatus.update({ value: t.statusSelected(count) })
    }
    else if (regions.length === 1) {
      const found = findRegion(document, regions[0]!)
      parts.selectionStatus.update({ label: t.group('region'), value: found === undefined ? '' : t.kind(found.container.kind) })
    }
    else if (nodes.length === 1) {
      const node = findNode(document, nodes[0]!)?.node
      parts.selectionStatus.update(node === undefined ? { value: '' } : { label: t.kind(node.kind), value: node.type === 'static' ? '' : node.key ?? '' })
    }
    else {
      let fields = 0
      walkNodes(document, (node) => {
        if (node.type === 'field')
          fields += 1
      })
      parts.selectionStatus.update({ value: t.statusFields(fields) })
    }
    const width = this.previewWidth ?? 'full'
    parts.widthStatus.update({ label: t.previewWidth, value: width === 'tablet' ? t.widthTablet : width === 'phone' ? t.widthPhone : t.widthFull })
  }

  /**
   * 外框的区：工具栏与画布带上本地化的区名（分隔条的无障碍名称要用）；物料、属性与问题画成卡片，面板头写标题、图标与帮助，
   * 属性面板的副标题是当前编辑的对象；后面接扩展面板的区。设置里关了状态栏或工具栏时不登记它们；预览态只登记顶栏、工具栏、画布与状态栏，
   * 面板的内容留在外框下面，布局不动。内容没变、外框手上也还是上次给的那一份时不重设。
   */
  #syncRegions(frame: XhDesignerFrameElement, t: FormDesignerTranslations, mode: FormDesignerMode): void {
    const described: Readonly<Record<string, Partial<DesignerFrameRegion>>> = {
      toolbar: { label: this.#commandTexts().toolbar },
      palette: { title: t.palette, icon: LayoutGridIcon, help: t.paletteHelp },
      canvas: { label: t.canvas },
      properties: { title: t.properties, subtitle: this.#ensureParts().inspector.heading, icon: SlidersHorizontalIcon, help: t.propertiesHelp },
      issues: { title: t.issues, icon: CircleAlertIcon, help: t.issuesHelp },
    }
    const statusBar = this.#statusBarOn()
    const toolbar = toolbarVisibleOf(this.settings)
    const kept = (region: DesignerFrameRegion): boolean => (region.name !== 'status' || statusBar) && (region.name !== 'toolbar' || toolbar) && (mode === 'design' || PREVIEW_REGIONS.has(region.name))
    const regions: DesignerFrameRegion[] = [
      ...DESIGNER_FRAME_REGIONS.filter(kept).map(region => ({ ...region, ...described[region.name] })),
      ...(mode === 'design' ? this.#model.extensions.flatMap(extension => (extension.panels ?? []).map(panel => panel.region)) : []),
    ]
    const key = JSON.stringify(regions)
    if (key === this.#frameRegionsKey && frame.regions === this.#frameRegionList)
      return
    this.#frameRegionsKey = key
    this.#frameRegionList = regions
    frame.regions = regions
  }

  /** 选中工具条：一条命令工具栏，包在挂进节点外框的那一块里；里面的按键、点击与按下不冒到画布上。 */
  #buildNodeToolbar(doc: Document): { readonly nodeToolbar: HTMLElement, readonly selectionBar: CommandToolbar<FormDesignerContext> } {
    const selectionBar = createCommandToolbar<FormDesignerContext>(doc, { platform: this.#kbdPlatform() })
    const nodeToolbar = createAuthoredElement(doc, 'div', { 'data-part': 'node-toolbar' }, [selectionBar.element])
    // 点了一条命令以后焦点回到画布，删掉节点时工具条随之拿掉，焦点也不丢
    nodeToolbar.addEventListener('click', (event) => {
      event.stopPropagation()
      if ((event.target as Element | null)?.closest('button[value]'))
        this.#parts?.canvas.focus({ preventScroll: true })
    })
    for (const type of ['pointerdown', 'dblclick', 'keydown', 'contextmenu'])
      nodeToolbar.addEventListener(type, event => event.stopPropagation())
    return { nodeToolbar, selectionBar }
  }

  /**
   * 选中工具条：只选中一个节点、可编辑且在设计态时，按 selection:node 的排列（宿主经 commandLayout 改，
   * 扩展命令写上这个落点就追加成一组）铺命令，挂进节点的外框；排列为空时不放。命令的可用与文字每次刷新。
   */
  #syncNodeToolbar(t: FormDesignerTranslations): void {
    const { nodeToolbar, selectionBar } = this.#ensureParts()
    const selection = this.#editor.selection
    const id = selection.nodes.length === 1 && (selection.regions?.length ?? 0) === 0 ? selection.nodes[0] : undefined
    const found = id === undefined || this.readonly === true || (this.mode ?? 'design') !== 'design' ? undefined : findNode(this.#editor.document, id)
    const host = found === undefined ? undefined : this.#canvas.nodeElement(found.node.id)
    const { commands } = this.#model
    const groups = host === undefined ? [] : arrangeCommands('selection:node', commands, FORM_SELECTION_LAYOUTS.node, this.commandLayout)
    if (found === undefined || host === undefined || groups.every(group => group.length === 0)) {
      nodeToolbar.remove()
      return
    }
    selectionBar.update(groups, commands, this.#context(t), t.nodeTag(found.node.kind, found.node.type === 'static' ? undefined : found.node.key))
    if (nodeToolbar.parentElement !== host)
      host.append(nodeToolbar)
  }

  /**
   * 工具栏按 commandLayout 或缺省排列排出分组，再套用户在设置「工具栏」页的定制（toolbar.layout），显示方式取 toolbar.display，
   * 文字、可用与选中状态每次刷新；同一份缺省排列连同各命令此刻的文字交给设置对话框，「工具栏」页据此列出按钮表。
   * 顶栏铺 placement 为 header 的命令，一条也没有时从外框里拿掉，顶栏随之收起。
   */
  #syncToolbar(t: FormDesignerTranslations): void {
    const { commands } = this.#model
    const context = this.#context(t)
    const { commandBar, headerBar, frame, settings } = this.#ensureParts()
    const arranged = arrangeCommands('toolbar', commands, FORM_TOOLBAR_LAYOUT, this.commandLayout)
    commandBar.setDisplay(toolbarDisplayOf(this.settings))
    commandBar.update(applyToolbarCustomization(arranged, toolbarCustomizationOf(this.settings)), commands, context, context.commands.toolbar)
    const source = toolbarSettingsSource(arranged, commands, context)
    const sourceKey = JSON.stringify(source)
    if (sourceKey !== this.#toolbarSourceKey) {
      this.#toolbarSourceKey = sourceKey
      settings.toolbar = source
    }
    const header = arrangeCommands('header', commands, [], this.commandLayout)
    if (header.length > 0) {
      headerBar.update(header, commands, context, t.insertToolbar)
      if (!headerBar.element.isConnected)
        frame.append(headerBar.element)
    }
    else {
      headerBar.element.remove()
    }
  }

  #setMode(mode: FormDesignerMode): void {
    if ((this.mode ?? 'design') === mode)
      return
    this.mode = mode
    emitEvent(this, 'mode-change', { mode })
  }

  #syncMode(): void {
    const parts = this.#ensureParts()
    if ((this.mode ?? 'design') === 'preview') {
      this.#preview ??= this.ownerDocument.createElement(FORM_RENDERER_TAG)
      parts.canvas.replaceChildren(this.#preview, parts.dropIndicator)
      this.#syncPreview()
    }
    else {
      parts.canvas.replaceChildren(this.#canvas.element, parts.dropIndicator)
    }
  }

  #syncPreview(): void {
    const preview = this.#preview
    if (preview === undefined || (this.mode ?? 'design') !== 'preview')
      return
    preview.extensions = this.#extensions
    preview.expressionEngine = this.#engine()
    preview.loadOptions = this.loadOptions
    preview.uploadFile = this.uploadFile
    preview.values = this.previewValues
    preview.schema = this.#editor.document
  }

  /** 选择、模板、文案或只读变了时，重算属性面板的编辑对象、文案与字段错误。 */
  #syncProperties(changed: PropertyValues, t: FormDesignerTranslations): void {
    const document = this.#editor.document
    const selection = this.#editor.selection
    const source = this.#propertySource
    const stale = source?.document !== document || source.selection !== selection
    if (!stale && !changed.has('readonly') && !changed.has('extensions') && !changed.has('translations') && changed.size > 0)
      return
    this.#propertySource = { document, selection }
    const view = propertyView(document, this.#editor.registry, selection, this.#model.runtime.documentProperties)
    this.#propertyView = view
    const inspector = this.#ensureParts().inspector
    const nameOf = (descriptor: DesignerPropertyDescriptor): { kind: string, group: string, name: string } =>
      view.names.get(descriptor) ?? { kind: '', group: '', name: String(descriptor.path.at(-1)) }
    inspector.targets = view.targets
    inspector.heading = view.scope === 'settings' ? t.settings : view.node ? t.nodeTag(view.node.kind, view.node.key) : view.container === undefined ? undefined : t.group('region')
    inspector.editors = this.#model.editors
    inspector.readonly = this.readonly === true
    inspector.groupOrder = PROPERTY_GROUPS
    inspector.groupLabel = group => t.group(group)
    inspector.labelOf = (descriptor) => {
      const name = nameOf(descriptor)
      return t.property(name.kind, name.group, name.name)
    }
    inspector.optionLabel = (descriptor, option) => t.option(nameOf(descriptor).name, String(option.value))
    inspector.errors = propertyErrors(document, view, this.#issues, issue => this.#describe(issue, t))
  }

  /** 扩展、文案或配置变了时重排物料。 */
  #syncPalette(changed: PropertyValues, t: FormDesignerTranslations, configStale: boolean): void {
    const catalog = this.#ensureParts().catalog
    if (catalog.groups === undefined || changed.has('extensions') || changed.has('translations') || configStale)
      catalog.groups = paletteGroups(this.#editor.registry, t)
    catalog.readonly = this.readonly === true
  }

  /** 问题或文案变了时重列问题。 */
  #syncIssues(changed: PropertyValues, t: FormDesignerTranslations): void {
    if (this.#issuesShown === this.#issues && !changed.has('translations') && !changed.has('extensions') && changed.size > 0)
      return
    this.#issuesShown = this.#issues
    this.#ensureParts().problems.items = issueItems(this.#editor.document, this.#issues, t, issue => this.#describe(issue, t))
  }

  /** 拖到画布上：算出放置位置，能放下时画插入线。 */
  #dragOver(point: { readonly x: number, readonly y: number }, payload: unknown): { accept: boolean } {
    const subject = dragSubject(payload, this)
    if (subject === undefined || this.readonly === true || (this.mode ?? 'design') !== 'design') {
      this.#showDrop(undefined)
      return { accept: false }
    }
    const drop = this.#canvas.dropAt(point)
    const accept = this.#accepts(subject, drop.target)
    this.#showDrop(accept ? drop : undefined)
    return { accept }
  }

  /** 拖来的东西能否放到目标位置；片段按当前扩展检查过才算数。 */
  #accepts(subject: FormDragSubject, target: FormDropTarget): boolean {
    if ('kind' in subject)
      return this.#editor.canAdd(subject.kind, target)
    if ('nodes' in subject)
      return this.#editor.canDrop(subject.nodes, target)
    const fragment = this.#fragment(subject.clipboard)
    return fragment !== undefined && this.#editor.canPasteAt(fragment, target)
  }

  /** 片段按当前扩展检查一次后记下；不合规时为 undefined。 */
  #fragment(content: unknown): FormClipboard | undefined {
    if (typeof content !== 'object' || content === null)
      return undefined
    const cached = this.#fragments.get(content)
    if (cached !== undefined && cached.extensions === this.#extensions)
      return cached.clipboard
    const clipboard = checkFormClipboard(content, this.#extensions)
    this.#fragments.set(content, { extensions: this.#extensions, clipboard })
    return clipboard
  }

  #drop(point: { readonly x: number, readonly y: number }, payload: unknown): void {
    this.#showDrop(undefined)
    const subject = dragSubject(payload, this)
    if (subject === undefined || this.readonly === true || (this.mode ?? 'design') !== 'design')
      return
    const { target } = this.#canvas.dropAt(point)
    if ('kind' in subject) {
      const node = this.#editor.addNode(subject.kind, target)
      if (node !== undefined)
        this.revealNode(node.id)
    }
    else if ('nodes' in subject) {
      if (this.#editor.moveNodes(subject.nodes, target))
        this.#editor.select({ nodes: subject.nodes })
    }
    else {
      const fragment = this.#fragment(subject.clipboard)
      const first = fragment === undefined ? undefined : this.#editor.paste(fragment, target).nodes[0]
      if (first !== undefined)
        this.revealNode(first)
    }
    this.#parts?.canvas.focus({ preventScroll: true })
  }

  /** 插入线画在插入点前后两个节点块之间；列表为空时只标出放置区。 */
  #showDrop(drop: CanvasDrop | undefined): void {
    const parts = this.#ensureParts()
    if (this.#dropList !== drop?.list) {
      this.#dropList?.removeAttribute('data-drop-target')
      this.#dropList = drop?.list
      this.#dropList?.setAttribute('data-drop-target', '')
    }
    const indicator = parts.dropIndicator
    const edge = drop?.before?.getBoundingClientRect().top ?? drop?.after?.getBoundingClientRect().bottom
    if (drop === undefined || edge === undefined) {
      indicator.hidden = true
      return
    }
    const canvas = parts.canvas
    const base = canvas.getBoundingClientRect()
    const list = drop.list.getBoundingClientRect()
    indicator.style.top = `${edge - base.top + canvas.scrollTop}px`
    indicator.style.left = `${list.left - base.left + canvas.scrollLeft}px`
    indicator.style.width = `${list.width}px`
    indicator.hidden = false
  }

  #renderCanvas(): void {
    this.#rendered = this.#editor.document
    this.#canvas.render(this.#editor.document)
    this.#canvas.select(this.#editor.selection)
  }

  #documentChanged(): void {
    this.requestUpdate()
    this.#syncDirty()
    const issues = this.validate()
    if (!sameIssues(issues, this.#issues)) {
      this.#issues = issues
      emitEvent(this, 'issues-change', { issues })
    }
  }

  #syncDirty(): void {
    const dirty = this.#editor.history.dirty
    if (dirty === this.#dirty)
      return
    this.#dirty = dirty
    emitEvent(this, 'dirty-change', { dirty })
  }

  /** 把区域所在的标签页切过去、所在的折叠项展开，连同它所在容器的上级。 */
  #openRegion(id: string): void {
    const owner = findRegion(this.#editor.document, id)
    if (owner === undefined)
      return
    this.#openAncestors(owner.container.id)
    this.#openContainer(owner.container, id)
  }

  /** 切到标签页容器的这一页，或展开折叠容器的这一项；别的容器不动。 */
  #openContainer(container: FormNode, region: string): void {
    const host = this.#canvas.nodeElement(container.id)?.querySelector<HTMLElement & { value?: unknown }>(container.kind === 'tabs' ? 'xh-tabs' : 'xh-accordion')
    if (host === null || host === undefined)
      return
    if (container.kind === 'tabs')
      host.value = region
    else if (container.kind === 'collapse')
      host.value = [...new Set([...(Array.isArray(host.value) ? host.value as string[] : []), region])]
  }

  /** 把节点所在的标签页切过去、所在的折叠项展开。 */
  #openAncestors(id: string): void {
    const found = findNode(this.#editor.document, id)
    if (found === undefined)
      return
    let region = found.region
    while (region !== null) {
      const owner = findRegion(this.#editor.document, region.id)
      if (owner === undefined)
        return
      this.#openContainer(owner.container, region.id)
      const parent = findNode(this.#editor.document, owner.container.id)
      region = parent?.region ?? null
    }
  }

  #selectTarget(target: CanvasTarget, additive: boolean): void {
    if (target.kind === 'blank') {
      this.#editor.clearSelection()
      return
    }
    const mode = additive ? 'toggle' : 'replace'
    this.#editor.select(target.kind === 'node' ? { nodes: [target.id] } : { regions: [target.id] }, mode)
  }

  readonly #onCanvasClick = (event: MouseEvent): void => {
    if (this.#suppressClick) {
      this.#suppressClick = false
      return
    }
    if ((this.mode ?? 'design') !== 'design')
      return
    this.#selectTarget(this.#canvas.targetOf(event.target), event.shiftKey || event.ctrlKey || event.metaKey)
  }

  readonly #onCanvasDblclick = (event: MouseEvent): void => {
    const target = this.#canvas.targetOf(event.target)
    if (target.kind === 'node')
      emitEvent(this, 'node-dblclick', { id: target.id })
  }

  /**
   * 右键：指针落在选择之外的节点或区域上时先选中它，落在空白处时清空选择；用键盘打开时照当前选择，菜单贴在选中节点下方。
   * 先派发可取消的 node-contextmenu / blank-contextmenu，宿主不取消时在指针处打开内建菜单；浏览器自己的菜单一律不出。
   */
  readonly #onCanvasContextMenu = (event: MouseEvent): void => {
    if ((this.mode ?? 'design') !== 'design')
      return
    event.preventDefault()
    const keyboard = event.target === this.#parts?.canvas
    const target = this.#canvas.targetOf(event.target)
    const selection = this.#editor.selection
    if (target.kind === 'node' && !selection.nodes.includes(target.id))
      this.#editor.select({ nodes: [target.id] })
    else if (target.kind === 'region' && !(selection.regions ?? []).includes(target.id))
      this.#editor.select({ regions: [target.id] })
    else if (target.kind === 'blank' && !keyboard)
      this.#editor.clearSelection()
    this.#requestMenu(target.kind === 'node' ? target.id : undefined, keyboard ? this.#selectionAnchor() : { x: event.clientX, y: event.clientY })
  }

  /** 派发可取消的 node-contextmenu（给了节点时）或 blank-contextmenu，宿主不取消时在 position 处打开内建菜单。 */
  #requestMenu(node: string | undefined, position: { readonly x: number, readonly y: number }): void {
    const proceed = node !== undefined
      ? emitEvent(this, 'node-contextmenu', { id: node, ...position }, { cancelable: true })
      : emitEvent(this, 'blank-contextmenu', position, { cancelable: true })
    if (proceed)
      void this.#openMenu(position)
  }

  /** 用键盘打开菜单时的锚点：选中节点或区域的左下角，没有选择时是画布左上角。 */
  #selectionAnchor(): { x: number, y: number } {
    const selection = this.#editor.selection
    const region = selection.regions?.[0]
    const node = selection.nodes.at(-1)
    const element = (region === undefined ? undefined : this.#canvas.regionElement(region)) ?? (node === undefined ? undefined : this.#canvas.nodeElement(node)) ?? this.#parts?.canvas
    const rect = element?.getBoundingClientRect()
    return rect === undefined ? { x: 0, y: 0 } : { x: rect.left, y: rect.bottom }
  }

  /** 按当前选择列出条目，再在触发区上补一次右键，让菜单在 point 处打开；一条也没有时不打开。 */
  async #openMenu(point: { readonly x: number, readonly y: number }): Promise<void> {
    const parts = this.#ensureParts()
    if (!this.#prepareMenu(parts))
      return
    await parts.menu.updateComplete
    parts.menuTrigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y }))
  }

  /**
   * 按当前选择的主体（节点、区域、表格单元格、空白处）与 commandLayout 写出菜单条目，返回有没有条目。
   * 建好部件时也照此填一次。
   */
  #prepareMenu(parts: Pick<DesignerParts, 'menuContent'>): boolean {
    const { commands } = this.#model
    const subject = menuSubject(this.#editor.document, this.#editor.selection)
    const groups = arrangeCommands(`menu:${subject}`, commands, FORM_MENU_LAYOUTS[subject], this.commandLayout)
    renderCommandMenu(parts.menuContent, groups, commands, this.#context(), { platform: this.#kbdPlatform() })
    return groups.length > 0
  }

  readonly #onMenuSelect = (event: Event): void => {
    if (!(event instanceof CustomEvent))
      return
    event.stopPropagation()
    runCommand(this.#model.commands, (event as CustomEvent<{ value: string }>).detail.value, this.#context())
    this.#parts?.canvas.focus({ preventScroll: true })
  }

  /** 菜单收起后的下一帧，焦点还在菜单里或已经丢了时交回画布；菜单自己的焦点归还在收起那一拍之后。 */
  readonly #onMenuOpenChange = (event: Event): void => {
    event.stopPropagation()
    if ((event as CustomEvent<{ open: boolean }>).detail.open)
      return
    this.ownerDocument.defaultView?.requestAnimationFrame(() => {
      const active = this.ownerDocument.activeElement
      if (active === null || active === this.ownerDocument.body || this.#parts?.menu.contains(active))
        this.#parts?.canvas.focus({ preventScroll: true })
    })
  }

  /** 点开一条问题：选中它所在的节点、区域或表单设置，滚到它，再把焦点交给属性面板上对应的字段。 */
  readonly #onIssueActivate = (event: Event): void => {
    event.stopPropagation()
    const focus = issueFocus(this.#editor.document, (event as DesignerIssuesEventMap['issue-activate']).detail.issue)
    if (focus === undefined)
      return
    this.#editor.select(focus.selection)
    const region = focus.selection.regions?.[0]
    const node = focus.selection.nodes[0] ?? (region === undefined ? undefined : findRegion(this.#editor.document, region)?.container.id)
    if (node !== undefined)
      this.revealNode(node)
    if (focus.rule !== undefined) {
      this.#ensureParts().inspectorTabs.value = focus.rule.list
      void this.#rules.focusRule(focus.rule.list, focus.rule.id, focus.rule.path)
      return
    }
    this.#ensureParts().inspectorTabs.value = 'properties'
    if (focus.path !== undefined)
      void this.#focusProperty(focus.path)
  }

  async #focusProperty(path: JsonPath): Promise<void> {
    await this.updateComplete
    const inspector = this.#parts?.inspector
    if (inspector === undefined || !inspector.isConnected)
      return
    await inspector.updateComplete
    inspector.focusField(path)
  }

  /** 点按物料：在缺省位置新建或插入片段并选中，滚到它。 */
  readonly #onPaletteActivate = (event: Event): void => {
    event.stopPropagation()
    const subject = paletteSubject((event as DesignerPaletteEventMap['item-activate']).detail.payload)
    if (subject === undefined)
      return
    const fragment = 'kind' in subject ? undefined : this.#fragment(subject.clipboard)
    const first = 'kind' in subject ? this.addNode(subject.kind)?.id : fragment === undefined ? undefined : this.paste(fragment).nodes[0]
    if (first !== undefined)
      this.revealNode(first)
  }

  /** 按住节点拖动：拖的是选中的那组节点（按住的节点不在选择里时只拖它）。 */
  readonly #onCanvasPointerDown = (event: PointerEvent): void => {
    this.#suppressClick = false
    if (this.readonly === true || (this.mode ?? 'design') !== 'design' || !event.isPrimary || event.button !== 0)
      return
    const handle = (event.target as Element | null)?.closest<HTMLElement>('[data-part="span-handle"]')
    if (handle !== null && handle !== undefined) {
      this.#dragSpan(event, handle)
      return
    }
    const target = this.#canvas.targetOf(event.target)
    const source = target.kind === 'node' ? this.#canvas.nodeElement(target.id) : undefined
    if (target.kind !== 'node' || source === undefined)
      return
    const selected = this.#editor.selection.nodes
    const nodes = selected.includes(target.id) ? selected : [target.id]
    startDrag<FormCanvasDragPayload>(event, {
      source,
      preview: this.#dragChip(nodes),
      payload: { source: 'form-canvas', owner: this, nodes },
      onEnd: ({ dragged }) => {
        this.#suppressClick = dragged
      },
    })
  }

  /**
   * 拖区域右缘改跨度：按住时的跨度加上横向位移折成的列数，列宽取容器宽度除以总列数；从右到左时方向相反。
   * 按下到松手是一个事务，记为一步撤销；拖动中按 Esc 取消，跨度回到按下时、不留步。拖过之后不再当作点选。
   */
  #dragSpan(event: PointerEvent, handle: HTMLElement): void {
    const region = handle.closest<HTMLElement>('[data-region-id]')
    const regionId = region?.dataset.regionId
    const found = regionId === undefined ? undefined : findRegion(this.#editor.document, regionId)
    const columns = found === undefined ? undefined : spanColumns(this.#editor.registry, found.container.kind)
    const body = region?.closest('[data-node-id]')?.querySelector(':scope > [data-part="node-body"]')
    const width = body?.getBoundingClientRect().width ?? 0
    if (region === null || region === undefined || regionId === undefined || found === undefined || columns === undefined || width <= 0 || this.#editor.history.inTransaction)
      return
    event.preventDefault()
    const start = typeof found.region.props.span === 'number' ? found.region.props.span : columns
    const sign = getComputedStyle(region).direction === 'rtl' ? -1 : 1
    const canvas = this.#ensureParts().canvas
    const history = this.#editor.history
    canvas.setAttribute('data-resizing', '')
    history.begin()
    let moved = false
    let session: PointerSession | undefined
    const listening = new AbortController()
    const finish = (keep: boolean): void => {
      session?.dispose()
      listening.abort()
      this.#cancelSpanDrag = undefined
      canvas.removeAttribute('data-resizing')
      if (keep)
        history.commit()
      else
        history.rollback()
      this.#suppressClick = moved
    }
    this.ownerDocument.addEventListener('keydown', (key) => {
      if (key.key !== 'Escape')
        return
      key.preventDefault()
      key.stopPropagation()
      finish(false)
    }, { capture: true, signal: listening.signal })
    session = createPointerSession({
      doc: this.ownerDocument,
      pointerId: event.pointerId,
      onMove: ({ point }) => {
        const dx = (point.clientX - event.clientX) * sign
        moved ||= dx !== 0
        const span = Math.round(start + dx / (width / columns))
        const current = findRegion(this.#editor.document, regionId)?.region.props.span
        if (span !== current)
          this.#editor.setGridSpan(regionId, span)
      },
      onEnd: () => finish(true),
    })
    this.#cancelSpanDrag = () => finish(false)
  }

  /** 拖动节点时跟着指针的小标签：节点的种类与键，多个时带上个数。 */
  #dragChip(nodes: readonly string[]): HTMLElement {
    const first = findNode(this.#editor.document, nodes[0]!)?.node
    const key = first === undefined || first.type === 'static' ? undefined : first.key
    const label = first === undefined ? '' : this.#t().nodeTag(first.kind, key)
    return createAuthoredElement(this.ownerDocument, 'div', { 'data-form-drag-chip': '' }, [nodes.length > 1 ? `${label} +${nodes.length - 1}` : label])
  }

  readonly #onPanRequest = (event: Event): void => {
    const { dx, dy } = (event as CustomEvent<PanRequestDetail>).detail
    this.#parts?.canvas.scrollBy(dx, dy)
  }

  /** 面板的写入换成编辑操作；同一合并键的连续写入并成一步，直到 property-commit。 */
  readonly #onPropertyChange = (event: Event): void => {
    event.stopPropagation()
    const view = this.#propertyView
    if (this.readonly === true || view === undefined)
      return
    const { path, value, targets, merge } = (event as DesignerPropertiesEventMap['property-change']).detail
    const operations = propertyOperations(view.scope, path, value, targets)
    if (operations.length > 0)
      this.#editor.execute(operations, { merge, mergeWithin: Infinity })
  }

  readonly #onPropertyCommit = (event: Event): void => {
    event.stopPropagation()
    this.#editor.seal()
  }

  /**
   * 焦点在设计器里时，复制、剪切写进剪贴板事件的数据，粘贴读出表单的剪贴板内容；别的内容不处理。
   * 焦点在文字输入里时归输入框；画布外页面上选着一段文字时，复制与剪切归浏览器。
   */
  readonly #onClipboard = (event: ClipboardEvent): void => {
    const data = event.clipboardData
    const parts = this.#parts
    const active = this.ownerDocument.activeElement
    if (!data || !parts || active === null || !parts.frame.contains(active) || isTextEntry(active) || (this.mode ?? 'design') !== 'design')
      return
    const selected = this.ownerDocument.getSelection()
    if (event.type !== 'paste' && !parts.canvas.contains(active) && selected !== null && !selected.isCollapsed)
      return
    if (event.type === 'paste') {
      const content = this.readonly === true ? undefined : readFormClipboard(data, this.#extensions)
      if (content) {
        this.paste(content)
        event.preventDefault()
      }
      return
    }
    const copied = event.type === 'copy' ? this.copy() : this.cut()
    if (!copied)
      return
    writeFormClipboard(data, copied)
    event.preventDefault()
  }

  /**
   * 菜单键与 Shift+F10 打开右键菜单；命令的快捷键按平台认 Mod（macOS 上是 ⌘）执行命中的可用命令。
   * 没有命令占用时：Ctrl / ⌘+Y 重做，Backspace 删除，方向键在同一层里移动选择，Alt 加方向键移动节点，Enter 选第一个子节点，Esc 选上一级再清空。
   * 焦点在画布外（物料、属性、问题列表）时只认带 Ctrl / ⌘ 的快捷键，单键留给那里的列表与控件；焦点在文字输入里、
   * 或里面的组件已经处理过这个键时不接，输入框自己的撤销照旧。
   */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if ((this.mode ?? 'design') !== 'design')
      return
    const inCanvas = this.#parts?.canvas.contains(event.target as Node | null) === true
    if (!inCanvas && (event.defaultPrevented || isTextEntry(event.target) || !(event.ctrlKey || event.metaKey)))
      return
    if (inCanvas && (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey))) {
      event.preventDefault()
      this.#requestMenu(this.#editor.selection.nodes.at(-1), this.#selectionAnchor())
      return
    }
    const context = this.#context()
    const hit = commandForShortcut(this.#model.commands.values(), event, context, this.#kbdPlatform())
    if (hit !== undefined) {
      event.preventDefault()
      hit.run(context)
      return
    }
    if (inCanvas && !event.ctrlKey && !event.metaKey && this.#onPlainKey(event))
      event.preventDefault()
  }

  #onPlainKey(event: KeyboardEvent): boolean {
    const selection = this.#editor.selection
    const current = selection.nodes.at(-1)
    switch (event.key) {
      case 'Backspace':
        return this.deleteSelection()
      case 'Escape': {
        if (current === undefined && selection.regions === undefined)
          return false
        const parent = this.#parentOf(selection)
        if (parent === undefined)
          this.#editor.clearSelection()
        else
          this.#editor.select({ nodes: [parent] })
        return true
      }
      case 'Enter': {
        const found = current === undefined ? undefined : findNode(this.#editor.document, current)
        const first = found?.node.type === 'container' ? found.node.regions.find(region => region.children.length > 0)?.children[0] : undefined
        if (first === undefined)
          return false
        this.#editor.select({ nodes: [first.id] })
        return true
      }
      case 'ArrowUp':
      case 'ArrowDown':
        return current !== undefined && (event.altKey ? this.#moveBy(current, event.key === 'ArrowUp' ? -1 : 1, { merge: nudgeMergeKey([current]), mergeWithin: HISTORY_NUDGE_MERGE_WITHIN }) : this.#selectSibling(current, event.key === 'ArrowUp' ? -1 : 1))
      default:
        return false
    }
  }

  #parentOf(selection: FormSelection): string | undefined {
    const region = selection.regions?.[0]
    if (region !== undefined)
      return findRegion(this.#editor.document, region)?.container.id
    const current = selection.nodes.at(-1)
    const found = current === undefined ? undefined : findNode(this.#editor.document, current)
    if (found?.region === null || found?.region === undefined)
      return undefined
    return findRegion(this.#editor.document, found.region.id)?.container.id
  }

  #siblings(id: string): { readonly parent: string | null, readonly ids: readonly string[], readonly index: number } | undefined {
    const found = findNode(this.#editor.document, id)
    if (found === undefined)
      return undefined
    const children = found.region === null ? this.#editor.document.children : found.region.children
    return { parent: found.region?.id ?? null, ids: children.map(node => node.id), index: found.index }
  }

  #selectSibling(id: string, step: number): boolean {
    const siblings = this.#siblings(id)
    const next = siblings?.ids[siblings.index + step]
    if (next === undefined)
      return false
    this.#editor.select({ nodes: [next] })
    this.revealNode(next)
    return true
  }

  #moveBy(id: string, step: number, options?: ExecuteOptions): boolean {
    if (this.readonly === true)
      return false
    const siblings = this.#siblings(id)
    if (siblings === undefined)
      return false
    const index = siblings.index + (step < 0 ? -1 : 2)
    if (index < 0 || index > siblings.ids.length)
      return false
    return this.#editor.moveNodes([id], { parent: siblings.parent, index }, options)
  }
}

/**
 * 注册 <xh-form-designer> 与它用到的全部元素：渲染器（画布与预览共用）及其库内元素、工具栏与菜单等库内元素、
 * 设计器零件；重复调用不报错。宿主自定义字段渲染器用到的元素由宿主注册。
 */
export function defineFormDesigner(): void {
  defineFormRenderer()
  defineXhElement('xh-toolbar', XhToolbarElement)
  defineXhElement('xh-tooltip', XhTooltipElement)
  defineXhElement('xh-button', XhButtonElement)
  defineXhElement('xh-icon', XhIconElement)
  defineXhElement('xh-menu', XhMenuElement)
  defineXhElement('xh-context-menu', XhContextMenuElement)
  defineXhElement('xh-expression-input', XhExpressionInputElement)
  defineDesignerShellElement('xh-designer-frame', XhDesignerFrameElement)
  defineDesignerShellElement('xh-designer-properties', XhDesignerPropertiesElement)
  defineDesignerShellElement('xh-designer-palette', XhDesignerPaletteElement)
  defineDesignerShellElement('xh-designer-issues', XhDesignerIssuesElement)
  defineDesignerShellElement('xh-designer-settings', XhDesignerSettingsElement)
  registerElement(FORM_DESIGNER_TAG, XhFormDesigner)
}

declare global {
  interface HTMLElementTagNameMap {
    'xh-form-designer': XhFormDesigner
  }
}
