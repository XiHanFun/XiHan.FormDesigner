/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// schema 自校验：对任意输入逐项核对文档结构、种类、属性、数据键、区域与规则，只返回问题码。

import type { ExpressionEngine } from './expression'
import type { FormIssue, FormIssueCode } from './issues'
import type { KindDefinition, KindRegistry, ValueKind } from './registry/kinds'
import type { PropertyDescriptor } from './registry/properties'
import type { NodeType, ValidationKind } from './schema'
import { isValueOfKind } from './bindings'
import { FORM_SETTING_PROPERTIES, isValidKey } from './create'
import { RUNTIME_VARIABLES } from './expression'
import { formIssue } from './issues'
import { isJsonValue, isPlainObject } from './json'
import { LINKAGE_ACTIONS } from './registry/kinds'
import { isValidPropertyValue } from './registry/properties'
import { FORM_SCHEMA_VERSION, PROPERTY_GROUPS } from './schema'

/** schema 自校验的选项。 */
export interface ValidateDocumentOptions {
  /** 表达式引擎；提供时逐条检查规则里的表达式。 */
  readonly engine?: ExpressionEngine
  /** 宿主提供给表达式的额外顶层名字。 */
  readonly identifiers?: readonly string[]
  /** 节点嵌套层数上限，缺省 32。 */
  readonly maxDepth?: number
}

/** 正则规则的源码长度上限。 */
const PATTERN_LENGTH_LIMIT = 1000
const PATTERN_FLAGS = 'imsu'
const DOCUMENT_FIELDS = ['schemaVersion', 'settings', 'children']
const NODE_FIELDS: Readonly<Record<NodeType, readonly string[]>> = {
  field: ['type', 'id', 'kind', 'key', 'basic', 'data', 'appearance', 'validation', 'linkage'],
  container: ['type', 'id', 'kind', 'key', 'basic', 'data', 'appearance', 'validation', 'linkage', 'regions'],
  static: ['type', 'id', 'kind', 'basic', 'data', 'appearance', 'linkage'],
}
const REGION_FIELDS = ['id', 'props', 'children']
const RULE_FIELDS: Readonly<Record<ValidationKind, readonly string[]>> = {
  required: ['id', 'kind', 'message'],
  length: ['id', 'kind', 'min', 'max', 'message'],
  range: ['id', 'kind', 'min', 'max', 'message'],
  pattern: ['id', 'kind', 'pattern', 'flags', 'message'],
  expression: ['id', 'kind', 'expression', 'message'],
}
const LINKAGE_FIELDS = ['id', 'action', 'when', 'value']
const LENGTH_KINDS: ReadonlySet<ValueKind> = new Set(['string', 'string-list', 'number-list', 'list'])

interface PendingExpression {
  readonly nodeId: string
  readonly ruleId: string
  readonly part: 'when' | 'value' | 'expression'
  readonly source: string
  readonly hasValue: boolean
  readonly inList: boolean
}

interface NodeContext {
  readonly scope: string | null
  readonly depth: number
  readonly inList: boolean
  readonly accepts: 'any' | 'fields'
}

interface Located { nodeId?: string, regionId?: string, ruleId?: string }

/** 正则标志只能取 i、m、s、u，且不重复。 */
function isPatternFlags(flags: unknown): boolean {
  return typeof flags === 'string' && [...flags].every((flag, index) => PATTERN_FLAGS.includes(flag) && flags.indexOf(flag) === index)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

class DocumentChecker {
  readonly issues: FormIssue[] = []
  private readonly ids = new Set<string>()
  private readonly scopes = new Map<string | null, Set<string>>()
  private readonly expressions: PendingExpression[] = []
  private readonly registry: KindRegistry
  private readonly maxDepth: number
  private tooDeep = false

  constructor(registry: KindRegistry, maxDepth: number) {
    this.registry = registry
    this.maxDepth = maxDepth
  }

  private report(code: FormIssueCode, at: Located = {}, data?: Record<string, string | number>): void {
    this.issues.push(formIssue(code, at, data))
  }

  private claimId(id: string, at: Located): void {
    if (this.ids.has(id))
      this.report('XH_FORM_DUPLICATE_ID', at, { id })
    this.ids.add(id)
  }

  private unknownFields(value: Record<string, unknown>, allowed: readonly string[], at: Located): void {
    for (const name of Object.keys(value)) {
      if (!allowed.includes(name))
        this.report('XH_FORM_UNKNOWN_NODE_FIELD', at, { name })
    }
  }

  private properties(bag: Record<string, unknown>, descriptors: readonly PropertyDescriptor[], group: string, at: Located): void {
    for (const [name, value] of Object.entries(bag)) {
      const descriptor = descriptors.find(item => item.name === name)
      if (descriptor === undefined)
        this.report('XH_FORM_UNKNOWN_PROPERTY', at, { group, name })
      else if (!isValidPropertyValue(descriptor, value))
        this.report('XH_FORM_INVALID_PROPERTY', at, { group, name })
    }
  }

  run(document: unknown): void {
    if (!isPlainObject(document)) {
      this.report('XH_FORM_INVALID_DOCUMENT')
      return
    }
    if (document.schemaVersion !== FORM_SCHEMA_VERSION) {
      this.report('XH_FORM_SCHEMA_VERSION', {}, { version: String(document.schemaVersion) })
      return
    }
    this.unknownFields(document, DOCUMENT_FIELDS, {})
    if (!isPlainObject(document.settings) || !Array.isArray(document.children)) {
      this.report('XH_FORM_INVALID_DOCUMENT')
      return
    }
    this.properties(document.settings, FORM_SETTING_PROPERTIES, 'settings', {})
    for (const child of document.children)
      this.node(child, { scope: null, depth: 1, inList: false, accepts: 'any' })
  }

  rootKeys(): string[] {
    return [...(this.scopes.get(null) ?? [])]
  }

  pending(): readonly PendingExpression[] {
    return this.expressions
  }

  private claimKey(key: unknown, scope: string | null, at: Located): void {
    if (key === undefined) {
      this.report('XH_FORM_MISSING_KEY', at)
      return
    }
    if (typeof key !== 'string' || !isValidKey(key)) {
      this.report('XH_FORM_INVALID_KEY', at, { key: String(key) })
      return
    }
    let keys = this.scopes.get(scope)
    if (keys === undefined) {
      keys = new Set()
      this.scopes.set(scope, keys)
    }
    if (keys.has(key))
      this.report('XH_FORM_DUPLICATE_KEY', at, { key })
    keys.add(key)
  }

  private node(node: unknown, context: NodeContext): void {
    if (context.depth > this.maxDepth) {
      if (!this.tooDeep)
        this.report('XH_FORM_TOO_DEEP', {}, { max: this.maxDepth })
      this.tooDeep = true
      return
    }
    if (!isPlainObject(node) || !isNonEmptyString(node.id)) {
      this.report('XH_FORM_INVALID_NODE')
      return
    }
    const nodeId = node.id
    const at = { nodeId }
    this.claimId(nodeId, at)
    const type = node.type
    if (type !== 'field' && type !== 'container' && type !== 'static') {
      this.report('XH_FORM_INVALID_NODE', at)
      return
    }
    this.unknownFields(node, NODE_FIELDS[type], at)
    const shapeOk = typeof node.kind === 'string'
      && PROPERTY_GROUPS.every(group => isPlainObject(node[group]))
      && Array.isArray(node.linkage)
      && (type === 'static' || Array.isArray(node.validation))
      && (type !== 'container' || Array.isArray(node.regions))
    if (!shapeOk) {
      this.report('XH_FORM_INVALID_NODE', at)
      return
    }
    if (context.accepts === 'fields' && type !== 'field')
      this.report('XH_FORM_CHILD_NOT_ALLOWED', at, { kind: node.kind as string })
    let definition: KindDefinition | undefined = this.registry.get(node.kind as string)
    if (definition === undefined) {
      this.report('XH_FORM_UNKNOWN_KIND', at, { kind: node.kind as string })
    }
    else if (definition.type !== type) {
      this.report('XH_FORM_KIND_TYPE_MISMATCH', at, { kind: node.kind as string })
      definition = undefined
    }
    if (definition !== undefined) {
      for (const group of PROPERTY_GROUPS)
        this.properties(node[group] as Record<string, unknown>, definition.properties[group], group, at)
    }
    const valueKind = this.valueKind(definition, node)
    if (type === 'field') {
      this.claimKey(node.key, context.scope, at)
      const initial = (node.basic as Record<string, unknown>).initialValue
      if (initial !== undefined && valueKind !== null && isJsonValue(initial) && !isValueOfKind(valueKind, initial))
        this.report('XH_FORM_INVALID_INITIAL_VALUE', at)
    }
    const isList = definition?.type === 'container' && definition.scope === 'list'
    if (type === 'container') {
      if (isList)
        this.claimKey(node.key, context.scope, at)
      else if (node.key !== undefined && definition !== undefined)
        this.report('XH_FORM_UNEXPECTED_KEY', at)
    }
    if (type !== 'static') {
      for (const rule of node.validation as unknown[])
        this.validationRule(rule, nodeId, definition, valueKind, isList, context.inList)
    }
    for (const rule of node.linkage as unknown[])
      this.linkageRule(rule, nodeId, type, type === 'field' || isList, context.inList)
    if (type === 'container')
      this.regions(node, nodeId, definition, context, isList)
  }

  private valueKind(definition: KindDefinition | undefined, node: Record<string, unknown>): ValueKind | null {
    if (definition?.type !== 'field')
      return null
    try {
      return definition.valueKind(node.data as Record<string, never>)
    }
    catch {
      return null
    }
  }

  private regions(node: Record<string, unknown>, nodeId: string, definition: KindDefinition | undefined, context: NodeContext, isList: boolean): void {
    const regions = node.regions as unknown[]
    const container = definition?.type === 'container' ? definition : undefined
    if (container !== undefined) {
      const { min, max } = container.regions
      if (regions.length < min || (max !== null && regions.length > max)) {
        const data: Record<string, number> = { min, actual: regions.length }
        if (max !== null)
          data.max = max
        this.report('XH_FORM_REGION_COUNT', { nodeId }, data)
      }
    }
    let regionsOk = true
    for (const region of regions) {
      if (!isPlainObject(region) || !isNonEmptyString(region.id) || !isPlainObject(region.props) || !Array.isArray(region.children)) {
        this.report('XH_FORM_INVALID_REGION', { nodeId })
        regionsOk = false
        continue
      }
      const at = { nodeId, regionId: region.id }
      this.claimId(region.id, at)
      this.unknownFields(region, REGION_FIELDS, at)
      if (container !== undefined)
        this.properties(region.props, container.regionProperties, 'region', at)
      const childContext: NodeContext = {
        scope: isList ? nodeId : context.scope,
        depth: context.depth + 1,
        inList: context.inList || isList,
        accepts: container?.accepts ?? 'any',
      }
      for (const child of region.children)
        this.node(child, childContext)
    }
    if (regionsOk && container?.check !== undefined) {
      const problems = container.check(node as never)
      for (const problem of problems) {
        const at: Located = problem.regionId === undefined ? { nodeId } : { nodeId, regionId: problem.regionId }
        this.report(problem.code as FormIssueCode, at, problem.data === undefined ? undefined : { ...problem.data })
      }
    }
  }

  private validationRule(rule: unknown, nodeId: string, definition: KindDefinition | undefined, valueKind: ValueKind | null, isList: boolean, inList: boolean): void {
    if (!isPlainObject(rule) || !isNonEmptyString(rule.id)) {
      this.report('XH_FORM_INVALID_RULE', { nodeId })
      return
    }
    const at = { nodeId, ruleId: rule.id }
    this.claimId(rule.id, at)
    const kind = rule.kind
    if (typeof kind !== 'string' || !Object.hasOwn(RULE_FIELDS, kind)) {
      this.report('XH_FORM_INVALID_RULE', at)
      return
    }
    const ruleKind = kind as ValidationKind
    this.unknownFields(rule, RULE_FIELDS[ruleKind], at)
    if (rule.message !== undefined && typeof rule.message !== 'string')
      this.report('XH_FORM_INVALID_RULE', at)
    if (definition !== undefined && definition.type !== 'static' && !definition.validations.includes(ruleKind))
      this.report('XH_FORM_RULE_NOT_APPLICABLE', at, { kind: ruleKind })
    else if (!this.fitsValueKind(ruleKind, valueKind, isList))
      this.report('XH_FORM_RULE_NOT_APPLICABLE', at, { kind: ruleKind })
    switch (ruleKind) {
      case 'length':
        this.bounds(rule, at, value => Number.isSafeInteger(value) && (value as number) >= 0)
        break
      case 'range':
        this.bounds(rule, at, value => typeof value === 'number' && Number.isFinite(value))
        break
      case 'pattern':
        this.pattern(rule, at)
        break
      case 'expression':
        this.expression(rule.expression, { nodeId, ruleId: rule.id, part: 'expression', hasValue: true, inList })
        break
      case 'required':
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
    return valueKind === 'string'
  }

  private bounds(rule: Record<string, unknown>, at: Located, valid: (value: unknown) => boolean): void {
    const { min, max } = rule
    if ((min === undefined && max === undefined) || (min !== undefined && !valid(min)) || (max !== undefined && !valid(max))) {
      this.report('XH_FORM_INVALID_RANGE', at)
      return
    }
    if (min !== undefined && max !== undefined && (min as number) > (max as number))
      this.report('XH_FORM_INVALID_RANGE', at)
  }

  private pattern(rule: Record<string, unknown>, at: Located): void {
    const { pattern, flags } = rule
    if (!isNonEmptyString(pattern) || pattern.length > PATTERN_LENGTH_LIMIT || (flags !== undefined && !isPatternFlags(flags))) {
      this.report('XH_FORM_INVALID_PATTERN', at)
      return
    }
    try {
      // eslint-disable-next-line no-new
      new RegExp(pattern, flags as string | undefined)
    }
    catch {
      this.report('XH_FORM_INVALID_PATTERN', at)
    }
  }

  private expression(source: unknown, pending: Omit<PendingExpression, 'source'>): void {
    const at = { nodeId: pending.nodeId, ruleId: pending.ruleId }
    if (typeof source !== 'string') {
      this.report('XH_FORM_INVALID_RULE', at)
      return
    }
    if (source.trim() === '') {
      this.report('XH_FORM_EMPTY_EXPRESSION', at, { part: pending.part })
      return
    }
    this.expressions.push({ ...pending, source })
  }

  private linkageRule(rule: unknown, nodeId: string, type: NodeType, hasValue: boolean, inList: boolean): void {
    if (!isPlainObject(rule) || !isNonEmptyString(rule.id)) {
      this.report('XH_FORM_INVALID_RULE', { nodeId })
      return
    }
    const at = { nodeId, ruleId: rule.id }
    this.claimId(rule.id, at)
    this.unknownFields(rule, LINKAGE_FIELDS, at)
    const action = rule.action
    if (typeof action !== 'string' || !LINKAGE_ACTIONS.field.includes(action as never)) {
      this.report('XH_FORM_INVALID_RULE', at)
      return
    }
    if (!LINKAGE_ACTIONS[type].includes(action as never))
      this.report('XH_FORM_ACTION_NOT_APPLICABLE', at, { action })
    if (rule.when !== undefined)
      this.expression(rule.when, { nodeId, ruleId: rule.id, part: 'when', hasValue, inList })
    if (action === 'assign') {
      if (rule.value === undefined)
        this.report('XH_FORM_EMPTY_EXPRESSION', at, { part: 'value' })
      else
        this.expression(rule.value, { nodeId, ruleId: rule.id, part: 'value', hasValue, inList })
    }
    else if (rule.value !== undefined) {
      this.report('XH_FORM_INVALID_RULE', at)
    }
  }
}

/**
 * 校验文档：输入可以是任意值（如反序列化的 JSON），逐项核对后返回全部问题，没有问题时返回空数组。
 * 提供表达式引擎时，再按各规则所在位置可引用的名字检查表达式。
 */
export function validateDocument(document: unknown, registry: KindRegistry, options: ValidateDocumentOptions = {}): readonly FormIssue[] {
  const maxDepth = options.maxDepth ?? 32
  if (!Number.isSafeInteger(maxDepth) || maxDepth <= 0)
    throw new TypeError('maxDepth 必须是正整数')
  const checker = new DocumentChecker(registry, maxDepth)
  checker.run(document)
  const engine = options.engine
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
      for (const problem of engine.check(item.source, [...names])) {
        checker.issues.push(formIssue('XH_FORM_EXPRESSION_ERROR', { nodeId: item.nodeId, ruleId: item.ruleId }, {
          part: item.part,
          expressionCode: problem.code,
          start: problem.start,
          end: problem.end,
        }))
      }
    }
  }
  return Object.freeze(checker.issues)
}
