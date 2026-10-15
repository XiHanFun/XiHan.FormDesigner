/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单控制器：持有表单值，改值后重算联动与状态，按需校验，管理行与选项，并通知订阅者。

import type { ContainerNode, FieldNode, FormDocument, FormIssue, FormNode, KindRegistry, NodeState, StateOverride, ValueIssue } from '@xihan-form/core'
import type { JsonPath, JsonValue } from '@xihan-ui/core/json'
import type { ExpressionEngine } from '@xihan-ui/expression'
import type { FormArrayMutation } from '@xihan-ui/headless'
import type { OptionItem, OptionLoader, OptionsState } from './options'
import type { ResolvedPath } from './paths'
import {
  createBuiltinKindRegistry,
  createInitialValues,
  descendantsOf,
  findNode,
  instanceKey,
  listBindings,
  resolveLinkage,
  validateDocument,
  validateValues,
  walkNodes,
} from '@xihan-form/core'
import { changedJsonPaths, cloneJson, getJsonAt, isJsonPathPrefix, isPlainObject, jsonEquals, JsonPathError, setJsonAt } from '@xihan-ui/core/json'
import { rebaseFormArrayPath } from '@xihan-ui/headless'
import { changedIssuePaths, changedKeys, sameState } from './changes'
import { FormRuntimeError, pathText } from './errors'
import { normalizeRow, normalizeScope, normalizeValue } from './normalize'
import { isValidOptions, optionsDescriptor, optionSourceOf } from './options'
import { isListContainer, resolvePath, rowChildren, scopeBindings } from './paths'

/** 联动重算的轮数上限。 */
const MAX_LINKAGE_PASSES = 10

/** 创建表单控制器的选项。 */
export interface FormControllerOptions {
  readonly document: FormDocument
  /** 种类登记表，缺省为内置种类。 */
  readonly registry?: KindRegistry
  /** 表达式引擎；文档里有表达式时必须提供。 */
  readonly expressionEngine?: ExpressionEngine
  /** 宿主提供给表达式的额外变量，名字以 `$` 开头。 */
  readonly variables?: Readonly<Record<string, unknown>>
  /** 初始数据，叠在 schema 的初始值之上；也是 `reset` 与 `isDirty` 最初的基准。 */
  readonly values?: Readonly<Record<string, JsonValue>>
  /** 选项加载函数；有字段带选项来源时，`reloadOptions` 需要它。 */
  readonly loadOptions?: OptionLoader
}

/** 寻址：字符串是节点 id，数组是数据路径。 */
export type FormTarget = string | JsonPath

/** 联动问题：表达式求值的问题，或联动多轮重算后仍不稳定。 */
export type LinkageIssue = FormIssue | { readonly code: 'XH_FORM_RT_LINKAGE_UNSTABLE', readonly data: { readonly passes: number } }

/** 校验结果。 */
export interface ValidationOutcome {
  readonly valid: boolean
  readonly issues: readonly ValueIssue[]
}

/**
 * 变更通知，带着变化范围：
 * - `values` / `issues`：变化的数据路径；数组长度变了时报数组本身的路径。
 * - `states` / `options`：受影响的实例键（顶层节点就是节点 id，列表里的节点是 `id#行号`）。
 */
export type FormEvent
  = | { readonly type: 'values', readonly paths: readonly JsonPath[] }
    | { readonly type: 'issues', readonly paths: readonly JsonPath[] }
    | { readonly type: 'states', readonly keys: readonly string[] }
    | { readonly type: 'options', readonly keys: readonly string[] }

/** 变更通知的种类。 */
export type FormEventType = FormEvent['type']

/** 读取表单数据的选项。 */
export interface GetFormDataOptions {
  /** 为 `true` 时去掉隐藏实例的值（含被隐藏容器里的字段与整个被隐藏的列表）。 */
  readonly omitHidden?: boolean
}

/** 替换表单数据的选项。 */
export interface SetFormDataOptions {
  /** 为 `true` 时，填入的值同时成为 `reset` 与 `isDirty` 的基准。 */
  readonly baseline?: boolean
}

/** 新增行的选项。 */
export interface AddRowOptions {
  /** 插入位置，缺省追加到末尾。 */
  readonly index?: number
  /** 新行的数据，缺的键取 schema 初始值。 */
  readonly values?: Readonly<Record<string, JsonValue>>
}

/** 表单控制器。 */
export interface FormController {
  readonly document: FormDocument
  /** 当前表单值的副本，已含联动赋值。 */
  readonly getFormData: (options?: GetFormDataOptions) => Record<string, JsonValue>
  /** 按数据路径读值的副本；不存在时为 `undefined`。 */
  readonly getValue: (path: JsonPath) => JsonValue | undefined
  /**
   * 按 schema 替换全部绑定值：没给的回到初始值，多带的键原样保留；同时清空校验状态。
   * `baseline` 为 `true` 时，填入的值同时成为 `reset` 与 `isDirty` 的基准。
   */
  readonly setFormData: (data: Readonly<Record<string, JsonValue>>, options?: SetFormDataOptions) => void
  /** 写一个字段或列表容器的值；形状不符时抛错。 */
  readonly setValue: (path: JsonPath, value: JsonValue) => void
  /** 节点实例的状态；字符串只取顶层实例，列表里的实例用数据路径。 */
  readonly getState: (target: FormTarget) => NodeState | undefined
  /** 当前展示的校验问题。 */
  readonly getIssues: () => readonly ValueIssue[]
  /** 最近一次联动重算的问题。 */
  readonly getLinkageIssues: () => readonly LinkageIssue[]
  /** 校验全部字段，隐藏或禁用的实例跳过、值保留；此后每次改值都会重算问题。 */
  readonly validate: () => ValidationOutcome
  /** 校验一个字段或列表容器（含行内字段）；此后它的问题随改值重算。 */
  readonly validateField: (path: JsonPath) => ValidationOutcome
  /** 回到基准值并清空校验状态；宿主的强制设定与已加载的选项保留。基准是创建时的值，或最近一次带 `baseline` 填入的值。 */
  readonly reset: () => void
  /** 当前值与 `reset` 之后的值是否不同。 */
  readonly isDirty: () => boolean
  /** 强制隐藏、禁用、只读：`true` / `false` 强制，`null` 撤销强制。 */
  readonly setHidden: (target: FormTarget, hidden: boolean | null) => void
  readonly setDisabled: (target: FormTarget, disabled: boolean | null) => void
  readonly setReadOnly: (target: FormTarget, readOnly: boolean | null) => void
  /** 列表容器的行：新增、删除、移动。行级的强制设定、选项与校验进度跟着行走。 */
  readonly addRow: (listPath: JsonPath, options?: AddRowOptions) => void
  readonly removeRow: (listPath: JsonPath, index: number) => void
  readonly moveRow: (listPath: JsonPath, from: number, to: number) => void
  /** 重新加载选项：不给目标时加载全部带选项来源的字段实例。 */
  readonly reloadOptions: (target?: FormTarget) => Promise<void>
  /** 字段实例的选项：带选项来源时是加载状态，否则是 schema 里的静态选项。 */
  readonly getOptions: (target: FormTarget) => OptionsState
  /** 替换宿主变量并重算联动。 */
  readonly setVariables: (variables: Readonly<Record<string, unknown>>) => void
  /** 订阅变更，返回取消函数。 */
  readonly subscribe: (listener: (event: FormEvent) => void) => () => void
  /** 销毁：取消全部订阅，之后调用任何方法都抛错，晚到的选项结果被丢弃。 */
  readonly dispose: () => void
}

type OverrideField = keyof StateOverride

function hasExpressions(document: FormDocument): boolean {
  let found = false
  walkNodes(document, (node) => {
    if (node.linkage.some(rule => rule.when !== undefined || rule.value !== undefined))
      found = true
    if (node.type !== 'static' && node.validation.some(rule => rule.kind === 'expression'))
      found = true
    return !found
  })
  return found
}

function parseInstanceKey(key: string): { nodeId: string, rowPath: number[] } {
  const hash = key.indexOf('#')
  return hash === -1 ? { nodeId: key, rowPath: [] } : { nodeId: key.slice(0, hash), rowPath: key.slice(hash + 1).split('.').map(Number) }
}

class Controller implements FormController {
  readonly document: FormDocument
  private readonly registry: KindRegistry
  private readonly engine: ExpressionEngine | undefined
  private readonly loader: OptionLoader | undefined
  private readonly defaults: Record<string, JsonValue>
  private initial: Record<string, JsonValue>
  private variables: Readonly<Record<string, unknown>>
  private values: Record<string, JsonValue>
  private states: ReadonlyMap<string, NodeState> = new Map()
  private linkageIssues: readonly LinkageIssue[] = []
  private issues: readonly ValueIssue[] = []
  private validated = false
  private touched: JsonPath[] = []
  private readonly overrides = new Map<string, StateOverride>()
  private readonly optionStates = new Map<string, OptionsState>()
  private readonly optionRequests = new Map<string, number>()
  private readonly listeners = new Set<(event: FormEvent) => void>()
  private requestCounter = 0
  private disposed = false

  constructor(options: FormControllerOptions) {
    this.document = options.document
    this.registry = options.registry ?? createBuiltinKindRegistry()
    this.engine = options.expressionEngine
    this.loader = options.loadOptions
    this.variables = { ...options.variables }
    if (this.engine === undefined && hasExpressions(this.document))
      throw new FormRuntimeError('XH_FORM_RT_NO_ENGINE')
    const problems = validateDocument(this.document, this.registry, { expressionEngine: this.engine, identifiers: Object.keys(this.variables) })
    if (problems.length > 0)
      throw new FormRuntimeError('XH_FORM_RT_INVALID_DOCUMENT', {}, problems)
    this.defaults = createInitialValues(this.document, this.registry)
    this.initial = normalizeScope(this.document.children, options.values ?? {}, [], this.defaults, this.registry)
    this.values = cloneJson(this.initial)
    this.refresh()
  }

  private alive(): void {
    if (this.disposed)
      throw new FormRuntimeError('XH_FORM_RT_DISPOSED')
  }

  /** 反复执行联动直到值不再变化，最多 `MAX_LINKAGE_PASSES` 轮；不修改控制器。 */
  private settle(values: Record<string, JsonValue>): { values: Record<string, JsonValue>, states: ReadonlyMap<string, NodeState>, issues: readonly LinkageIssue[] } {
    let current = values
    for (let pass = 1; ; pass += 1) {
      const result = resolveLinkage(this.document, current, { expressionEngine: this.engine, variables: this.variables, overrides: this.overrides })
      const stable = jsonEquals(result.values, current)
      current = result.values
      if (stable || pass === MAX_LINKAGE_PASSES) {
        const issues = stable ? result.issues : [...result.issues, { code: 'XH_FORM_RT_LINKAGE_UNSTABLE', data: { passes: pass } } as const]
        return { values: current, states: result.states, issues }
      }
    }
  }

  private refresh(): void {
    const settled = this.settle(this.values)
    this.values = settled.values
    this.states = settled.states
    this.linkageIssues = settled.issues
    this.issues = this.validated || this.touched.length > 0 ? this.visibleIssues(this.runValidation()) : []
  }

  private runValidation(): readonly ValueIssue[] {
    return validateValues(this.document, this.values, { expressionEngine: this.engine, states: this.states, variables: this.variables })
  }

  private visibleIssues(all: readonly ValueIssue[]): readonly ValueIssue[] {
    if (this.validated)
      return all
    return all.filter(issue => this.touched.some(path => isJsonPathPrefix(issue.path, path)))
  }

  private emit(events: readonly FormEvent[]): void {
    for (const event of events) {
      for (const listener of Array.from(this.listeners))
        listener(event)
    }
  }

  private emitIssues(before: readonly ValueIssue[]): void {
    const paths = changedIssuePaths(before, this.issues)
    if (paths.length > 0)
      this.emit([{ type: 'issues', paths }])
  }

  /** 执行一次修改并重算，再按变化范围发出通知。 */
  private commit(mutate: () => void): void {
    const before = { values: this.values, states: this.states, issues: this.issues, options: new Map(this.optionStates) }
    mutate()
    this.refresh()
    const events: FormEvent[] = []
    const values = changedJsonPaths(before.values, this.values)
    if (values.length > 0)
      events.push({ type: 'values', paths: values })
    const states = changedKeys(before.states, this.states, sameState)
    if (states.length > 0)
      events.push({ type: 'states', keys: states })
    const issues = changedIssuePaths(before.issues, this.issues)
    if (issues.length > 0)
      events.push({ type: 'issues', paths: issues })
    const options = changedKeys(before.options, this.optionStates, (a, b) => a === b)
    if (options.length > 0)
      events.push({ type: 'options', keys: options })
    this.emit(events)
  }

  private resolve(path: JsonPath): ResolvedPath {
    const resolved = Array.isArray(path) ? resolvePath(this.document.children, path) : undefined
    if (resolved === undefined)
      throw new FormRuntimeError('XH_FORM_RT_UNKNOWN_PATH', { path: Array.isArray(path) ? pathText(path) : String(path) })
    return resolved
  }

  /** 按路径读值；路径不合法或途中缺失时为 `undefined`。 */
  private read(path: JsonPath): JsonValue | undefined {
    try {
      return getJsonAt(this.values, path)
    }
    catch (error) {
      if (error instanceof JsonPathError)
        return undefined
      throw error
    }
  }

  /** 按路径不可变地写值；途中的行或对象不存在时抛 `XH_FORM_RT_UNKNOWN_PATH`。 */
  private write(path: JsonPath, value: JsonValue): void {
    try {
      this.values = setJsonAt(this.values, path, value).root
    }
    catch (error) {
      if (error instanceof JsonPathError)
        throw new FormRuntimeError('XH_FORM_RT_UNKNOWN_PATH', { path: pathText(path) })
      throw error
    }
  }

  private targetKey(target: FormTarget): string {
    if (typeof target === 'string') {
      if (findNode(this.document, target) === undefined)
        throw new FormRuntimeError('XH_FORM_RT_UNKNOWN_NODE', { nodeId: target })
      return target
    }
    const { node, rowPath } = this.resolve(target)
    return instanceKey(node.id, rowPath)
  }

  getFormData(options: GetFormDataOptions = {}): Record<string, JsonValue> {
    this.alive()
    const data = cloneJson(this.values)
    if (options.omitHidden === true)
      this.omitHidden(this.document.children, data, [])
    return data
  }

  private omitHidden(children: readonly FormNode[], scope: Record<string, JsonValue>, rowPath: readonly number[]): void {
    for (const node of scopeBindings(children)) {
      if (this.states.get(instanceKey(node.id, rowPath))?.hidden === true) {
        delete scope[node.key]
        continue
      }
      const rows = scope[node.key]
      if (!isListContainer(node) || !Array.isArray(rows))
        continue
      rows.forEach((row, index) => {
        if (isPlainObject(row))
          this.omitHidden(rowChildren(node), row as Record<string, JsonValue>, [...rowPath, index])
      })
    }
  }

  getValue(path: JsonPath): JsonValue | undefined {
    this.alive()
    const value = this.read(path)
    return value === undefined ? undefined : cloneJson(value)
  }

  setFormData(data: Readonly<Record<string, JsonValue>>, options: SetFormDataOptions = {}): void {
    this.alive()
    const next = normalizeScope(this.document.children, data, [], this.defaults, this.registry)
    this.commit(() => {
      if (options.baseline === true)
        this.initial = cloneJson(next)
      this.values = next
      this.validated = false
      this.touched = []
      this.issues = []
    })
  }

  setValue(path: JsonPath, value: JsonValue): void {
    this.alive()
    const { node } = this.resolve(path)
    const next = normalizeValue(node, value, path, this.registry)
    this.commit(() => this.write(path, next))
  }

  getState(target: FormTarget): NodeState | undefined {
    this.alive()
    return this.states.get(this.targetKey(target))
  }

  getIssues(): readonly ValueIssue[] {
    this.alive()
    return this.issues
  }

  getLinkageIssues(): readonly LinkageIssue[] {
    this.alive()
    return this.linkageIssues
  }

  validate(): ValidationOutcome {
    this.alive()
    const all = this.runValidation()
    const before = this.issues
    this.validated = true
    this.issues = all
    this.emitIssues(before)
    return { valid: all.length === 0, issues: all }
  }

  validateField(path: JsonPath): ValidationOutcome {
    this.alive()
    this.resolve(path)
    const all = this.runValidation()
    if (!this.touched.some(item => jsonEquals(item as JsonValue, path as JsonValue)))
      this.touched.push([...path])
    const before = this.issues
    this.issues = this.visibleIssues(all)
    this.emitIssues(before)
    const own = all.filter(issue => isJsonPathPrefix(issue.path, path))
    return { valid: own.length === 0, issues: own }
  }

  reset(): void {
    this.alive()
    this.commit(() => {
      this.values = cloneJson(this.initial)
      this.validated = false
      this.touched = []
      this.issues = []
    })
  }

  isDirty(): boolean {
    this.alive()
    return !jsonEquals(this.settle(cloneJson(this.initial)).values, this.values)
  }

  private setOverride(target: FormTarget, field: OverrideField, value: boolean | null): void {
    this.alive()
    const key = this.targetKey(target)
    const next: Record<string, boolean> = { ...this.overrides.get(key) }
    if (value === null)
      delete next[field]
    else
      next[field] = value
    this.commit(() => {
      if (Object.keys(next).length === 0)
        this.overrides.delete(key)
      else
        this.overrides.set(key, next)
    })
  }

  setHidden(target: FormTarget, hidden: boolean | null): void {
    this.setOverride(target, 'hidden', hidden)
  }

  setDisabled(target: FormTarget, disabled: boolean | null): void {
    this.setOverride(target, 'disabled', disabled)
  }

  setReadOnly(target: FormTarget, readOnly: boolean | null): void {
    this.setOverride(target, 'readOnly', readOnly)
  }

  private listAt(listPath: JsonPath): { resolved: ResolvedPath, list: ContainerNode, rows: readonly JsonValue[] } {
    const resolved = this.resolve(listPath)
    const list = resolved.node
    if (!isListContainer(list))
      throw new FormRuntimeError('XH_FORM_RT_NOT_A_LIST', { path: pathText(listPath) })
    const rows = this.read(listPath)
    if (!Array.isArray(rows))
      throw new FormRuntimeError('XH_FORM_RT_UNKNOWN_PATH', { path: pathText(listPath) })
    return { resolved, list, rows }
  }

  private requireRow(index: number, length: number): void {
    if (!Number.isSafeInteger(index) || index < 0 || index >= length)
      throw new FormRuntimeError('XH_FORM_RT_INDEX_OUT_OF_RANGE', { index: String(index), max: length - 1 })
  }

  /** 行结构变更后，把行级的强制设定、选项状态与校验进度移到新行号上；被删行的这些状态一并丢弃。 */
  private remapRows(list: ResolvedPath, listPath: JsonPath, mutation: FormArrayMutation): void {
    const inside = new Set(descendantsOf(list.node).map(node => node.id))
    inside.delete(list.node.id)
    const remapKey = (key: string): string | null => {
      const { nodeId, rowPath } = parseInstanceKey(key)
      if (!inside.has(nodeId))
        return key
      const next = rebaseFormArrayPath(rowPath, list.rowPath, mutation) as readonly number[] | null
      return next === null ? null : instanceKey(nodeId, next)
    }
    for (const store of [this.overrides, this.optionStates, this.optionRequests] as Map<string, unknown>[]) {
      const entries = [...store]
      store.clear()
      for (const [key, value] of entries) {
        const next = remapKey(key)
        if (next !== null)
          store.set(next, value)
      }
    }
    this.touched = this.touched.flatMap((path) => {
      const next = rebaseFormArrayPath(path, listPath, mutation) as JsonPath | null
      return next === null ? [] : [next]
    })
  }

  addRow(listPath: JsonPath, options: AddRowOptions = {}): void {
    this.alive()
    const { resolved, list, rows } = this.listAt(listPath)
    const index = options.index ?? rows.length
    if (!Number.isSafeInteger(index) || index < 0 || index > rows.length)
      throw new FormRuntimeError('XH_FORM_RT_INDEX_OUT_OF_RANGE', { index: String(index), max: rows.length })
    const row = normalizeRow(list, options.values ?? {}, [...listPath, index], this.registry)
    this.commit(() => {
      this.remapRows(resolved, listPath, { type: 'insert', index })
      const list = this.read(listPath) as readonly JsonValue[]
      this.write(listPath, [...list.slice(0, index), row, ...list.slice(index)])
    })
  }

  removeRow(listPath: JsonPath, index: number): void {
    this.alive()
    const { resolved, rows } = this.listAt(listPath)
    this.requireRow(index, rows.length)
    this.commit(() => {
      this.remapRows(resolved, listPath, { type: 'remove', index })
      const list = this.read(listPath) as readonly JsonValue[]
      this.write(listPath, list.filter((_, at) => at !== index))
    })
  }

  moveRow(listPath: JsonPath, from: number, to: number): void {
    this.alive()
    const { resolved, rows } = this.listAt(listPath)
    this.requireRow(from, rows.length)
    this.requireRow(to, rows.length)
    if (from === to)
      return
    this.commit(() => {
      this.remapRows(resolved, listPath, { type: 'move', from, to })
      const list = [...this.read(listPath) as readonly JsonValue[]]
      list.splice(to, 0, ...list.splice(from, 1))
      this.write(listPath, list)
    })
  }

  private optionField(key: string): FieldNode {
    const { nodeId } = parseInstanceKey(key)
    const node = findNode(this.document, nodeId)?.node
    if (node?.type !== 'field' || optionsDescriptor(node, this.registry) === undefined)
      throw new FormRuntimeError('XH_FORM_RT_NO_OPTIONS', { nodeId })
    return node
  }

  getOptions(target: FormTarget): OptionsState {
    this.alive()
    const key = this.targetKey(target)
    const node = this.optionField(key)
    if (optionSourceOf(node) !== undefined)
      return this.optionStates.get(key) ?? { status: 'idle', items: [] }
    return { status: 'ready', items: (node.data.options ?? []) as unknown as readonly OptionItem[] }
  }

  private instancePath(node: FieldNode, rowPath: readonly number[]): JsonPath {
    const binding = listBindings(this.document).find(item => item.node.id === node.id)!
    const path: (string | number)[] = []
    binding.path.forEach((key, index) => {
      path.push(key)
      if (index < binding.path.length - 1)
        path.push(rowPath[index]!)
    })
    return path
  }

  private optionTargets(target: FormTarget | undefined): string[] {
    if (target !== undefined && typeof target !== 'string')
      return [this.targetKey(target)]
    const keys: string[] = []
    walkNodes(this.document, (node) => {
      if (node.type !== 'field' || optionSourceOf(node) === undefined || (target !== undefined && node.id !== target))
        return
      for (const key of this.states.keys()) {
        if (key === node.id || key.startsWith(`${node.id}#`))
          keys.push(key)
      }
    })
    if (typeof target === 'string' && keys.length === 0)
      this.optionField(this.targetKey(target))
    return keys
  }

  async reloadOptions(target?: FormTarget): Promise<void> {
    this.alive()
    const keys = this.optionTargets(target).filter(key => optionSourceOf(this.optionField(key)) !== undefined)
    if (keys.length === 0)
      return
    const loader = this.loader
    if (loader === undefined)
      throw new FormRuntimeError('XH_FORM_RT_NO_OPTION_LOADER')
    const pending = keys.map((key) => {
      const node = this.optionField(key)
      const { rowPath } = parseInstanceKey(key)
      const request = { source: optionSourceOf(node)!, nodeId: node.id, path: this.instancePath(node, rowPath), values: cloneJson(this.values) }
      const ticket = ++this.requestCounter
      this.optionRequests.set(key, ticket)
      const previous = this.optionStates.get(key)
      this.optionStates.set(key, { status: 'loading', items: previous?.items ?? [] })
      return { key, node, ticket, run: Promise.resolve().then(() => loader(request)) }
    })
    this.emit([{ type: 'options', keys: pending.map(item => item.key) }])
    await Promise.all(pending.map(async ({ key, node, ticket, run }) => {
      let next: OptionsState
      try {
        const items = await run
        next = isValidOptions(optionsDescriptor(node, this.registry)!, items) ? { status: 'ready', items: cloneJson(items as never) } : { status: 'error', items: [] }
      }
      catch {
        next = { status: 'error', items: [] }
      }
      if (this.disposed || this.optionRequests.get(key) !== ticket)
        return
      this.optionStates.set(key, next)
      this.emit([{ type: 'options', keys: [key] }])
    }))
  }

  setVariables(variables: Readonly<Record<string, unknown>>): void {
    this.alive()
    this.commit(() => {
      this.variables = { ...variables }
    })
  }

  subscribe(listener: (event: FormEvent) => void): () => void {
    this.alive()
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispose(): void {
    this.disposed = true
    this.listeners.clear()
  }
}

/**
 * 创建表单控制器。创建时先做 schema 自校验，有问题就抛 `XH_FORM_RT_INVALID_DOCUMENT`（问题列表在 `issues`）；
 * 文档里有表达式却没有引擎时抛 `XH_FORM_RT_NO_ENGINE`。不碰 DOM，不写全局状态，多个实例互不影响。
 */
export function createFormController(options: FormControllerOptions): FormController {
  return new Controller(options)
}
