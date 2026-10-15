/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 值校验：按声明式规则逐个字段实例核对表单值，隐藏或禁用的实例不校验。

import type { EngineCompileResult, ExpressionEngine } from '@xihan-ui/expression'
import type { FormIssue, FormIssueCode } from './issues'
import type { JsonValue } from './json'
import type { NodeState } from './linkage'
import type { ContainerNode, FieldNode, FormDocument, FormNode, ValidationRule } from './schema'
import { evaluateSource, RUNTIME_VARIABLES } from './expression'
import { formIssue } from './issues'
import { isPlainObject } from './json'
import { conditionOf, instanceKey } from './linkage'

/** 值校验的问题：在表单问题之上带着实例路径与规则里作者写的提示。 */
export interface ValueIssue extends FormIssue {
  readonly path: readonly (string | number)[]
  readonly message?: string
}

/** 值校验的选项。 */
export interface ValidateValuesOptions {
  /** 表达式引擎；有表达式规则时必须提供。 */
  readonly engine?: ExpressionEngine
  /** 联动求出的节点状态；缺省时按静态设定：`basic.hidden` / `disabled` 与有没有必填规则。 */
  readonly states?: ReadonlyMap<string, NodeState>
  /** 宿主提供给表达式的额外变量。 */
  readonly variables?: Readonly<Record<string, unknown>>
}

/**
 * 值是否为空：`null`、`undefined`、只含空白的字符串、`false`、空列表，
 * 以及元素全都为空的列表（如两端都没选的区间）。
 */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === false)
    return true
  if (typeof value === 'string')
    return value.trim() === ''
  if (Array.isArray(value))
    return value.every(isEmptyValue)
  return false
}

function lengthOf(value: unknown): number | null {
  if (typeof value === 'string')
    return [...value].length
  return Array.isArray(value) ? value.length : null
}

interface Frame {
  readonly scope: Readonly<Record<string, JsonValue>>
  readonly path: readonly (string | number)[]
  readonly rowPath: readonly number[]
  readonly row: Readonly<Record<string, JsonValue>> | null
}

type ValueNode = FieldNode | ContainerNode

class ValueValidator {
  readonly issues: ValueIssue[] = []
  private readonly root: Readonly<Record<string, JsonValue>>
  private readonly options: ValidateValuesOptions
  private readonly patterns = new Map<string, RegExp | null>()
  private readonly compiled = new Map<string, EngineCompileResult>()

  constructor(root: Readonly<Record<string, JsonValue>>, options: ValidateValuesOptions) {
    this.root = root
    this.options = options
  }

  private report(code: FormIssueCode, node: ValueNode, path: readonly (string | number)[], rule?: ValidationRule, data?: Record<string, string | number>): void {
    const base = formIssue(code, rule === undefined ? { nodeId: node.id } : { nodeId: node.id, ruleId: rule.id }, data)
    const issue: ValueIssue = rule?.message === undefined ? { ...base, path } : { ...base, path, message: rule.message }
    this.issues.push(Object.freeze(issue))
  }

  private stateOf(node: FormNode, rowPath: readonly number[]): NodeState {
    const known = this.options.states?.get(instanceKey(node.id, rowPath))
    if (known !== undefined)
      return known
    return {
      hidden: node.basic.hidden === true,
      disabled: node.basic.disabled === true,
      readOnly: node.basic.readOnly === true,
      required: node.type !== 'static' && node.validation.some(rule => rule.kind === 'required'),
    }
  }

  private regex(pattern: string, flags: string | undefined): RegExp | null {
    const cacheKey = `${flags ?? ''}/${pattern}`
    if (!this.patterns.has(cacheKey)) {
      let compiled: RegExp | null
      try {
        compiled = new RegExp(`^(?:${pattern})$`, flags)
      }
      catch {
        compiled = null
      }
      this.patterns.set(cacheKey, compiled)
    }
    return this.patterns.get(cacheKey)!
  }

  private checkRule(node: ValueNode, rule: ValidationRule, value: JsonValue, frame: Frame, path: readonly (string | number)[]): void {
    switch (rule.kind) {
      case 'required':
        return
      case 'length': {
        const length = lengthOf(value)
        if (length === null)
          this.report('XH_FORM_VALUE_TYPE_MISMATCH', node, path, rule)
        else if (rule.min !== undefined && length < rule.min)
          this.report('XH_FORM_VALUE_TOO_SHORT', node, path, rule, { min: rule.min, actual: length })
        else if (rule.max !== undefined && length > rule.max)
          this.report('XH_FORM_VALUE_TOO_LONG', node, path, rule, { max: rule.max, actual: length })
        return
      }
      case 'range':
        if (typeof value !== 'number')
          this.report('XH_FORM_VALUE_TYPE_MISMATCH', node, path, rule)
        else if (rule.min !== undefined && value < rule.min)
          this.report('XH_FORM_VALUE_TOO_SMALL', node, path, rule, { min: rule.min })
        else if (rule.max !== undefined && value > rule.max)
          this.report('XH_FORM_VALUE_TOO_LARGE', node, path, rule, { max: rule.max })
        return
      case 'pattern': {
        const regex = this.regex(rule.pattern, rule.flags)
        if (regex === null)
          this.report('XH_FORM_INVALID_PATTERN', node, path, rule)
        else if (typeof value !== 'string')
          this.report('XH_FORM_VALUE_TYPE_MISMATCH', node, path, rule)
        else if (!regex.test(value))
          this.report('XH_FORM_VALUE_PATTERN_MISMATCH', node, path, rule)
        return
      }
      case 'expression':
        this.checkExpression(node, rule, value, frame, path)
    }
  }

  private checkExpression(node: ValueNode, rule: ValidationRule & { kind: 'expression' }, value: JsonValue, frame: Frame, path: readonly (string | number)[]): void {
    const engine = this.options.engine
    if (engine === undefined)
      throw new TypeError(`规则 ${rule.id} 是表达式规则，校验时必须提供 engine`)
    const scope: Record<string, unknown> = { ...this.root, ...this.options.variables, [RUNTIME_VARIABLES.value]: value }
    if (frame.row !== null) {
      scope[RUNTIME_VARIABLES.row] = frame.row
      scope[RUNTIME_VARIABLES.index] = frame.rowPath[frame.rowPath.length - 1]
    }
    const outcome = evaluateSource(engine, this.compiled, rule.expression, scope)
    const met = conditionOf(outcome)
    if (met === 'failed' && !outcome.ok)
      this.report('XH_FORM_EXPRESSION_FAILED', node, path, rule, { expressionCode: outcome.issue.code, start: outcome.issue.start, end: outcome.issue.end })
    else if (met === 'not-boolean')
      this.report('XH_FORM_CONDITION_NOT_BOOLEAN', node, path, rule)
    else if (outcome.ok && outcome.value === false)
      this.report('XH_FORM_VALUE_EXPRESSION_FALSE', node, path, rule)
  }

  private checkValue(node: ValueNode, state: NodeState, frame: Frame): JsonValue {
    const key = node.key as string
    const value = frame.scope[key] ?? null
    const path = [...frame.path, key]
    if (isEmptyValue(value)) {
      if (state.required) {
        const rule = node.validation.find(item => item.kind === 'required')
        this.report('XH_FORM_VALUE_REQUIRED', node, path, rule)
      }
      return value
    }
    for (const rule of node.validation)
      this.checkRule(node, rule, value, frame, path)
    return value
  }

  visit(children: readonly FormNode[], frame: Frame): void {
    for (const node of children) {
      const state = this.stateOf(node, frame.rowPath)
      if (state.hidden || state.disabled)
        continue
      if (node.type === 'field') {
        this.checkValue(node, state, frame)
        continue
      }
      if (node.type !== 'container')
        continue
      if (typeof node.key !== 'string') {
        for (const region of node.regions)
          this.visit(region.children, frame)
        continue
      }
      const rows = this.checkValue(node, state, frame)
      if (!Array.isArray(rows))
        continue
      rows.forEach((row, index) => {
        if (!isPlainObject(row))
          return
        const rowFrame: Frame = {
          scope: row as Record<string, JsonValue>,
          path: [...frame.path, node.key as string, index],
          rowPath: [...frame.rowPath, index],
          row: row as Record<string, JsonValue>,
        }
        for (const region of node.regions)
          this.visit(region.children, rowFrame)
      })
    }
  }
}

/**
 * 按声明式规则校验表单值，返回全部问题。隐藏或禁用的实例连同其后代都不校验；
 * 值为空时只看必填，其余规则跳过；必填由节点状态决定，联动可以加上或去掉。
 * 正则整串匹配。有表达式规则却没有提供 engine 时抛 `TypeError`。
 */
export function validateValues(document: FormDocument, values: Readonly<Record<string, JsonValue>>, options: ValidateValuesOptions = {}): readonly ValueIssue[] {
  const validator = new ValueValidator(values, options)
  validator.visit(document.children, { scope: values, path: [], rowPath: [], row: null })
  return Object.freeze(validator.issues)
}
