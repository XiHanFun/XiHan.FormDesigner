/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// <xh-form-renderer>：按表单模板渲染表单。值、联动、校验与选项都在表单控制器里，
// 外层用 UI 的 <xh-form> 承担提交、错误摘要、落焦与整表的禁用、只读，它的 values 与 errors 由控制器驱动。

import type { ContainerNode, FieldNode, FormDocument, FormNode, FormSchemaIssue, KindRegistry, NodeState, StaticNode, ValueIssue } from '@xihan-form/core'
import type { JsonPath, JsonValue } from '@xihan-ui/core/json'
import type { ExpressionEngine } from '@xihan-ui/expression'
import type { PropertyValues } from '@xihan-ui/web-components/authoring'
import type { FormController, FormEvent, GetFormDataOptions, LinkageIssue, SetFormDataOptions, ValidationOutcome } from '../state/controller'
import type { FormRuntimeErrorCode } from '../state/errors'
import type { OptionLoader } from '../state/options'
import type { FormRendererTranslations } from '../translations'
import type { FieldRenderer, FieldRendererContext, FieldRendererInstance, FieldSize } from './types'
import { createBuiltinKindRegistry } from '@xihan-form/core'
import { isJsonPathPrefix, jsonEquals } from '@xihan-ui/core/json'
import { createExpressionEngine } from '@xihan-ui/expression'
import { createFormPathRecord, focusFormField } from '@xihan-ui/headless'
import { emitEvent, registerElement, XhConfigController, XhReactiveElement } from '@xihan-ui/web-components/authoring'
import { createFormController } from '../state/controller'
import { FormRuntimeError } from '../state/errors'
import { optionsDescriptor } from '../state/options'
import { isListContainer } from '../state/paths'
import { DEFAULT_FORM_RENDERER_TRANSLATIONS } from '../translations'
import { CONTAINER_BUILDERS, STATIC_BUILDERS } from './containers'
import { make, stringOf, text } from './dom'
import { FORM_FIELD_RENDERERS } from './fields'
import { issueMessage } from './messages'

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
const REBUILD = new Set<PropertyKey>(['schema', 'registry', 'expressionEngine', 'loadOptions', 'fieldRenderers'])

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
}

interface NodeEntry {
  readonly update: (state: NodeState) => void
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
    registry: { attribute: false },
    expressionEngine: { attribute: false },
    values: { attribute: false },
    variables: { attribute: false },
    loadOptions: { attribute: false },
    readonly: { type: Boolean },
    disabled: { type: Boolean },
    validateOn: { attribute: 'validate-on' },
    submitAction: { attribute: false },
    fieldRenderers: { attribute: false },
    translations: { attribute: false },
  }

  /** 表单模板。 */
  declare schema: FormDocument | undefined
  /** 种类登记表，缺省为内置种类。 */
  declare registry: KindRegistry | undefined
  /** 表达式引擎，缺省为 @xihan-ui/expression 的 createExpressionEngine()。 */
  declare expressionEngine: ExpressionEngine | undefined
  /** 初始数据兼 reset 与 isDirty 的基准；控制器建好后再赋值等于 setFormData(values, { baseline: true })，与当前值相同时不动。 */
  declare values: Readonly<Record<string, JsonValue>> | undefined
  /** 宿主提供给表达式的变量，名字以 `$` 开头。 */
  declare variables: Readonly<Record<string, unknown>> | undefined
  /** 选项加载函数。 */
  declare loadOptions: OptionLoader | undefined
  /** 整表只读：仍可提交。 */
  declare readonly: boolean | undefined
  /** 整表禁用：不能提交。 */
  declare disabled: boolean | undefined
  /** 单字段首次校验的时机，缺省 `blur`；校验过的字段此后随改值重算。 */
  declare validateOn: FormValidateOn | undefined
  /** 提交通过校验后调用的异步动作。 */
  declare submitAction: FormSubmitAction | undefined
  /** 按种类覆盖或新增字段渲染器，压在内置表之上。 */
  declare fieldRenderers: Readonly<Record<string, FieldRenderer>> | undefined
  /** 元素自己的文案，压在全局配置之上。 */
  declare translations: Partial<FormRendererTranslations> | undefined

  readonly #config = new XhConfigController(this)
  #controller: FormController | null = null
  #unsubscribe: (() => void) | undefined
  #defaultEngine: ExpressionEngine | undefined
  #builtinRegistry: KindRegistry | undefined
  #rebuild = true
  #valuesDirty = false
  #variablesDirty = false
  #form: XhFormHost | undefined
  #formRoot: HTMLFormElement | undefined
  #summaryTitle: HTMLElement | undefined
  #fields = new Map<string, FieldEntry>()
  #fieldsByKey = new Map<string, FieldEntry>()
  #nodes = new Map<string, NodeEntry>()
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
        registry: this.registry,
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
    this.#renderNodes(document.children, root, summary)
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

  #renderNodes(nodes: readonly FormNode[], parent: HTMLElement, summary: HTMLElement): void {
    const doc = this.ownerDocument
    for (const node of nodes) {
      if (node.type === 'field') {
        parent.append(this.#renderField(node, [node.key], summary))
        continue
      }
      if (node.type === 'static') {
        const build = STATIC_BUILDERS[node.kind]
        if (build === undefined)
          throw new FormRuntimeError('XH_FORM_RT_NO_RENDERER', { kind: node.kind })
        const view = build(doc, node as StaticNode)
        parent.append(view.element)
        this.#nodes.set(node.id, view)
        view.update(this.#controller!.getState(node.id)!)
        continue
      }
      const build = isListContainer(node) ? undefined : CONTAINER_BUILDERS[node.kind]
      if (build === undefined)
        throw new FormRuntimeError('XH_FORM_RT_NO_RENDERER', { kind: node.kind })
      const view = build(doc, node as ContainerNode)
      parent.append(view.element)
      this.#nodes.set(node.id, view)
      for (const region of node.regions) {
        const slot = make(doc, 'div', undefined, { 'data-form-region': '' })
        view.slots.get(region.id)!.append(slot)
        this.#renderNodes(region.children, slot, summary)
      }
      view.update(this.#controller!.getState(node.id)!)
    }
  }

  #renderField(node: FieldNode, path: JsonPath, summary: HTMLElement): HTMLElement {
    const renderer = (this.fieldRenderers && Object.hasOwn(this.fieldRenderers, node.kind) ? this.fieldRenderers[node.kind] : undefined)
      ?? (Object.hasOwn(FORM_FIELD_RENDERERS, node.kind) ? FORM_FIELD_RENDERERS[node.kind] : undefined)
    if (renderer === undefined)
      throw new FormRuntimeError('XH_FORM_RT_NO_RENDERER', { kind: node.kind })
    const doc = this.ownerDocument
    const data = JSON.stringify(path)
    const group = make(doc, 'div', 'field-group', { 'data-path': data, 'data-xh-part-owner': 'form' })
    const item = make(doc, 'a', 'error-summary-item', { 'data-path': data })
    summary.append(item)
    const instance = renderer(this.#contextOf(node, path))
    group.append(instance.element)
    group.addEventListener('focusout', (event) => {
      const next = (event as FocusEvent).relatedTarget
      if (!(next instanceof Node && group.contains(next)))
        this.#commit(path)
    })
    const entry: FieldEntry = { node, path, key: node.id, group, summary: item, instance }
    this.#fields.set(pathKey(path), entry)
    this.#fieldsByKey.set(entry.key, entry)
    group.hidden = this.#controller!.getState(path)!.hidden
    return group
  }

  #contextOf(node: FieldNode, path: JsonPath): FieldRendererContext {
    const controller = this.#controller!
    const state = controller.getState(path)!
    const formDisabled = this.disabled === true || this.schema?.settings.disabled === true
    const formReadOnly = this.readonly === true || this.schema?.settings.readOnly === true
    const issue = controller.getIssues().find(item => jsonEquals(item.path as JsonValue, path as JsonValue))
    const t = this.#t()
    const registry = this.registry ?? (this.#builtinRegistry ??= createBuiltinKindRegistry())
    return {
      document: this.ownerDocument,
      node,
      path,
      value: controller.getValue(path),
      state: { ...state, disabled: state.disabled || formDisabled, readOnly: state.readOnly || formReadOnly },
      error: issue === undefined ? undefined : issueMessage(issue, t),
      options: optionsDescriptor(node, registry) === undefined ? undefined : controller.getOptions(path),
      size: (node.appearance.size ?? this.schema?.settings.size ?? 'md') as FieldSize,
      translations: t,
      setValue: value => this.#setValue(path, value),
      commit: () => this.#commit(path),
    }
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
    entry.instance.update?.(this.#contextOf(entry.node, entry.path))
  }

  #refreshAll(): void {
    const controller = this.#controller
    if (controller === null)
      return
    for (const entry of this.#fields.values())
      this.#refreshField(entry)
    for (const [id, node] of this.#nodes)
      node.update(controller.getState(id)!)
    this.#syncErrors()
  }

  #onEvent(event: FormEvent): void {
    const controller = this.#controller
    if (controller === null)
      return
    switch (event.type) {
      case 'values': {
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
        this.#checkLinkage()
        break
      }
      case 'issues': {
        for (const entry of this.#fields.values()) {
          if (event.paths.some(path => related(path, entry.path)))
            this.#refreshField(entry)
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
  }
}

/** 注册 <xh-form-renderer>；重复调用不报错。UI 元素由宿主另行用 defineXhElements() 注册。 */
export function defineFormRenderer(): void {
  registerElement(FORM_RENDERER_TAG, XhFormRenderer)
}

declare global {
  interface HTMLElementTagNameMap {
    'xh-form-renderer': XhFormRenderer
  }
}
