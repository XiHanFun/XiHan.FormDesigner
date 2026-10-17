/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// <xh-form-renderer>：按表单模板渲染表单。值、联动、校验与选项都在表单控制器里，
// 外层用 UI 的 <xh-form> 承担提交、错误摘要、落焦与整表的禁用、只读，它的 values 与 errors 由控制器驱动；
// 每个字段用 <xh-field> 包住控件，给出标签、提示与错误文案。

import type { ContainerNode, FieldNode, FormDocument, FormNode, FormSchemaIssue, NodeState, StaticNode, ValueIssue } from '@xihan-form/core'
import type { JsonPath, JsonValue } from '@xihan-ui/core/json'
import type { ExpressionEngine } from '@xihan-ui/expression'
import type { FormArrayMutation } from '@xihan-ui/headless'
import type { PropertyValues } from '@xihan-ui/web-components/authoring'
import type { FormRuntimeExtension, FormRuntimeModel } from '../extensions'
import type { FormController, FormEvent, GetFormDataOptions, LinkageIssue, SetFormDataOptions, ValidationOutcome } from '../state/controller'
import type { FormRuntimeErrorCode } from '../state/errors'
import type { OptionLoader } from '../state/options'
import type { FormRendererTranslations } from '../translations'
import type { FieldShell } from './field-shell'
import type { ListRow, ListShell } from './list'
import type { FieldRendererContext, FieldRendererInstance, FieldSize, FileUploader } from './types'
import { instanceKey } from '@xihan-form/core'
import { isJsonPathPrefix, jsonEquals } from '@xihan-ui/core/json'
import { createExpressionEngine } from '@xihan-ui/expression'
import { createFormPathRecord, focusFormField } from '@xihan-ui/headless'
import { emitEvent, registerElement, XhConfigController, XhReactiveElement } from '@xihan-ui/web-components/authoring'
import { createFormRuntimeModel } from '../extensions'
import { createFormController } from '../state/controller'
import { FormRuntimeError } from '../state/errors'
import { optionsDescriptor, optionSourceOf } from '../state/options'
import { isListContainer } from '../state/paths'
import { DEFAULT_FORM_RENDERER_TRANSLATIONS } from '../translations'
import { make, stringOf, text } from './dom'
import { createFieldShell } from './field-shell'
import { createListRow, createListShell } from './list'
import { issueMessage } from './messages'
import { defineRendererElements } from './ui-elements'

/** 渲染器的标签名。 */
export const FORM_RENDERER_TAG = 'xh-form-renderer'

/** 单字段首次校验的时机。 */
export type FormValidateOn = 'submit' | 'blur' | 'change'

/** 提交通过校验后调用的异步动作；返回的 thenable 落定前表单处于提交中。 */
export type FormSubmitAction = (detail: { readonly values: Record<string, JsonValue> }) => PromiseLike<unknown> | void

/** 渲染器派发的事件。 */
export interface FormRendererEventMap {
  'ready': CustomEvent<{ controller: FormController }>
  'schema-error': CustomEvent<{ code: FormRuntimeErrorCode, data: Readonly<Record<string, string | number>>, issues: readonly FormSchemaIssue[] }>
  'value-change': CustomEvent<{ paths: readonly JsonPath[], values: Record<string, JsonValue> }>
  'issues-change': CustomEvent<{ paths: readonly JsonPath[], issues: readonly ValueIssue[] }>
  'submit': CustomEvent<{ values: Record<string, JsonValue> }>
  'invalid': CustomEvent<{ issues: readonly ValueIssue[], values: Record<string, JsonValue> }>
  'submit-error': CustomEvent<{ cause: unknown, values: Record<string, JsonValue> }>
  'linkage-error': CustomEvent<{ issues: readonly LinkageIssue[] }>
}

/** 改了就要重建控制器的属性。 */
const REBUILD = new Set<PropertyKey>(['schema', 'extensions', 'expressionEngine', 'loadOptions'])

const NO_EXTENSIONS: readonly FormRuntimeExtension[] = Object.freeze([])

/** 内部 UI 元素冒出的事件，在 <xh-form> 上截住，不越过渲染器。 */
const INTERNAL_EVENTS = [
  'value-change',
  'checked-change',
  'input-value-change',
  'open-change',
  'clear',
  'revealed-change',
  'value-complete',
  'value-change-end',
  'hover-change',
  'expanded-value-change',
  'focused-value-change',
  'active-view-change',
  'tab-move',
  'tab-close',
  'values-change',
  'errors-change',
  'validation-error',
  'issues-change',
  'ready',
  'schema-error',
  'linkage-error',
] as const

/** <xh-form> 上由渲染器接手的事件。 */
const FORM_EVENTS = ['submit', 'invalid', 'submit-error'] as const

type XhFormHost = HTMLElement & {
  values?: unknown
  errors?: unknown
  validate?: () => unknown
  submitAction?: () => PromiseLike<unknown> | void
  layout?: string
  disabled?: boolean
  readOnly?: boolean
  submit?: () => void
}

interface FieldEntry {
  readonly node: FieldNode
  readonly path: JsonPath
  readonly key: string
  readonly group: HTMLElement
  readonly summary: HTMLElement
  readonly instance: FieldRendererInstance
  readonly shell: FieldShell
}

interface NodeEntry {
  readonly update: (state: NodeState) => void
}

/** 节点所在的行：数据路径的前缀与逐层行号；顶层两者都为空。 */
interface RowScope {
  readonly prefix: JsonPath
  readonly rowPath: readonly number[]
  /** 在表格排布的格子里：列头已给出字段名，字段标签只在视觉上隐藏。 */
  readonly cell?: boolean
}

/** 一段内容建出的登记项，删行时一并收回。 */
interface Owned {
  readonly fields: string[]
  readonly nodes: string[]
  readonly lists: string[]
}

/** 列表里的一行：身份是令牌，行号变了时重建行内容。 */
interface RowEntry {
  readonly row: ListRow
  index: number
  owned: Owned
}

/** 列表容器的实例：令牌数组即 xh-field-array 的值，与列表的行一一对应。 */
interface ListEntry {
  readonly node: ContainerNode
  readonly path: JsonPath
  readonly key: string
  readonly rowPath: readonly number[]
  readonly group: HTMLElement
  readonly summary: HTMLElement
  readonly shell: ListShell
  readonly rows: Map<object, RowEntry>
  tokens: object[]
}

const TOP: RowScope = Object.freeze({ prefix: [], rowPath: [] })

function owned(): Owned {
  return { fields: [], nodes: [], lists: [] }
}

function pathKey(path: JsonPath): string {
  return JSON.stringify(path)
}

function related(a: JsonPath, b: JsonPath): boolean {
  return isJsonPathPrefix(a, b) || isJsonPathPrefix(b, a)
}

export class XhFormRenderer extends XhReactiveElement {
  static override properties = {
    schema: { attribute: false },
    expressionEngine: { attribute: false },
    values: { attribute: false },
    variables: { attribute: false },
    loadOptions: { attribute: false },
    uploadFile: { attribute: false },
    readonly: { type: Boolean },
    disabled: { type: Boolean },
    validateOn: { attribute: 'validate-on' },
    submitAction: { attribute: false },
    translations: { attribute: false },
  }

  /** 表单模板。 */
  declare schema: FormDocument | undefined
  /** 表达式引擎，缺省为 @xihan-ui/expression 的 createExpressionEngine()。 */
  declare expressionEngine: ExpressionEngine | undefined
  /** 初始数据兼 reset 与 isDirty 的基准；控制器建好后再赋值等于 setFormData(values, { baseline: true })，与当前值相同时不动。 */
  declare values: Readonly<Record<string, JsonValue>> | undefined
  /** 宿主提供给表达式的变量，名字以 `$` 开头。 */
  declare variables: Readonly<Record<string, unknown>> | undefined
  /** 选项加载函数。 */
  declare loadOptions: OptionLoader | undefined
  /** 文件字段的上传函数，交给 xh-file-upload 的 upload；组件自己不发请求。 */
  declare uploadFile: FileUploader | undefined
  /** 整表只读：仍可提交。 */
  declare readonly: boolean | undefined
  /** 整表禁用：不能提交。 */
  declare disabled: boolean | undefined
  /** 单字段首次校验的时机，缺省 `blur`；校验过的字段此后随改值重算。 */
  declare validateOn: FormValidateOn | undefined
  /** 提交通过校验后调用的异步动作。 */
  declare submitAction: FormSubmitAction | undefined
  /** 元素自己的文案，压在全局配置之上。 */
  declare translations: Partial<FormRendererTranslations> | undefined

  readonly #config = new XhConfigController(this)
  #controller: FormController | null = null
  #unsubscribe: (() => void) | undefined
  #defaultEngine: ExpressionEngine | undefined
  #extensions: readonly FormRuntimeExtension[] | undefined
  #model: FormRuntimeModel = createFormRuntimeModel(NO_EXTENSIONS)
  #rebuild = true
  #valuesDirty = false
  #variablesDirty = false
  #form: XhFormHost | undefined
  #formRoot: HTMLFormElement | undefined
  #summaryTitle: HTMLElement | undefined
  #summary: HTMLElement | undefined
  #fields = new Map<string, FieldEntry>()
  #fieldsByKey = new Map<string, FieldEntry>()
  #nodes = new Map<string, NodeEntry>()
  #lists = new Map<string, ListEntry>()
  #linkageIssues: readonly LinkageIssue[] = []

  override requestUpdate(name?: PropertyKey, oldValue?: unknown): void {
    if (name !== undefined && !Object.is((this as unknown as Record<PropertyKey, unknown>)[name], oldValue)) {
      if (REBUILD.has(name))
        this.#rebuild = true
      else if (name === 'values')
        this.#valuesDirty = true
      else if (name === 'variables')
        this.#variablesDirty = true
    }
    super.requestUpdate(name, oldValue)
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed)
    this.#sync()
    this.#applyFormState()
    this.#refreshAll()
  }

  /**
   * 扩展：种类、渲染、编辑方式与规则都从这里来，内置扩展自动排在最前；与设计器、validateDocument 的 extensions 是同一份。
   * 赋值时当场合并查重，冲突抛 DesignerExtensionError、什么都不变；换了就重建控制器。同一个扩展对象换了引用也算换了，宿主要保持引用稳定。
   */
  get extensions(): readonly FormRuntimeExtension[] | undefined {
    return this.#extensions
  }

  set extensions(value: readonly FormRuntimeExtension[] | undefined) {
    if (value === this.#extensions)
      return
    const model = createFormRuntimeModel(value ?? NO_EXTENSIONS)
    const old = this.#extensions
    this.#extensions = value
    this.#model = model
    this.requestUpdate('extensions', old)
  }

  /** 当前的表单控制器；没给模板或模板无效时为 `null`。模板等属性一变就换一个新的，见 `ready` 事件。 */
  get controller(): FormController | null {
    this.#sync()
    return this.#controller
  }

  /** 当前表单值的副本。 */
  getFormData(options?: GetFormDataOptions): Record<string, JsonValue> {
    return this.#require().getFormData(options)
  }

  /** 按模板替换全部绑定值，见控制器的 setFormData。 */
  setFormData(data: Readonly<Record<string, JsonValue>>, options?: SetFormDataOptions): void {
    this.#require().setFormData(data, options)
  }

  /** 按数据路径读值的副本。 */
  getValue(path: JsonPath): JsonValue | undefined {
    return this.#require().getValue(path)
  }

  /** 写一个字段或列表容器的值。 */
  setValue(path: JsonPath, value: JsonValue): void {
    this.#require().setValue(path, value)
  }

  /** 校验全部字段并显示问题。 */
  validate(): ValidationOutcome {
    return this.#require().validate()
  }

  /** 校验一个字段或列表容器并显示它的问题。 */
  validateField(path: JsonPath): ValidationOutcome {
    return this.#require().validateField(path)
  }

  /** 回到基准值并清空校验状态。 */
  reset(): void {
    this.#require().reset()
  }

  /** 当前值与基准值是否不同。 */
  isDirty(): boolean {
    return this.#require().isDirty()
  }

  /** 走一次提交：与回车、提交键同一条路径；结果看 `submit` / `invalid` 事件。 */
  submit(): void {
    this.#require()
    const form = this.#form
    if (!this.isConnected || typeof form?.submit !== 'function')
      throw new FormRuntimeError('XH_FORM_RT_NOT_READY')
    form.submit()
  }

  /** 让一个字段获得焦点；target 是节点 id 或数据路径。字段不存在时返回 false。 */
  focusField(target: string | JsonPath): boolean {
    this.#require()
    const entry = typeof target === 'string' ? this.#fieldsByKey.get(target) : this.#fields.get(pathKey(target))
    if (entry === undefined || this.#formRoot === undefined)
      return false
    return focusFormField(this.#formRoot, [...entry.path])
  }

  #require(): FormController {
    this.#sync()
    if (this.#controller === null)
      throw new FormRuntimeError('XH_FORM_RT_NOT_READY')
    return this.#controller
  }

  /** 落实待处理的属性：需要时重建控制器，再把 values、variables 交给它。 */
  #sync(): void {
    if (this.#rebuild) {
      this.#rebuild = false
      this.#valuesDirty = false
      this.#variablesDirty = false
      this.#build()
      return
    }
    const controller = this.#controller
    if (controller === null)
      return
    if (this.#variablesDirty) {
      this.#variablesDirty = false
      controller.setVariables(this.variables ?? {})
    }
    if (this.#valuesDirty) {
      this.#valuesDirty = false
      if (this.values !== undefined && !jsonEquals(this.values as JsonValue, controller.getFormData()))
        controller.setFormData(this.values, { baseline: true })
    }
  }

  #teardown(): void {
    this.#unsubscribe?.()
    this.#unsubscribe = undefined
    for (const entry of this.#fields.values())
      entry.instance.destroy?.()
    this.#controller?.dispose()
    this.#controller = null
    this.#fields = new Map()
    this.#fieldsByKey = new Map()
    this.#nodes = new Map()
    this.#form = undefined
    this.#formRoot = undefined
    this.#summaryTitle = undefined
    this.#summary = undefined
    this.#lists = new Map()
    this.#linkageIssues = []
    this.replaceChildren()
  }

  #build(): void {
    this.#teardown()
    const document = this.schema
    if (document === undefined)
      return
    let controller: FormController
    try {
      controller = createFormController({
        document,
        extensions: this.#extensions,
        expressionEngine: this.expressionEngine ?? (this.#defaultEngine ??= createExpressionEngine()),
        variables: this.variables ?? {},
        values: this.values,
        loadOptions: this.loadOptions,
      })
      this.#controller = controller
      this.#render(document)
    }
    catch (error) {
      if (!(error instanceof FormRuntimeError))
        throw error
      this.#teardown()
      emitEvent(this, 'schema-error', { code: error.code, data: error.data, issues: error.issues })
      return
    }
    this.#unsubscribe = controller.subscribe(event => this.#onEvent(event))
    this.#linkageIssues = controller.getLinkageIssues()
    emitEvent(this, 'ready', { controller })
    if (this.#linkageIssues.length > 0)
      emitEvent(this, 'linkage-error', { issues: this.#linkageIssues })
    if (this.loadOptions !== undefined)
      void controller.reloadOptions()
  }

  #t(): FormRendererTranslations {
    return this.#config.translations<FormRendererTranslations>('xh-form-renderer', DEFAULT_FORM_RENDERER_TRANSLATIONS, this.translations)
  }

  #render(document: FormDocument): void {
    const doc = this.ownerDocument
    const form = doc.createElement('xh-form') as XhFormHost
    form.setAttribute('validate-on', 'submit')
    const root = make(doc, 'form', 'root', { novalidate: '' })
    const summary = make(doc, 'div', 'error-summary')
    const summaryTitle = make(doc, 'p')
    summary.append(summaryTitle)
    root.append(summary)
    this.#form = form
    this.#formRoot = root
    this.#summaryTitle = summaryTitle
    this.#summary = summary
    this.#renderNodes(document.children, root)
    form.append(root)
    for (const type of INTERNAL_EVENTS)
      form.addEventListener(type, event => event.stopPropagation())
    for (const type of FORM_EVENTS)
      form.addEventListener(type, event => this.#onFormEvent(event as CustomEvent<{ cause?: unknown }>))
    form.layout = document.settings.labelPlacement === 'start' ? 'horizontal' : 'vertical'
    form.validate = () => this.#errorsOf(this.#controller!.validate().issues)
    this.#applyFormState()
    this.#syncFormValues()
    this.#syncErrors()
    this.replaceChildren(form)
  }

  #renderNodes(nodes: readonly FormNode[], parent: HTMLElement, scope: RowScope = TOP, into?: Owned): void {
    const doc = this.ownerDocument
    for (const node of nodes) {
      const key = instanceKey(node.id, scope.rowPath)
      if (node.type === 'field') {
        parent.append(this.#renderField(node, [...scope.prefix, node.key], key, into, scope.cell === true))
        continue
      }
      if (node.type === 'static') {
        const build = this.#model.staticRenderers.get(node.kind)
        if (build === undefined)
          throw new FormRuntimeError('XH_FORM_RT_NO_RENDERER', { kind: node.kind })
        const view = build(doc, node as StaticNode)
        parent.append(view.element)
        this.#nodes.set(key, view)
        into?.nodes.push(key)
        view.update(this.#controller!.getState(key)!)
        continue
      }
      if (isListContainer(node)) {
        parent.append(this.#renderList(node, scope, key, into))
        continue
      }
      const build = this.#model.containerRenderers.get(node.kind)
      if (build === undefined)
        throw new FormRuntimeError('XH_FORM_RT_NO_RENDERER', { kind: node.kind })
      const view = build(doc, node as ContainerNode)
      parent.append(view.element)
      this.#nodes.set(key, view)
      into?.nodes.push(key)
      for (const region of node.regions) {
        const slot = make(doc, 'div', undefined, { 'data-form-region': '' })
        view.slots.get(region.id)!.append(slot)
        this.#renderNodes(region.children, slot, scope, into)
      }
      view.update(this.#controller!.getState(key)!)
    }
  }

  /** 字段与列表共用的分组：带数据路径，错误摘要里有一条，离开分组时校验这个路径。 */
  #group(path: JsonPath): { group: HTMLElement, summary: HTMLElement } {
    const doc = this.ownerDocument
    const data = JSON.stringify(path)
    const group = make(doc, 'div', 'field-group', { 'data-path': data, 'data-xh-part-owner': 'form' })
    const summary = make(doc, 'a', 'error-summary-item', { 'data-path': data })
    this.#summary!.append(summary)
    group.addEventListener('focusout', (event) => {
      const next = (event as FocusEvent).relatedTarget
      if (!(next instanceof Node && group.contains(next)))
        this.#commit(path)
    })
    return { group, summary }
  }

  #renderField(node: FieldNode, path: JsonPath, key: string, into: Owned | undefined, labelHidden: boolean): HTMLElement {
    const renderer = this.#model.fieldRenderers.get(node.kind)
    if (renderer === undefined)
      throw new FormRuntimeError('XH_FORM_RT_NO_RENDERER', { kind: node.kind })
    const { group, summary } = this.#group(path)
    const context = this.#contextOf(node, path)
    const instance = renderer(context)
    const shell = createFieldShell(this.ownerDocument, node, instance.element, { labelHidden })
    shell.update(context)
    group.append(shell.element)
    const entry: FieldEntry = { node, path, key, group, summary, instance, shell }
    this.#fields.set(pathKey(path), entry)
    this.#fieldsByKey.set(key, entry)
    into?.fields.push(pathKey(path))
    group.hidden = this.#controller!.getState(path)!.hidden
    return group
  }

  #renderList(node: ContainerNode, scope: RowScope, key: string, into?: Owned): HTMLElement {
    const path = [...scope.prefix, node.key!]
    const { group, summary } = this.#group(path)
    const shell = createListShell(this.ownerDocument, node, (this.schema?.settings.size ?? 'md') as FieldSize)
    group.append(shell.element)
    const list: ListEntry = { node, path, key, rowPath: scope.rowPath, group, summary, shell, rows: new Map(), tokens: [] }
    const array = shell.array as HTMLElement & { createItem?: () => unknown }
    array.createItem = () => ({})
    array.addEventListener('value-change', (event) => {
      const detail = (event as CustomEvent<{ value: object[], mutation?: FormArrayMutation }>).detail
      this.#mutateList(list, detail.value, detail.mutation)
    })
    this.#lists.set(pathKey(path), list)
    into?.lists.push(pathKey(path))
    this.#reconcileList(list)
    this.#refreshList(list)
    return group
  }

  /** xh-field-array 交来一次增删换序：先换上它给的令牌，再交控制器改行，最后按令牌对行。 */
  #mutateList(list: ListEntry, tokens: object[], mutation: FormArrayMutation | undefined): void {
    const controller = this.#controller
    if (controller === null || mutation === undefined || mutation.type === 'replace')
      return
    list.tokens = tokens
    try {
      if (mutation.type === 'insert')
        controller.addRow(list.path, { index: mutation.index })
      else if (mutation.type === 'remove')
        controller.removeRow(list.path, mutation.index)
      else
        controller.moveRow(list.path, mutation.from, mutation.to)
    }
    finally {
      this.#reconcileList(list)
    }
  }

  /**
   * 按控制器里的行数对行：令牌数与行数不符时按位置截短或补齐；
   * 行号变了的行重建行内容（表格排布逐格重建），各行按令牌顺序排进行容器，再把令牌数组交给 xh-field-array。
   */
  #reconcileList(list: ListEntry): void {
    if (!this.#lists.has(pathKey(list.path)))
      return
    const doc = this.ownerDocument
    const rows = this.#controller!.getValue(list.path)
    const count = Array.isArray(rows) ? rows.length : 0
    if (list.tokens.length !== count)
      list.tokens = [...list.tokens.slice(0, count), ...Array.from({ length: Math.max(0, count - list.tokens.length) }, () => ({}))]
    const alive = new Set(list.tokens)
    for (const [token, entry] of list.rows) {
      if (!alive.has(token)) {
        this.#release(entry.owned)
        entry.row.item.remove()
        list.rows.delete(token)
      }
    }
    const movable = list.node.data.movable !== false
    const { columns, rows: container } = list.shell
    let cursor = list.shell.firstRow()
    list.tokens.forEach((token, index) => {
      let entry = list.rows.get(token)
      if (entry === undefined) {
        entry = { row: createListRow(doc, movable, columns), index: -1, owned: owned() }
        list.rows.set(token, entry)
      }
      if (entry.index !== index) {
        this.#release(entry.owned)
        entry.owned = owned()
        entry.index = index
        text(entry.row.label, String(index + 1))
        const scope: RowScope = { prefix: [...list.path, index], rowPath: [...list.rowPath, index] }
        const content = entry.row.content
        if (content === undefined) {
          for (const child of list.node.regions[0]!.children) {
            const cell = entry.row.cells.get(child.id)!
            cell.replaceChildren()
            this.#renderNodes([child], cell, { ...scope, cell: true }, entry.owned)
          }
        }
        else {
          const slot = make(doc, 'div', undefined, { 'data-form-region': '' })
          content.replaceChildren(slot)
          this.#renderNodes(list.node.regions[0]!.children, slot, scope, entry.owned)
        }
      }
      if (entry.row.item === cursor)
        cursor = cursor.nextElementSibling
      else
        container.insertBefore(entry.row.item, cursor)
    })
    const array = list.shell.array as HTMLElement & { value?: unknown }
    if (array.value !== list.tokens)
      array.value = list.tokens
  }

  /** 收回一段内容建出的登记项：字段实例销毁、摘要条目移除，内嵌的列表连同它的行一并收回。 */
  #release(items: Owned): void {
    for (const key of items.fields) {
      const entry = this.#fields.get(key)
      if (entry === undefined)
        continue
      entry.instance.destroy?.()
      entry.summary.remove()
      this.#fields.delete(key)
      this.#fieldsByKey.delete(entry.key)
    }
    for (const key of items.nodes)
      this.#nodes.delete(key)
    for (const key of items.lists) {
      const list = this.#lists.get(key)
      if (list === undefined)
        continue
      for (const entry of list.rows.values())
        this.#release(entry.owned)
      list.summary.remove()
      this.#lists.delete(key)
    }
  }

  #refreshList(list: ListEntry): void {
    const controller = this.#controller
    if (controller === null)
      return
    const state = controller.getState(list.path)!
    list.group.hidden = state.hidden
    const issue = controller.getIssues().find(item => jsonEquals(item.path as JsonValue, list.path as JsonValue))
    const t = this.#t()
    list.shell.update(state, issue === undefined ? undefined : issueMessage(issue, t), t.addRow)
  }

  #contextOf(node: FieldNode, path: JsonPath): FieldRendererContext {
    const controller = this.#controller!
    const state = controller.getState(path)!
    const formDisabled = this.disabled === true || this.schema?.settings.disabled === true
    const formReadOnly = this.readonly === true || this.schema?.settings.readOnly === true
    const issue = controller.getIssues().find(item => jsonEquals(item.path as JsonValue, path as JsonValue))
    const t = this.#t()
    const registry = this.#model.registry
    return {
      document: this.ownerDocument,
      node,
      path,
      value: controller.getValue(path),
      state: { ...state, disabled: state.disabled || formDisabled, readOnly: state.readOnly || formReadOnly },
      error: issue === undefined ? undefined : issueMessage(issue, t),
      options: optionsDescriptor(node, registry) === undefined ? undefined : controller.getOptions(path),
      searchOptions: this.loadOptions === undefined || optionSourceOf(node) === undefined ? undefined : query => void controller.searchOptions(path, query),
      reloadOptions: this.loadOptions === undefined || optionSourceOf(node) === undefined ? undefined : () => void controller.reloadOptions(path),
      loadChildren: this.loadOptions === undefined || optionSourceOf(node) === undefined ? undefined : parent => controller.loadChildren(path, parent),
      size: (node.appearance.size ?? this.schema?.settings.size ?? 'md') as FieldSize,
      translations: t,
      uploadFile: this.#uploaderOf(node, path),
      setValue: value => this.#setValue(path, value),
      commit: () => this.#commit(path),
    }
  }

  #uploaderOf(node: FieldNode, path: JsonPath): FieldRendererContext['uploadFile'] {
    const upload = this.uploadFile
    if (upload === undefined)
      return undefined
    const target = stringOf(node.data.uploadTarget)
    return request => upload({ ...request, target, nodeId: node.id, path })
  }

  #setValue(path: JsonPath, value: JsonValue): void {
    const controller = this.#controller
    if (controller === null)
      return
    controller.setValue(path, value)
    if (this.validateOn === 'change')
      controller.validateField(path)
    this.#refreshField(this.#fields.get(pathKey(path)))
  }

  #commit(path: JsonPath): void {
    const controller = this.#controller
    if (controller !== null && (this.validateOn ?? 'blur') === 'blur')
      controller.validateField(path)
  }

  #refreshField(entry: FieldEntry | undefined): void {
    if (entry === undefined || this.#controller === null)
      return
    entry.group.hidden = this.#controller.getState(entry.path)!.hidden
    const context = this.#contextOf(entry.node, entry.path)
    entry.instance.update?.(context)
    entry.shell.update(context)
  }

  #refreshAll(): void {
    const controller = this.#controller
    if (controller === null)
      return
    for (const entry of this.#fields.values())
      this.#refreshField(entry)
    for (const [key, node] of this.#nodes)
      node.update(controller.getState(key)!)
    for (const list of this.#lists.values())
      this.#refreshList(list)
    this.#syncErrors()
  }

  #onEvent(event: FormEvent): void {
    const controller = this.#controller
    if (controller === null)
      return
    switch (event.type) {
      case 'values': {
        for (const list of [...this.#lists.values()].sort((a, b) => a.path.length - b.path.length)) {
          if (event.paths.some(path => related(path, list.path)))
            this.#reconcileList(list)
        }
        for (const entry of this.#fields.values()) {
          if (event.paths.some(path => related(path, entry.path)))
            this.#refreshField(entry)
        }
        this.#syncFormValues()
        emitEvent(this, 'value-change', { paths: event.paths, values: controller.getFormData() })
        this.#checkLinkage()
        break
      }
      case 'states': {
        for (const key of event.keys) {
          this.#refreshField(this.#fieldsByKey.get(key))
          const node = this.#nodes.get(key)
          if (node !== undefined)
            node.update(controller.getState(key)!)
        }
        for (const list of this.#lists.values()) {
          if (event.keys.includes(list.key))
            this.#refreshList(list)
        }
        this.#checkLinkage()
        break
      }
      case 'issues': {
        for (const entry of this.#fields.values()) {
          if (event.paths.some(path => related(path, entry.path)))
            this.#refreshField(entry)
        }
        for (const list of this.#lists.values()) {
          if (event.paths.some(path => related(path, list.path)))
            this.#refreshList(list)
        }
        this.#syncErrors()
        emitEvent(this, 'issues-change', { paths: event.paths, issues: controller.getIssues() })
        break
      }
      case 'options': {
        for (const key of event.keys)
          this.#refreshField(this.#fieldsByKey.get(key))
        break
      }
    }
  }

  #checkLinkage(): void {
    const issues = this.#controller!.getLinkageIssues()
    if (jsonEquals(issues as unknown as JsonValue, this.#linkageIssues as unknown as JsonValue))
      return
    this.#linkageIssues = issues
    if (issues.length > 0)
      emitEvent(this, 'linkage-error', { issues })
  }

  #onFormEvent(event: CustomEvent<{ cause?: unknown }>): void {
    event.stopPropagation()
    const controller = this.#controller
    if (controller === null)
      return
    const values = controller.getFormData({ omitHidden: true })
    if (event.type === 'submit')
      emitEvent(this, 'submit', { values })
    else if (event.type === 'invalid')
      emitEvent(this, 'invalid', { issues: controller.getIssues(), values })
    else
      emitEvent(this, 'submit-error', { cause: event.detail?.cause, values })
  }

  #applyFormState(): void {
    const form = this.#form
    if (form === undefined)
      return
    form.disabled = this.disabled === true || this.schema?.settings.disabled === true ? true : undefined
    form.readOnly = this.readonly === true || this.schema?.settings.readOnly === true ? true : undefined
    const action = this.submitAction
    form.submitAction = action === undefined || this.#controller === null
      ? undefined
      : () => action({ values: this.#controller!.getFormData({ omitHidden: true }) })
  }

  #errorsOf(issues: readonly ValueIssue[]): Record<string, string> {
    const t = this.#t()
    const seen = new Set<string>()
    const entries: [JsonPath, string][] = []
    for (const issue of issues) {
      const key = pathKey(issue.path)
      if (seen.has(key))
        continue
      seen.add(key)
      entries.push([issue.path, issueMessage(issue, t)])
    }
    return createFormPathRecord(entries)
  }

  #syncFormValues(): void {
    const controller = this.#controller
    if (this.#form === undefined || controller === null)
      return
    this.#form.values = createFormPathRecord([...this.#fields.values()].map(entry => [entry.path, controller.getValue(entry.path)] as const))
  }

  #syncErrors(): void {
    const controller = this.#controller
    if (this.#form === undefined || controller === null)
      return
    const t = this.#t()
    const issues = controller.getIssues()
    this.#form.errors = this.#errorsOf(issues)
    const count = new Set(issues.map(issue => pathKey(issue.path))).size
    text(this.#summaryTitle!, t.errorSummary(count))
    for (const entry of this.#fields.values()) {
      const issue = issues.find(item => jsonEquals(item.path as JsonValue, entry.path as JsonValue))
      const label = stringOf(entry.node.basic.label) ?? ''
      const message = issue === undefined ? '' : issueMessage(issue, t)
      text(entry.summary, message === '' || label === '' ? message : t.errorSummaryItem(label, message))
    }
    for (const list of this.#lists.values()) {
      const issue = issues.find(item => jsonEquals(item.path as JsonValue, list.path as JsonValue))
      const title = stringOf(list.node.basic.title) ?? ''
      const message = issue === undefined ? '' : issueMessage(issue, t)
      text(list.summary, message === '' || title === '' ? message : t.errorSummaryItem(title, message))
    }
  }
}

/** 注册 <xh-form-renderer> 与内置字段、容器用到的库内元素；重复调用不报错。宿主自定义字段渲染器用到的元素由宿主注册。 */
export function defineFormRenderer(): void {
  defineRendererElements()
  registerElement(FORM_RENDERER_TAG, XhFormRenderer)
}

declare global {
  interface HTMLElementTagNameMap {
    'xh-form-renderer': XhFormRenderer
  }
}
