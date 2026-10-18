/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// schema 自校验：对任意输入逐项核对文档结构、种类、属性、数据键、区域、规则与扩展数据的形状，再跑各扩展的规则。
// 问题形状取 @xihan-ui/designer-kit/schema 的 SchemaIssue：路径从文档根算起，节点、区域、规则用 target 标出。

import type { JsonPath, JsonValue } from '@xihan-ui/core/json'
import type { ControlKind } from '@xihan-ui/designer-kit/properties'
import type { IssueDetails, IssueReporter, IssueSeverity, SchemaIssueTarget } from '@xihan-ui/designer-kit/schema'
import type { ExpressionEngine } from '@xihan-ui/expression'
import type { FormCoreExtension, FormModel } from './extensions'
import type { FormSchemaIssue, FormSchemaIssueCode } from './issues'
import type { KindDefinition, KindRegistry, ValueKind } from './registry/kinds'
import type { FormPropertyDescriptor } from './registry/properties'
import type { FormDocument, NodeType, ValidationKind } from './schema'
import { isJsonValue } from '@xihan-ui/core/json'
import { checkExtensionData, runExtensionRules } from '@xihan-ui/designer-kit'
import { createIssueSink, readArray, readNumber, readObject, readOneOf, readString, withSeverity } from '@xihan-ui/designer-kit/schema'
import { compileFormPattern } from '@xihan-ui/headless'
import { isValueOfKind } from './bindings'
import { isValidKey } from './create'
import { RUNTIME_VARIABLES } from './expression'
import { createFormModel } from './extensions'
import { LINKAGE_ACTIONS } from './registry/kinds'
import { findFormPropertyValueIssue, propertyName } from './registry/properties'
import { FORM_SCHEMA_VERSION, PROPERTY_GROUPS } from './schema'

/** schema 自校验的选项。 */
export interface ValidateDocumentOptions {
  /** 种类、表单设置、编辑方式与规则都从这组扩展来，内置扩展自动排在最前；与渲染器、设计器的 extensions 是同一份。 */
  readonly extensions?: readonly FormCoreExtension[]
  /** 表达式引擎；提供时逐条检查规则里的表达式。 */
  readonly expressionEngine?: ExpressionEngine
  /** 宿主提供给表达式的额外顶层名字。 */
  readonly identifiers?: readonly string[]
  /** 节点嵌套层数上限，缺省 32。 */
  readonly maxDepth?: number
  /** 按问题码改严重程度，`off` 去掉该码；缺省全部为 error。扩展规则的问题码也认。 */
  readonly severity?: Readonly<Partial<Record<FormSchemaIssueCode | (string & {}), IssueSeverity | 'off'>>>
}

const NODE_TYPES: readonly NodeType[] = ['field', 'container', 'static']
const DOCUMENT_REQUIRED = ['schemaVersion', 'settings', 'children']
const DOCUMENT_FIELDS = [...DOCUMENT_REQUIRED, 'extensions']
const NODE_FIELDS: Readonly<Record<NodeType, readonly string[]>> = {
  field: ['type', 'id', 'kind', 'key', 'basic', 'data', 'appearance', 'validation', 'linkage', 'extensions'],
  container: ['type', 'id', 'kind', 'key', 'basic', 'data', 'appearance', 'validation', 'linkage', 'regions', 'extensions'],
  static: ['type', 'id', 'kind', 'basic', 'data', 'appearance', 'linkage', 'extensions'],
}
const NODE_REQUIRED: Readonly<Record<NodeType, readonly string[]>> = {
  field: ['kind', 'basic', 'data', 'appearance', 'validation', 'linkage'],
  container: ['kind', 'basic', 'data', 'appearance', 'validation', 'linkage', 'regions'],
  static: ['kind', 'basic', 'data', 'appearance', 'linkage'],
}
const REGION_FIELDS = ['id', 'props', 'children']
const RULE_FIELDS: Readonly<Record<ValidationKind, readonly string[]>> = {
  required: ['id', 'kind', 'message'],
  accepted: ['id', 'kind', 'message'],
  length: ['id', 'kind', 'min', 'max', 'message'],
  range: ['id', 'kind', 'min', 'max', 'message'],
  pattern: ['id', 'kind', 'pattern', 'flags', 'message'],
  expression: ['id', 'kind', 'expression', 'message'],
}
const RULE_KINDS = Object.keys(RULE_FIELDS) as ValidationKind[]
const LINKAGE_FIELDS = ['id', 'action', 'when', 'value']
const LENGTH_KINDS: ReadonlySet<ValueKind> = new Set(['string', 'string-list', 'number-list', 'list'])

interface PendingExpression {
  readonly path: JsonPath
  readonly target: SchemaIssueTarget
  readonly source: string
  readonly hasValue: boolean
  readonly inList: boolean
}

interface PendingDependencies {
  readonly path: JsonPath
  readonly target: SchemaIssueTarget
  readonly key: unknown
  readonly chain: readonly (string | null)[]
  readonly dependencies: readonly string[]
}

interface NodeContext {
  readonly scope: string | null
  /** 从所在作用域到顶层的作用域链。 */
  readonly chain: readonly (string | null)[]
  readonly depth: number
  readonly inList: boolean
  readonly accepts: 'any' | 'fields'
}

type Params = IssueDetails['params']

class DocumentChecker {
  private readonly sink = createIssueSink<FormSchemaIssue['code']>()
  private readonly ids = new Set<string>()
  private readonly scopes = new Map<string | null, Set<string>>()
  private readonly expressions: PendingExpression[] = []
  private readonly dependencies: PendingDependencies[] = []
  private readonly registry: KindRegistry
  private readonly controls: Readonly<Record<string, ControlKind>>
  private readonly settings: readonly FormPropertyDescriptor[]
  private readonly maxDepth: number
  private tooDeep = false
  /** 文档或某个节点、区域缺了必需的部分或类型不对，扩展规则拿不到合乎类型的文档。 */
  broken = false

  constructor(model: FormModel, maxDepth: number) {
    this.registry = model.registry
    this.controls = model.controls
    this.settings = model.documentProperties
    this.maxDepth = maxDepth
  }

  get issues(): readonly FormSchemaIssue[] {
    return this.sink.issues
  }

  report(code: FormSchemaIssue['code'], path: JsonPath, target?: SchemaIssueTarget, params?: Params): void {
    this.sink.report(code, path, { ...(target ? { target } : {}), ...(params ? { params } : {}) })
  }

  /** 读取器用的收集器：报出的问题都带上 target。 */
  private at(target?: SchemaIssueTarget): IssueReporter {
    return { report: (code, path, details = {}) => this.sink.report(code, path, target ? { ...details, target } : details) }
  }

  /** 读取普通对象；与读取器不同，值缺省（undefined）也算类型不符。 */
  private object(reporter: IssueReporter, value: unknown, path: JsonPath, rule: Parameters<typeof readObject>[3] = {}): Readonly<Record<string, unknown>> | undefined {
    if (value === undefined) {
      reporter.report('invalid-type', path, { params: { expected: 'object' } })
      return undefined
    }
    return readObject(reporter, value, path, rule)
  }

  private claimId(id: string, path: JsonPath, target: SchemaIssueTarget): void {
    if (this.ids.has(id))
      this.report('duplicate-id', path, target, { id })
    this.ids.add(id)
  }

  private properties(bag: Readonly<Record<string, unknown>>, descriptors: readonly FormPropertyDescriptor[], path: JsonPath, target?: SchemaIssueTarget): void {
    for (const [name, value] of Object.entries(bag)) {
      const descriptor = descriptors.find(item => propertyName(item) === name)
      if (descriptor === undefined) {
        this.report('unknown-key', [...path, name], target)
        continue
      }
      const issue = findFormPropertyValueIssue(descriptor.control, value, this.controls)
      if (issue !== undefined)
        this.report(issue.code, [...path, name, ...issue.path], target)
    }
  }

  /** 对象上扩展数据的形状：有就是对象，每个扩展的数据也是对象，里面不看。 */
  private extensionData(owner: Readonly<Record<string, unknown>>, path: JsonPath, target?: SchemaIssueTarget): void {
    for (const issue of checkExtensionData(owner as JsonValue, path))
      this.report(issue.code, issue.path, target, { expected: 'object' })
  }

  run(document: unknown): void {
    const root = this.object(this.at(), document, [], { required: DOCUMENT_REQUIRED, allowed: DOCUMENT_FIELDS })
    if (root === undefined || root.schemaVersion === undefined) {
      this.broken = true
      return
    }
    if (root.schemaVersion !== FORM_SCHEMA_VERSION) {
      this.report('document.unsupportedVersion', ['schemaVersion'], undefined, { version: String(root.schemaVersion) })
      this.broken = true
      return
    }
    const settings = readObject(this.at(), root.settings, ['settings'])
    const children = readArray(this.at(), root.children, ['children'])
    if (settings === undefined || children === undefined) {
      this.broken = true
      return
    }
    this.extensionData(root, [])
    this.properties(settings, this.settings, ['settings'])
    children.forEach((child, index) => this.node(child, ['children', index], { scope: null, chain: [null], depth: 1, inList: false, accepts: 'any' }))
  }

  private optionDependencies(node: Readonly<Record<string, unknown>>, path: JsonPath, target: SchemaIssueTarget, definition: KindDefinition | undefined, context: NodeContext): void {
    if (definition === undefined || !definition.properties.data.some(property => propertyName(property) === 'optionDependencies'))
      return
    const data = node.data as Record<string, unknown>
    const dependencies = data.optionDependencies
    if (!Array.isArray(dependencies) || !dependencies.every(item => typeof item === 'string'))
      return
    if (typeof data.optionSource !== 'string' || data.optionSource === '')
      this.report('field.dependencyWithoutSource', [...path, 'data', 'optionSource'], target)
    this.dependencies.push({ path: [...path, 'data', 'optionDependencies'], target, key: node.key, chain: context.chain, dependencies })
  }

  /** 选项依赖要在全部键登记完之后核对：由内向外沿作用域链查找，内层同名的键遮住外层。 */
  checkDependencies(): void {
    for (const { path, target, key, chain, dependencies } of this.dependencies) {
      const seen = new Set<string>()
      dependencies.forEach((dependency, index) => {
        const at = [...path, index]
        if (seen.has(dependency)) {
          this.report('duplicate-key', at, target, { key: dependency })
          return
        }
        seen.add(dependency)
        if (dependency === key)
          this.report('field.selfDependency', at, target, { key: dependency })
        else if (!chain.some(scope => this.scopes.get(scope)?.has(dependency) === true))
          this.report('field.unknownDependency', at, target, { key: dependency })
      })
    }
  }

  rootKeys(): string[] {
    return [...(this.scopes.get(null) ?? [])]
  }

  pending(): readonly PendingExpression[] {
    return this.expressions
  }

  private claimKey(key: unknown, scope: string | null, path: JsonPath, target: SchemaIssueTarget): void {
    if (key === undefined) {
      this.report('required', path, target)
      return
    }
    if (typeof key !== 'string') {
      this.report('invalid-type', path, target, { expected: 'string' })
      return
    }
    if (!isValidKey(key)) {
      this.report('invalid-value', path, target, { key })
      return
    }
    let keys = this.scopes.get(scope)
    if (keys === undefined) {
      keys = new Set()
      this.scopes.set(scope, keys)
    }
    if (keys.has(key))
      this.report('duplicate-key', path, target, { key })
    keys.add(key)
  }

  private node(value: unknown, path: JsonPath, context: NodeContext): void {
    if (context.depth > this.maxDepth) {
      if (!this.tooDeep)
        this.report('document.tooDeep', path, undefined, { max: this.maxDepth })
      this.tooDeep = true
      return
    }
    const node = this.object(this.at(), value, path, { required: ['id', 'type'] })
    const nodeId = node === undefined ? undefined : readString(this.at(), node.id, [...path, 'id'], { nonEmpty: true })
    if (node === undefined || nodeId === undefined) {
      this.broken = true
      return
    }
    const target: SchemaIssueTarget = { kind: 'node', id: nodeId }
    const at = this.at(target)
    this.claimId(nodeId, [...path, 'id'], target)
    const type = readOneOf(at, node.type, [...path, 'type'], NODE_TYPES)
    if (type === undefined) {
      this.broken = true
      return
    }
    readObject(at, node, path, { required: NODE_REQUIRED[type], allowed: NODE_FIELDS[type] })
    const kind = readString(at, node.kind, [...path, 'kind'], { nonEmpty: true })
    const groupsOk = PROPERTY_GROUPS.map(group => readObject(at, node[group], [...path, group]) !== undefined).every(Boolean)
    const linkage = readArray(at, node.linkage, [...path, 'linkage'])
    const validation = type === 'static' ? [] : readArray(at, node.validation, [...path, 'validation'])
    const regions = type === 'container' ? readArray(at, node.regions, [...path, 'regions']) : []
    if (kind === undefined || !groupsOk || linkage === undefined || validation === undefined || regions === undefined) {
      this.broken = true
      return
    }
    this.extensionData(node, path, target)
    if (context.accepts === 'fields' && type !== 'field')
      this.report('region.childNotAllowed', path, target, { kind })
    let definition: KindDefinition | undefined = this.registry.get(kind)
    if (definition === undefined) {
      this.report('node.unknownKind', [...path, 'kind'], target, { kind })
    }
    else if (definition.type !== type) {
      this.report('node.kindTypeMismatch', [...path, 'type'], target, { kind, type })
      definition = undefined
    }
    if (definition !== undefined) {
      for (const group of PROPERTY_GROUPS)
        this.properties(node[group] as Record<string, unknown>, definition.properties[group], [...path, group], target)
    }
    const valueKind = this.valueKind(definition, node)
    if (type === 'field') {
      this.optionDependencies(node, path, target, definition, context)
      this.claimKey(node.key, context.scope, [...path, 'key'], target)
      const initial = (node.basic as Record<string, unknown>).initialValue
      if (initial !== undefined && valueKind !== null && isJsonValue(initial) && !isValueOfKind(valueKind, initial))
        this.report('invalid-value', [...path, 'basic', 'initialValue'], target, { valueKind })
    }
    const isList = definition?.type === 'container' && definition.scope === 'list'
    if (type === 'container') {
      if (isList)
        this.claimKey(node.key, context.scope, [...path, 'key'], target)
      else if (node.key !== undefined && definition !== undefined)
        this.report('unknown-key', [...path, 'key'], target)
    }
    validation.forEach((rule, index) => this.validationRule(rule, [...path, 'validation', index], target, definition, valueKind, isList, context.inList))
    linkage.forEach((rule, index) => this.linkageRule(rule, [...path, 'linkage', index], target, type, type === 'field' || isList, context.inList))
    if (type === 'container')
      this.regions(node, regions, path, target, definition, context, isList)
  }

  private valueKind(definition: KindDefinition | undefined, node: Readonly<Record<string, unknown>>): ValueKind | null {
    if (definition?.type !== 'field')
      return null
    try {
      return definition.valueKind(node.data as Record<string, never>)
    }
    catch {
      return null
    }
  }

  private regions(node: Readonly<Record<string, unknown>>, regions: readonly unknown[], path: JsonPath, target: SchemaIssueTarget, definition: KindDefinition | undefined, context: NodeContext, isList: boolean): void {
    const container = definition?.type === 'container' ? definition : undefined
    if (container !== undefined) {
      const { min, max } = container.regions
      if (regions.length < min || (max !== null && regions.length > max))
        this.report('out-of-range', [...path, 'regions'], target, max === null ? { min, actual: regions.length } : { min, max, actual: regions.length })
    }
    const regionPaths = new Map<string, JsonPath>()
    let regionsOk = true
    regions.forEach((value, index) => {
      const regionPath = [...path, 'regions', index]
      const region = this.object(this.at(target), value, regionPath, { required: REGION_FIELDS, allowed: REGION_FIELDS })
      const regionId = region === undefined ? undefined : readString(this.at(target), region.id, [...regionPath, 'id'], { nonEmpty: true })
      const own: SchemaIssueTarget | undefined = regionId === undefined ? undefined : { kind: 'region', id: regionId }
      const props = region === undefined ? undefined : readObject(this.at(own ?? target), region.props, [...regionPath, 'props'])
      const children = region === undefined ? undefined : readArray(this.at(own ?? target), region.children, [...regionPath, 'children'])
      if (own === undefined || props === undefined || children === undefined) {
        regionsOk = false
        this.broken = true
        return
      }
      regionPaths.set(own.id, regionPath)
      this.claimId(own.id, [...regionPath, 'id'], own)
      if (container !== undefined)
        this.properties(props, container.regionProperties, [...regionPath, 'props'], own)
      const childContext: NodeContext = {
        scope: isList ? target.id : context.scope,
        chain: isList ? [target.id, ...context.chain] : context.chain,
        depth: context.depth + 1,
        inList: context.inList || isList,
        accepts: container?.accepts ?? 'any',
      }
      children.forEach((child, childIndex) => this.node(child, [...regionPath, 'children', childIndex], childContext))
    })
    if (regionsOk && container?.check !== undefined) {
      for (const problem of container.check(node as never)) {
        const regionPath = problem.regionId === undefined ? undefined : regionPaths.get(problem.regionId)
        this.report(
          problem.code,
          regionPath ?? [...path, 'regions'],
          regionPath === undefined ? target : { kind: 'region', id: problem.regionId! },
          problem.params === undefined ? undefined : { ...problem.params },
        )
      }
    }
  }

  /** 读规则的 id 并登记；读不出时返回 undefined。 */
  private ruleTarget(rule: unknown, path: JsonPath, owner: SchemaIssueTarget, required: readonly string[]): { rule: Readonly<Record<string, unknown>>, target: SchemaIssueTarget } | undefined {
    const value = this.object(this.at(owner), rule, path, { required })
    if (value === undefined)
      return undefined
    const id = readString(this.at(owner), value.id, [...path, 'id'], { nonEmpty: true })
    if (id === undefined)
      return undefined
    const target: SchemaIssueTarget = { kind: 'rule', id }
    this.claimId(id, [...path, 'id'], target)
    return { rule: value, target }
  }

  private validationRule(value: unknown, path: JsonPath, owner: SchemaIssueTarget, definition: KindDefinition | undefined, valueKind: ValueKind | null, isList: boolean, inList: boolean): void {
    const read = this.ruleTarget(value, path, owner, ['id', 'kind'])
    if (read === undefined)
      return
    const { rule, target } = read
    const at = this.at(target)
    const kind = readOneOf(at, rule.kind, [...path, 'kind'], RULE_KINDS)
    if (kind === undefined)
      return
    readObject(at, rule, path, { allowed: RULE_FIELDS[kind] })
    readString(at, rule.message, [...path, 'message'])
    if ((definition !== undefined && definition.type !== 'static' && !definition.validations.includes(kind)) || !this.fitsValueKind(kind, valueKind, isList))
      this.report('rule.notApplicable', [...path, 'kind'], target, { kind })
    switch (kind) {
      case 'length':
        this.bounds(rule, path, target, true)
        break
      case 'range':
        this.bounds(rule, path, target, false)
        break
      case 'pattern':
        this.pattern(rule, path, target)
        break
      case 'expression':
        this.expression(rule.expression, [...path, 'expression'], target, true, inList, true)
        break
      case 'required':
      case 'accepted':
        break
    }
  }

  private fitsValueKind(kind: ValidationKind, valueKind: ValueKind | null, isList: boolean): boolean {
    if (kind === 'required' || kind === 'expression')
      return true
    if (isList)
      return kind === 'length'
    if (valueKind === null)
      return true
    if (kind === 'length')
      return LENGTH_KINDS.has(valueKind)
    if (kind === 'range')
      return valueKind === 'number'
    if (kind === 'accepted')
      return valueKind === 'boolean'
    return valueKind === 'string'
  }

  /** 长度的上下限是非负整数，范围的上下限是有限数字；至少给一个，下限不大于上限。 */
  private bounds(rule: Readonly<Record<string, unknown>>, path: JsonPath, target: SchemaIssueTarget, length: boolean): void {
    if (rule.min === undefined && rule.max === undefined) {
      this.report('rule.boundsMissing', path, target)
      return
    }
    const numberRule = length ? { integer: true, min: 0 } : {}
    const min = readNumber(this.at(target), rule.min, [...path, 'min'], numberRule)
    const max = readNumber(this.at(target), rule.max, [...path, 'max'], numberRule)
    if (min !== undefined && max !== undefined && min > max)
      this.report('rule.invalidRange', [...path, 'min'], target, { min, max })
  }

  private pattern(rule: Readonly<Record<string, unknown>>, path: JsonPath, target: SchemaIssueTarget): void {
    if (rule.pattern === undefined) {
      this.report('required', [...path, 'pattern'], target)
      return
    }
    const pattern = readString(this.at(target), rule.pattern, [...path, 'pattern'], { nonEmpty: true })
    const flags = readString(this.at(target), rule.flags, [...path, 'flags'])
    if (pattern === undefined || (rule.flags !== undefined && flags === undefined))
      return
    const compiled = compileFormPattern(pattern, { flags })
    if (!compiled.ok)
      this.report('rule.invalidPattern', [...path, compiled.code === 'invalid-flags' ? 'flags' : 'pattern'], target, { reason: compiled.code })
  }

  private expression(source: unknown, path: JsonPath, target: SchemaIssueTarget, hasValue: boolean, inList: boolean, required: boolean): void {
    if (source === undefined) {
      if (required)
        this.report('required', path, target)
      return
    }
    if (typeof source !== 'string') {
      this.report('invalid-type', path, target, { expected: 'string' })
      return
    }
    if (source.trim() === '') {
      this.report('empty', path, target)
      return
    }
    this.expressions.push({ path, target, source, hasValue, inList })
  }

  private linkageRule(value: unknown, path: JsonPath, owner: SchemaIssueTarget, type: NodeType, hasValue: boolean, inList: boolean): void {
    const read = this.ruleTarget(value, path, owner, ['id', 'action'])
    if (read === undefined)
      return
    const { rule, target } = read
    const at = this.at(target)
    readObject(at, rule, path, { allowed: LINKAGE_FIELDS })
    const action = readOneOf(at, rule.action, [...path, 'action'], LINKAGE_ACTIONS.field)
    if (action === undefined)
      return
    if (!LINKAGE_ACTIONS[type].includes(action))
      this.report('linkage.actionNotApplicable', [...path, 'action'], target, { action })
    this.expression(rule.when, [...path, 'when'], target, hasValue, inList, false)
    if (action === 'assign')
      this.expression(rule.value, [...path, 'value'], target, hasValue, inList, true)
    else if (rule.value !== undefined)
      this.report('unknown-key', [...path, 'value'], target)
  }
}

/**
 * 校验文档：输入可以是任意值（如反序列化的 JSON），逐项核对后返回全部问题，没有问题时返回空数组。
 * 种类、表单设置、编辑方式与规则按 `extensions` 合出的模型认；文档与各节点上的扩展数据只查形状。
 * 问题的路径从文档根算起，只用键与下标；问题落在节点、区域或规则上时由 target 标出。
 * 提供表达式引擎时，再按各规则所在位置可引用的名字检查表达式。文档与各节点的必需部分齐全、类型都对时，最后按扩展顺序跑各扩展的规则。
 * 严重程度缺省为 error，可用 `severity` 按问题码改。扩展冲突时抛 `DesignerExtensionError`。
 */
export function validateDocument(document: unknown, options: ValidateDocumentOptions = {}): readonly FormSchemaIssue[] {
  const maxDepth = options.maxDepth ?? 32
  if (!Number.isSafeInteger(maxDepth) || maxDepth <= 0)
    throw new TypeError('maxDepth 必须是正整数')
  const model = createFormModel(options.extensions)
  const checker = new DocumentChecker(model, maxDepth)
  checker.run(document)
  checker.checkDependencies()
  const engine = options.expressionEngine
  if (engine !== undefined) {
    const base = [...checker.rootKeys(), ...(options.identifiers ?? [])]
    for (const item of checker.pending()) {
      const names = new Set(base)
      if (item.hasValue)
        names.add(RUNTIME_VARIABLES.value)
      if (item.inList) {
        names.add(RUNTIME_VARIABLES.row)
        names.add(RUNTIME_VARIABLES.index)
      }
      const result = engine.compile(item.source, { identifiers: [...names] })
      for (const problem of result.ok ? [] : result.issues)
        checker.report('expression.invalid', item.path, item.target, { expressionCode: problem.code, start: problem.start, end: problem.end })
    }
  }
  const rules = checker.broken ? [] : runExtensionRules(model.extensions, document as FormDocument, { registry: model.registry })
  return Object.freeze(withSeverity([...checker.issues, ...rules], {}, options.severity).map(issue => Object.freeze(issue)))
}
