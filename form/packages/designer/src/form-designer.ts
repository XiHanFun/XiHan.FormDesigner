/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// <xh-form-designer>：表单设计器。编辑模型在 editor.ts，画布在 canvas.ts；版式交给 <xh-designer-frame>：
// 工具栏、物料、属性与问题列表按 panels 显示，画布常驻。预览态换成 <xh-form-renderer>，只留工具栏。

import type { FormDocument, FormNode, FormOperation, FormSchemaIssue, RuleList } from '@xihan-form/core'
import type { FormDesignerTranslations, FormRendererTranslations, OptionLoader, XhFormRenderer } from '@xihan-form/runtime'
import type { IconRecord } from '@xihan-ui/core'
import type { JsonPath, JsonValue } from '@xihan-ui/core/json'
import type { ExecuteOptions, ExtensionHost } from '@xihan-ui/designer-kit'
import type { CommandToolbar, DesignerCommandLayout, DesignerFrameRegion, DesignerIssuesEventMap, DesignerPaletteEventMap, DesignerPanelHost, DesignerPropertiesEventMap, DesignerPropertyDescriptor, PanRequestDetail } from '@xihan-ui/designer-shell'
import type { ExpressionEngine } from '@xihan-ui/expression'
import type { PropertyValues } from '@xihan-ui/web-components/authoring'
import type { CanvasDrop, CanvasTarget } from './canvas'
import type { FormDesignerContext } from './commands'
import type { FormClipboard, FormDropTarget, FormEditor, FormSelection } from './editor'
import type { FormDesignerExtension, FormDesignerModel } from './extensions'
import type { FormDesignerMode } from './internals'
import type { FormCanvasDragPayload, FormDragSubject } from './palette'
import type { PropertyView } from './properties'
import { createDocument, findNode, findRegion, PROPERTY_GROUPS, validateDocument } from '@xihan-form/core'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS, DEFAULT_FORM_RENDERER_TRANSLATIONS, defineFormRenderer, FORM_RENDERER_TAG } from '@xihan-form/runtime'
import { detectKbdPlatform } from '@xihan-ui/core/hotkey'
import { commandForShortcut, createExtensionHost } from '@xihan-ui/designer-kit'
import { arrangeCommands, createCommandToolbar, createPanelHost, defineDesignerShellElement, DESIGNER_FRAME_REGIONS, parseDesignerPanels, registerDropTarget, renderCommandMenu, runCommand, startDrag, XhDesignerFrameElement, XhDesignerIssuesElement, XhDesignerPaletteElement, XhDesignerPropertiesElement } from '@xihan-ui/designer-shell'
import { createExpressionEngine } from '@xihan-ui/expression'
import { ArrowDownIcon, ArrowUpIcon, ArrowUpLeftIcon, CopyIcon, TrashIcon } from '@xihan-ui/icons'
import { createPointerSession } from '@xihan-ui/pointer'
import { createAuthoredElement, emitEvent, registerElement, setAttributes, setText, SVG_NS, XhConfigController, XhReactiveElement } from '@xihan-ui/web-components/authoring'
import { defineXhElement, XhButtonElement, XhContextMenuElement, XhExpressionInputElement, XhIconElement, XhMenuElement, XhToolbarElement } from '@xihan-ui/web-components/define'
import { DesignCanvas, spanColumns } from './canvas'
import { checkFormClipboard, readFormClipboard, writeFormClipboard } from './clipboard'
import { FORM_MENU_LAYOUTS, FORM_TOOLBAR_LAYOUT, menuSubject } from './commands'
import { createFormEditor } from './editor'
import { createFormDesignerModel, FORM_DESIGNER_EXTENSION } from './extensions'
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

/** 可收起的面板；画布常驻，不在其中。 */
export type FormDesignerPanel = 'toolbar' | 'palette' | 'properties' | 'issues'

/** 设计器派发的事件。 */
export interface FormDesignerEventMap {
  'schema-change': CustomEvent<{ schema: FormDocument, operations: readonly FormOperation[], kind: FormSchemaChangeKind }>
  'selection-change': CustomEvent<FormSelection>
  'dirty-change': CustomEvent<{ dirty: boolean }>
  'issues-change': CustomEvent<{ issues: readonly FormSchemaIssue[] }>
  'save': CustomEvent<Record<string, never>>
  'node-dblclick': CustomEvent<{ id: string }>
  'node-contextmenu': CustomEvent<{ id: string, x: number, y: number }>
  'blank-contextmenu': CustomEvent<{ x: number, y: number }>
  'mode-change': CustomEvent<{ mode: FormDesignerMode }>
}

const CLIPBOARD_EVENTS = ['copy', 'cut', 'paste'] as const

const NO_EXTENSIONS: readonly FormDesignerExtension[] = Object.freeze([])

type NodeAction = 'parent' | 'up' | 'down' | 'duplicate' | 'delete'

type InspectorTab = 'properties' | RuleList

const INSPECTOR_TABS: readonly InspectorTab[] = ['properties', 'validation', 'linkage']

const TAB_LABELS: Readonly<Record<InspectorTab, 'propertiesTab' | 'validationTab' | 'linkageTab'>> = {
  properties: 'propertiesTab',
  validation: 'validationTab',
  linkage: 'linkageTab',
}

/** 选中节点右下角小工具条上的按钮：选父级、上移、下移、再制、删除。 */
const NODE_ACTIONS: readonly { readonly action: NodeAction, readonly icon: IconRecord, readonly label: 'selectParent' | 'moveUp' | 'moveDown' | 'duplicate' | 'delete' }[] = [
  { action: 'parent', icon: ArrowUpLeftIcon, label: 'selectParent' },
  { action: 'up', icon: ArrowUpIcon, label: 'moveUp' },
  { action: 'down', icon: ArrowDownIcon, label: 'moveDown' },
  { action: 'duplicate', icon: CopyIcon, label: 'duplicate' },
  { action: 'delete', icon: TrashIcon, label: 'delete' },
]

/** 设计器的各个部件；面板与画布按 slot 放进外框的同名区。 */
interface DesignerParts {
  readonly frame: XhDesignerFrameElement
  /** 扩展登记的面板。 */
  readonly panels: DesignerPanelHost<FormDesignerContext>
  readonly toolbar: HTMLElement
  readonly commandBar: CommandToolbar<FormDesignerContext>
  readonly canvas: HTMLElement
  readonly palette: HTMLElement
  readonly catalog: XhDesignerPaletteElement
  readonly dropIndicator: HTMLElement
  /** 选中一个节点时挂进它的外框，没有时不在文档里。 */
  readonly nodeToolbar: HTMLElement
  readonly properties: HTMLElement
  /** 属性区的三个页签：属性、校验规则、联动规则。 */
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
}

function sameIssues(a: readonly FormSchemaIssue[], b: readonly FormSchemaIssue[]): boolean {
  return a.length === b.length && JSON.stringify(a) === JSON.stringify(b)
}

export class XhFormDesigner extends XhReactiveElement {
  static override properties = {
    expressionEngine: { attribute: false },
    commandLayout: { attribute: false },
    previewValues: { attribute: false },
    loadOptions: { attribute: false },
    translations: { attribute: false },
    readonly: { type: Boolean },
    mode: { converter: { fromAttribute: (value: string | null) => (value === 'preview' ? 'preview' : 'design') } },
    previewWidth: { attribute: 'preview-width', converter: { fromAttribute: (value: string | null) => (value === 'tablet' || value === 'phone' ? value : 'full') } },
    panels: { converter: { fromAttribute: (value: string | null) => value ?? undefined } },
  }

  /** 校验表达式与预览用，缺省为 createExpressionEngine()。 */
  declare expressionEngine: ExpressionEngine | undefined
  /**
   * 工具栏与右键菜单的排列：位置（toolbar、menu:node、menu:region、menu:cell、menu:blank）→ 若干组命令 id，内置命令与扩展命令混排。
   * 写了某个位置就只显示列出的；没写的位置用内置的缺省排列，再把 placement 含它的扩展命令追加成一组。
   */
  declare commandLayout: DesignerCommandLayout | undefined
  /** 预览的示例数据。 */
  declare previewValues: Readonly<Record<string, JsonValue>> | undefined
  /** 预览的选项加载。 */
  declare loadOptions: OptionLoader | undefined
  /** 元素自己的文案，压在全局配置之上。 */
  declare translations: Partial<FormDesignerTranslations> | undefined
  /** 可选择、浏览与预览，不能修改。 */
  declare readonly: boolean | undefined
  /** 设计态或预览态，缺省 design。 */
  declare mode: FormDesignerMode | undefined
  /** 预览宽度，缺省 full。 */
  declare previewWidth: FormPreviewWidth | undefined
  /** 空格分隔的 toolbar palette properties issues，缺省全部；画布常驻。 */
  declare panels: string | undefined

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
  #fragments = new WeakMap<object, { readonly extensions: readonly FormDesignerExtension[] | undefined, readonly clipboard: FormClipboard | undefined }>()

  constructor() {
    super()
    this.#editor = createFormEditor({ document: createDocument() })
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
          this.#editor.mergeCells(cell.table, this.#editor.selection.regions ?? [])
      },
      splitCell: () => {
        const cell = this.#selectedCell()
        if (cell !== undefined && this.readonly !== true)
          this.#editor.splitCell(cell.table, cell.region)
      },
      insertTableLine: (axis, after) => {
        const cell = this.#selectedCell()
        if (cell === undefined || this.readonly === true)
          return
        const at = axis === 'row' ? cell.row + (after ? cell.rowSpan : 0) : cell.column + (after ? cell.columnSpan : 0)
        this.#editor.insertTableLine(cell.table, axis, at)
      },
      removeTableLine: (axis) => {
        const cell = this.#selectedCell()
        if (cell !== undefined && this.readonly !== true)
          this.#editor.removeTableLine(cell.table, axis, axis === 'row' ? cell.row : cell.column)
      },
    })
    this.#editor.subscribe((change) => {
      if (change.kind === 'selection') {
        this.#canvas.select(change.selection)
        emitEvent(this, 'selection-change', change.selection)
        this.requestUpdate()
        return
      }
      const kind: FormSchemaChangeKind | undefined = change.cause === 'execute' || change.cause === 'commit'
        ? 'execute'
        : change.cause === 'undo' || change.cause === 'redo' ? change.cause : change.cause === 'reset' ? 'load' : undefined
      this.#documentChanged()
      if (kind !== undefined)
        emitEvent(this, 'schema-change', { schema: change.document, operations: change.operations, kind })
    })
  }

  /** 当前模板；赋值即装载：清空历史与选择，赋回当前这一份不重新装载。 */
  get schema(): FormDocument {
    return this.#editor.document
  }

  set schema(value: FormDocument) {
    if (value === this.#editor.document)
      return
    this.#editor.load(value)
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

  get canUndo(): boolean {
    return this.#editor.history.canUndo
  }

  get canRedo(): boolean {
    return this.#editor.history.canRedo
  }

  /** 内部剪贴板里有内容可粘贴。 */
  get canPaste(): boolean {
    return this.#clipboard !== undefined
  }

  get dirty(): boolean {
    return this.#editor.history.dirty
  }

  override connectedCallback(): void {
    super.connectedCallback()
    const parts = this.#ensureParts()
    for (const type of CLIPBOARD_EVENTS)
      this.addEventListener(type, this.#onClipboard)
    this.#releaseDropTarget ??= registerDropTarget<unknown>(parts.canvas, {
      over: (point, payload) => this.#dragOver(point, payload),
      drop: (point, payload) => this.#drop(point, payload),
      leave: () => this.#showDrop(undefined),
    })
    this.#host.assign(this.#extensions ?? NO_EXTENSIONS)
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    for (const type of CLIPBOARD_EVENTS)
      this.removeEventListener(type, this.#onClipboard)
    this.#releaseDropTarget?.()
    this.#releaseDropTarget = undefined
    this.#host.dispose()
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed)
    const parts = this.#ensureParts()
    const mode = this.mode ?? 'design'
    const t = this.#t()
    setAttributes(parts.frame, { 'data-mode': mode, 'data-width': this.previewWidth ?? 'full', 'data-readonly': this.readonly === true, 'aria-label': t.label })
    parts.frame.panels = this.#framePanels(mode)
    this.#syncRegions(parts.frame, t)
    if (changed.has('mode'))
      this.#syncMode()
    if (this.#rendered !== this.#editor.document || changed.has('extensions') || changed.has('translations') || changed.size === 0)
      this.#renderCanvas()
    this.#syncPreview()
    this.#syncToolbar(t)
    this.#syncProperties(changed, t)
    this.#syncPalette(changed, t)
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

  undo(): boolean {
    return this.#editor.undo()
  }

  redo(): boolean {
    return this.#editor.redo()
  }

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

  select(selection: Partial<FormSelection>): void {
    this.#editor.select(selection)
  }

  getSelection(): FormSelection {
    return this.#editor.selection
  }

  deleteSelection(): boolean {
    return this.readonly !== true && this.#editor.deleteSelection()
  }

  copy(): FormClipboard | undefined {
    const copied = this.#editor.copy()
    if (copied !== undefined)
      this.#clipboard = copied
    return copied
  }

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

  #t(): FormDesignerTranslations {
    return this.#config.translations<FormDesignerTranslations>('xh-form-designer', DEFAULT_FORM_DESIGNER_TRANSLATIONS, this.translations)
  }

  /** 交给命令、面板与扩展 setup 的上下文。 */
  #context(t: FormDesignerTranslations = this.#t()): FormDesignerContext {
    return { designer: this, translations: t }
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
    const commandBar = createCommandToolbar<FormDesignerContext>(doc)
    const toolbar = createAuthoredElement(doc, 'div', { 'data-part': 'toolbar', 'slot': 'toolbar' }, [commandBar.element])
    const dropIndicator = createAuthoredElement(doc, 'div', { 'data-part': 'drop-indicator', 'aria-hidden': 'true', 'hidden': true })
    const canvas = createAuthoredElement(doc, 'div', { 'data-part': 'canvas', 'slot': 'canvas', 'tabindex': '0' }, [this.#canvas.element, dropIndicator])
    const catalog = createAuthoredElement(doc, 'xh-designer-palette', { 'data-part': 'catalog', 'searchable': true, 'collapsible': true })
    const palette = createAuthoredElement(doc, 'div', { 'data-part': 'palette', 'slot': 'palette' }, [catalog])
    const inspector = createAuthoredElement(doc, 'xh-designer-properties', { 'data-part': 'inspector', 'collapsible': true, 'toggle-limit': '3' })
    const tabTriggers = Object.fromEntries(INSPECTOR_TABS.map(tab => [tab, createAuthoredElement(doc, 'button', { 'data-xh-part': 'trigger', 'type': 'button', 'value': tab })])) as Record<InspectorTab, HTMLButtonElement>
    const tabList = createAuthoredElement(doc, 'div', { 'data-xh-part': 'list' }, [...INSPECTOR_TABS.map(tab => tabTriggers[tab]), createAuthoredElement(doc, 'div', { 'data-xh-part': 'indicator' })])
    const panel = (tab: InspectorTab, child: HTMLElement): HTMLElement => createAuthoredElement(doc, 'div', { 'data-xh-part': 'content', 'value': tab }, [child])
    const inspectorTabs: DesignerParts['inspectorTabs'] = createAuthoredElement(doc, 'xh-tabs', { 'data-part': 'inspector-tabs', 'size': 'sm' }, [
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
    const properties = createAuthoredElement(doc, 'div', { 'data-part': 'properties', 'slot': 'properties' }, [inspectorTabs])
    const problems = createAuthoredElement(doc, 'xh-designer-issues', { 'data-part': 'problems', 'group-by': 'target' })
    const issues = createAuthoredElement(doc, 'div', { 'data-part': 'issues', 'slot': 'issues' }, [problems])
    const menuTrigger = createAuthoredElement(doc, 'div', { 'data-xh-part': 'trigger', 'inert': true })
    const menuContent = createAuthoredElement(doc, 'div', { 'data-xh-part': 'content' })
    const menu = createAuthoredElement(doc, 'xh-context-menu', { 'data-part': 'menu', 'size': 'sm' }, [
      createAuthoredElement(doc, 'div', { 'data-xh-part': 'root' }, [menuTrigger, createAuthoredElement(doc, 'div', { 'data-xh-part': 'positioner' }, [menuContent])]),
    ])
    menu.addEventListener('select', this.#onMenuSelect)
    menu.addEventListener('open-change', this.#onMenuOpenChange)
    const frame = createAuthoredElement(doc, 'xh-designer-frame', { 'data-part': 'frame', 'role': 'application' }, [toolbar, palette, canvas, properties, issues, menu])
    canvas.addEventListener('click', this.#onCanvasClick)
    canvas.addEventListener('dblclick', this.#onCanvasDblclick)
    canvas.addEventListener('contextmenu', this.#onCanvasContextMenu)
    canvas.addEventListener('keydown', this.#onKeyDown)
    canvas.addEventListener('pointerdown', this.#onCanvasPointerDown)
    canvas.addEventListener('pan-request', this.#onPanRequest)
    catalog.addEventListener('item-activate', this.#onPaletteActivate)
    problems.addEventListener('issue-activate', this.#onIssueActivate)
    inspector.addEventListener('property-change', this.#onPropertyChange)
    inspector.addEventListener('property-commit', this.#onPropertyCommit)
    this.replaceChildren(frame)
    const panels = createPanelHost<FormDesignerContext>(frame)
    this.#parts = { frame, panels, toolbar, commandBar, canvas, palette, catalog, dropIndicator, nodeToolbar: this.#buildNodeToolbar(doc), properties, inspectorTabs, tabTriggers, tabList, inspector, issues, problems, menu, menuTrigger, menuContent }
    this.#prepareMenu(this.#parts)
    panels.assign(this.#model.extensions, this.#context())
    return this.#parts
  }

  /** 交给外框的 panels：设计态原样转交，预览态只留工具栏。 */
  #framePanels(mode: FormDesignerMode): string | undefined {
    if (mode === 'design')
      return this.panels
    const shown = parseDesignerPanels(this.panels)
    return shown === undefined || shown.has('toolbar') ? 'toolbar' : ''
  }

  /** 外框的区：内置区的名字换成文案（供分隔条的无障碍名称使用），后面接扩展面板的区；文案与面板都没变时不重设。 */
  #syncRegions(frame: XhDesignerFrameElement, t: FormDesignerTranslations): void {
    const labels: Readonly<Record<string, string>> = { toolbar: t.toolbar, palette: t.palette, canvas: t.canvas, properties: t.properties, issues: t.issues }
    const regions: DesignerFrameRegion[] = [
      ...DESIGNER_FRAME_REGIONS.map(region => ({ ...region, label: labels[region.name] ?? region.name })),
      ...this.#model.extensions.flatMap(extension => (extension.panels ?? []).map(panel => panel.region)),
    ]
    const key = JSON.stringify(regions)
    if (key === this.#frameRegionsKey && frame.regions?.length === regions.length)
      return
    this.#frameRegionsKey = key
    frame.regions = regions
  }

  #buildNodeToolbar(doc: Document): HTMLElement {
    const items = NODE_ACTIONS.map(({ action, icon }) => {
      const svg = doc.createElementNS(SVG_NS, 'svg')
      svg.setAttribute('data-xh-part', 'root')
      const glyph = doc.createElementNS(SVG_NS, 'g')
      glyph.setAttribute('data-xh-part', 'glyph')
      svg.append(glyph)
      const mark: HTMLElement & { icon?: IconRecord } = createAuthoredElement(doc, 'xh-icon', { size: 'sm' }, [svg])
      mark.icon = icon
      return createAuthoredElement(doc, 'button', { 'data-xh-part': 'item', 'type': 'button', 'value': action }, [mark])
    })
    const root = createAuthoredElement(doc, 'div', { 'data-xh-part': 'root' }, [createAuthoredElement(doc, 'div', { 'data-xh-part': 'group' }, items)])
    const toolbar = createAuthoredElement(doc, 'div', { 'data-part': 'node-toolbar' }, [createAuthoredElement(doc, 'xh-toolbar', { size: 'sm' }, [root])])
    toolbar.addEventListener('click', this.#onNodeToolbarClick)
    for (const type of ['pointerdown', 'dblclick', 'keydown', 'contextmenu'])
      toolbar.addEventListener(type, event => event.stopPropagation())
    return toolbar
  }

  /** 只选中一个节点、可编辑且在设计态时，把小工具条挂进它的外框，按它在同层的位置启用按钮。 */
  #syncNodeToolbar(t: FormDesignerTranslations): void {
    const toolbar = this.#ensureParts().nodeToolbar
    const selection = this.#editor.selection
    const id = selection.nodes.length === 1 && (selection.regions?.length ?? 0) === 0 ? selection.nodes[0] : undefined
    const found = id === undefined || this.readonly === true || (this.mode ?? 'design') !== 'design' ? undefined : findNode(this.#editor.document, id)
    const host = found === undefined ? undefined : this.#canvas.nodeElement(found.node.id)
    if (found === undefined || host === undefined) {
      toolbar.remove()
      return
    }
    if (toolbar.parentElement !== host)
      host.append(toolbar)
    const count = (found.region === null ? this.#editor.document.children : found.region.children).length
    const enabled: Readonly<Record<NodeAction, boolean>> = {
      parent: found.region !== null,
      up: found.index > 0,
      down: found.index < count - 1,
      duplicate: true,
      delete: true,
    }
    setAttributes(toolbar.querySelector<HTMLElement>('[data-xh-part="root"]')!, { 'aria-label': t.nodeTag(found.node.kind, found.node.type === 'static' ? undefined : found.node.key) })
    for (const button of toolbar.querySelectorAll<HTMLButtonElement>('button[value]')) {
      const entry = NODE_ACTIONS.find(item => item.action === button.value)!
      setAttributes(button, { 'aria-label': t[entry.label], 'title': t[entry.label] })
      if (button.disabled !== !enabled[entry.action])
        button.disabled = !enabled[entry.action]
    }
  }

  readonly #onNodeToolbarClick = (event: MouseEvent): void => {
    event.stopPropagation()
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button[value]')
    const id = this.#editor.selection.nodes[0]
    if (!button || button.disabled || id === undefined)
      return
    switch (button.value as NodeAction) {
      case 'parent': {
        const parent = this.#parentOf({ nodes: [id] })
        if (parent !== undefined)
          this.#editor.select({ nodes: [parent] })
        break
      }
      case 'up':
        this.#moveBy(id, -1)
        break
      case 'down':
        this.#moveBy(id, 1)
        break
      case 'duplicate':
        this.duplicate()
        break
      case 'delete':
        this.deleteSelection()
        break
    }
    this.#parts?.canvas.focus({ preventScroll: true })
  }

  /** 工具栏按 commandLayout 或缺省排列铺命令，文字、可用与选中状态每次刷新。 */
  #syncToolbar(t: FormDesignerTranslations): void {
    const { commands } = this.#model
    this.#ensureParts().commandBar.update(arrangeCommands('toolbar', commands, FORM_TOOLBAR_LAYOUT, this.commandLayout), commands, this.#context(t), t.toolbar)
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

  /** 扩展或文案变了时重排物料。 */
  #syncPalette(changed: PropertyValues, t: FormDesignerTranslations): void {
    const catalog = this.#ensureParts().catalog
    if (catalog.groups === undefined || changed.has('extensions') || changed.has('translations') || changed.size === 0)
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
      const host = this.#canvas.nodeElement(owner.container.id)?.querySelector<HTMLElement & { value?: unknown }>(owner.container.kind === 'tabs' ? 'xh-tabs' : 'xh-accordion')
      if (host !== null && host !== undefined) {
        if (owner.container.kind === 'tabs')
          host.value = region.id
        else if (owner.container.kind === 'collapse')
          host.value = [...new Set([...(Array.isArray(host.value) ? host.value as string[] : []), region.id])]
      }
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
   * 拖动中连续写入并成一步撤销，松手时封口；拖过之后不再当作点选。
   */
  #dragSpan(event: PointerEvent, handle: HTMLElement): void {
    const region = handle.closest<HTMLElement>('[data-region-id]')
    const regionId = region?.dataset.regionId
    const found = regionId === undefined ? undefined : findRegion(this.#editor.document, regionId)
    const columns = found === undefined ? undefined : spanColumns(this.#editor.registry, found.container.kind)
    const body = region?.closest('[data-node-id]')?.querySelector(':scope > [data-part="node-body"]')
    const width = body?.getBoundingClientRect().width ?? 0
    if (region === null || region === undefined || regionId === undefined || found === undefined || columns === undefined || width <= 0)
      return
    event.preventDefault()
    const start = typeof found.region.props.span === 'number' ? found.region.props.span : columns
    const sign = getComputedStyle(region).direction === 'rtl' ? -1 : 1
    const canvas = this.#ensureParts().canvas
    canvas.setAttribute('data-resizing', '')
    let moved = false
    const session = createPointerSession({
      doc: this.ownerDocument,
      pointerId: event.pointerId,
      onMove: ({ point }) => {
        const dx = (point.clientX - event.clientX) * sign
        moved ||= dx !== 0
        const span = Math.round(start + dx / (width / columns))
        const current = findRegion(this.#editor.document, regionId)?.region.props.span
        if (span !== current)
          this.#editor.setGridSpan(regionId, span, { mergeWithin: Number.POSITIVE_INFINITY })
      },
      onEnd: () => {
        session.dispose()
        canvas.removeAttribute('data-resizing')
        this.#editor.seal()
        this.#suppressClick = moved
      },
    })
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

  /** 画布有焦点时，复制、剪切写进剪贴板事件的数据，粘贴读出表单的剪贴板内容；别的内容不处理。 */
  readonly #onClipboard = (event: ClipboardEvent): void => {
    const data = event.clipboardData
    const canvas = this.#parts?.canvas
    if (!data || !canvas || !canvas.contains(this.ownerDocument.activeElement) || (this.mode ?? 'design') !== 'design')
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
   */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if ((this.mode ?? 'design') !== 'design')
      return
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey)) {
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
    const command = event.ctrlKey || event.metaKey
    if (command && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'y') {
      event.preventDefault()
      if (this.readonly !== true)
        this.redo()
      return
    }
    if (!command && this.#onPlainKey(event))
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
        return current !== undefined && (event.altKey ? this.#moveBy(current, event.key === 'ArrowUp' ? -1 : 1) : this.#selectSibling(current, event.key === 'ArrowUp' ? -1 : 1))
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

  #moveBy(id: string, step: number): boolean {
    if (this.readonly === true)
      return false
    const siblings = this.#siblings(id)
    if (siblings === undefined)
      return false
    const index = siblings.index + (step < 0 ? -1 : 2)
    if (index < 0 || index > siblings.ids.length)
      return false
    return this.#editor.moveNodes([id], { parent: siblings.parent, index })
  }
}

/**
 * 注册 <xh-form-designer> 与它用到的全部元素：渲染器（画布与预览共用）及其库内元素、工具栏与菜单等库内元素、
 * 设计器零件；重复调用不报错。宿主自定义字段渲染器用到的元素由宿主注册。
 */
export function defineFormDesigner(): void {
  defineFormRenderer()
  defineXhElement('xh-toolbar', XhToolbarElement)
  defineXhElement('xh-button', XhButtonElement)
  defineXhElement('xh-icon', XhIconElement)
  defineXhElement('xh-menu', XhMenuElement)
  defineXhElement('xh-context-menu', XhContextMenuElement)
  defineXhElement('xh-expression-input', XhExpressionInputElement)
  defineDesignerShellElement('xh-designer-frame', XhDesignerFrameElement)
  defineDesignerShellElement('xh-designer-properties', XhDesignerPropertiesElement)
  defineDesignerShellElement('xh-designer-palette', XhDesignerPaletteElement)
  defineDesignerShellElement('xh-designer-issues', XhDesignerIssuesElement)
  registerElement(FORM_DESIGNER_TAG, XhFormDesigner)
}

declare global {
  interface HTMLElementTagNameMap {
    'xh-form-designer': XhFormDesigner
  }
}
