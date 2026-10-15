/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 联动求值：按文档顺序逐个节点实例求出显隐、禁用、必填，并执行赋值。

import type { ExpressionEngine, ExpressionOutcome } from './expression'
import type { FormIssue } from './issues'
import type { JsonValue } from './json'
import type { FormDocument, FormNode, LinkageRule } from './schema'
import { RUNTIME_VARIABLES } from './expression'
import { formIssue } from './issues'
import { isJsonValue, isPlainObject } from './json'

/** 节点实例的状态：已经叠加了祖先容器的隐藏与禁用。 */
export interface NodeState {
  readonly hidden: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
}

/** 一次赋值：字段的实例路径与赋进去的值。 */
export interface Assignment {
  readonly nodeId: string
  readonly path: readonly (string | number)[]
  readonly value: JsonValue
}

/** 联动求值的结果。 */
export interface LinkageResult {
  /** 各节点实例的状态，键由 `instanceKey` 生成。 */
  readonly states: ReadonlyMap<string, NodeState>
  /** 执行赋值之后的表单值；输入不会被修改。 */
  readonly values: Record<string, JsonValue>
  readonly assignments: readonly Assignment[]
  readonly issues: readonly FormIssue[]
}

/** 联动求值的选项。 */
export interface ResolveLinkageOptions {
  readonly engine: ExpressionEngine
  /** 宿主提供给表达式的额外变量，名字建议以 `$` 开头，避免与数据键冲突。 */
  readonly variables?: Readonly<Record<string, unknown>>
}

/** 节点实例的键：顶层节点是它的 id，列表里的节点在 id 后接 `#` 与逐层行号。 */
export function instanceKey(nodeId: string, rowPath: readonly number[] = []): string {
  return rowPath.length === 0 ? nodeId : `${nodeId}#${rowPath.join('.')}`
}

interface Frame {
  readonly scope: Record<string, JsonValue>
  readonly path: readonly (string | number)[]
  readonly rowPath: readonly number[]
  readonly row: Record<string, JsonValue> | null
  readonly hidden: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

function cloneJson(value: JsonValue): JsonValue {
  if (value === null || typeof value !== 'object')
    return value
  if (Array.isArray(value))
    return value.map(cloneJson)
  const out: Record<string, JsonValue> = {}
  for (const [key, item] of Object.entries(value))
    out[key] = cloneJson(item)
  return out
}

/** 条件结果：`true` 成立，`false` 与 `null` 不成立，其余为问题。 */
export function conditionOf(outcome: ExpressionOutcome): boolean | 'not-boolean' | 'failed' {
  if (!outcome.ok)
    return 'failed'
  if (outcome.value === true)
    return true
  if (outcome.value === false || outcome.value === null)
    return false
  return 'not-boolean'
}

class LinkageResolver {
  readonly states = new Map<string, NodeState>()
  readonly assignments: Assignment[] = []
  readonly issues: FormIssue[] = []
  readonly values: Record<string, JsonValue>
  private readonly engine: ExpressionEngine
  private readonly variables: Readonly<Record<string, unknown>>

  constructor(values: Record<string, JsonValue>, options: ResolveLinkageOptions) {
    this.values = cloneJson(values) as Record<string, JsonValue>
    this.engine = options.engine
    this.variables = options.variables ?? {}
  }

  private scopeFor(frame: Frame, node: FormNode): Record<string, unknown> {
    const scope: Record<string, unknown> = { ...this.values, ...this.variables }
    if (node.type !== 'static' && 'key' in node && typeof node.key === 'string')
      scope[RUNTIME_VARIABLES.value] = frame.scope[node.key] ?? null
    if (frame.row !== null) {
      scope[RUNTIME_VARIABLES.row] = frame.row
      scope[RUNTIME_VARIABLES.index] = frame.rowPath[frame.rowPath.length - 1]
    }
    return scope
  }

  private failed(outcome: ExpressionOutcome, node: FormNode, rule: LinkageRule, part: 'when' | 'value', rowPath: readonly number[]): void {
    const data: Record<string, string | number> = { part, instance: instanceKey(node.id, rowPath) }
    if (!outcome.ok) {
      data.expressionCode = outcome.problem.code
      data.start = outcome.problem.start
      data.end = outcome.problem.end
    }
    this.issues.push(formIssue(outcome.ok ? 'XH_FORM_CONDITION_NOT_BOOLEAN' : 'XH_FORM_EXPRESSION_FAILED', { nodeId: node.id, ruleId: rule.id }, data))
  }

  private applyRules(node: FormNode, frame: Frame, state: { hidden: boolean, disabled: boolean, required: boolean }): void {
    for (const rule of node.linkage) {
      if (rule.when !== undefined) {
        const outcome = this.engine.evaluate(rule.when, this.scopeFor(frame, node))
        const met = conditionOf(outcome)
        if (met !== true) {
          if (met !== false)
            this.failed(outcome, node, rule, 'when', frame.rowPath)
          continue
        }
      }
      switch (rule.action) {
        case 'show':
          state.hidden = false
          break
        case 'hide':
          state.hidden = true
          break
        case 'enable':
          state.disabled = false
          break
        case 'disable':
          state.disabled = true
          break
        case 'require':
          state.required = true
          break
        case 'optional':
          state.required = false
          break
        case 'assign':
          this.assign(node, rule, frame)
          break
      }
    }
  }

  private assign(node: FormNode, rule: LinkageRule, frame: Frame): void {
    if (node.type !== 'field' || rule.value === undefined)
      return
    const outcome = this.engine.evaluate(rule.value, this.scopeFor(frame, node))
    if (!outcome.ok) {
      this.failed(outcome, node, rule, 'value', frame.rowPath)
      return
    }
    const value = outcome.value === undefined ? null : outcome.value
    if (!isJsonValue(value)) {
      this.issues.push(formIssue('XH_FORM_VALUE_TYPE_MISMATCH', { nodeId: node.id, ruleId: rule.id }, { instance: instanceKey(node.id, frame.rowPath) }))
      return
    }
    const copy = cloneJson(value)
    frame.scope[node.key] = copy
    this.assignments.push({ nodeId: node.id, path: [...frame.path, node.key], value: copy })
  }

  visit(children: readonly FormNode[], frame: Frame): void {
    for (const node of children) {
      const state = {
        hidden: node.basic.hidden === true,
        disabled: node.basic.disabled === true,
        required: node.type !== 'static' && node.validation.some(rule => rule.kind === 'required'),
      }
      this.applyRules(node, frame, state)
      const effective: NodeState = {
        hidden: state.hidden || frame.hidden,
        disabled: state.disabled || frame.disabled,
        readOnly: node.basic.readOnly === true || frame.readOnly,
        required: state.required,
      }
      this.states.set(instanceKey(node.id, frame.rowPath), effective)
      if (node.type !== 'container')
        continue
      const inherited = { hidden: effective.hidden, disabled: effective.disabled, readOnly: effective.readOnly }
      if (typeof node.key === 'string') {
        const rows = frame.scope[node.key]
        if (!Array.isArray(rows))
          continue
        rows.forEach((row, index) => {
          if (!isPlainObject(row))
            return
          const rowFrame: Frame = {
            ...inherited,
            scope: row as Record<string, JsonValue>,
            path: [...frame.path, node.key as string, index],
            rowPath: [...frame.rowPath, index],
            row: row as Record<string, JsonValue>,
          }
          for (const region of node.regions)
            this.visit(region.children, rowFrame)
        })
      }
      else {
        for (const region of node.regions)
          this.visit(region.children, { ...frame, ...inherited })
      }
    }
  }
}

/**
 * 按文档顺序求联动：每个节点实例从静态设定（`basic.hidden` / `disabled` / `readOnly`、有没有必填规则）出发，
 * 依次执行条件成立的规则，排在后面的覆盖前面的；赋值立即写进工作副本，后面的表达式读到的是新值。
 * 表单设置的 `disabled` / `readOnly` 与祖先容器的隐藏、禁用向下叠加。
 */
export function resolveLinkage(document: FormDocument, values: Readonly<Record<string, JsonValue>>, options: ResolveLinkageOptions): LinkageResult {
  const resolver = new LinkageResolver(values as Record<string, JsonValue>, options)
  resolver.visit(document.children, {
    scope: resolver.values,
    path: [],
    rowPath: [],
    row: null,
    hidden: false,
    disabled: document.settings.disabled === true,
    readOnly: document.settings.readOnly === true,
  })
  return {
    states: resolver.states,
    values: resolver.values,
    assignments: Object.freeze(resolver.assignments),
    issues: Object.freeze(resolver.issues),
  }
}
