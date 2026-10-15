/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单问题：schema 自校验与值校验共用，只有问题码与定位，不带文案。

/**
 * schema 自校验的问题码：
 * - `XH_FORM_INVALID_DOCUMENT`：文档不是对象，或缺 `settings` / `children`。
 * - `XH_FORM_SCHEMA_VERSION`：结构版本不受支持。
 * - `XH_FORM_INVALID_NODE`：节点缺字段或字段类型不对。
 * - `XH_FORM_UNKNOWN_NODE_FIELD`：节点、区域或规则上有未定义的字段。
 * - `XH_FORM_DUPLICATE_ID`：节点、区域、规则的 id 重复。
 * - `XH_FORM_UNKNOWN_KIND` / `XH_FORM_KIND_TYPE_MISMATCH`：种类没有登记 / 登记的类型与节点类型不符。
 * - `XH_FORM_UNKNOWN_PROPERTY` / `XH_FORM_INVALID_PROPERTY`：属性没有描述 / 取值不符合描述。
 * - `XH_FORM_INVALID_INITIAL_VALUE`：初始值与字段的值形状不符。
 * - `XH_FORM_INVALID_KEY` / `XH_FORM_MISSING_KEY` / `XH_FORM_UNEXPECTED_KEY` / `XH_FORM_DUPLICATE_KEY`：数据键。
 * - `XH_FORM_INVALID_REGION` / `XH_FORM_REGION_COUNT` / `XH_FORM_CHILD_NOT_ALLOWED`：区域。
 * - `XH_FORM_TABLE_CELL_OUT_OF_BOUNDS` / `XH_FORM_TABLE_CELL_OVERLAP` / `XH_FORM_TABLE_CELL_GAP`：表格布局。
 * - `XH_FORM_INVALID_RULE` / `XH_FORM_RULE_NOT_APPLICABLE` / `XH_FORM_ACTION_NOT_APPLICABLE`：规则结构与适用性。
 * - `XH_FORM_INVALID_RANGE` / `XH_FORM_INVALID_PATTERN` / `XH_FORM_EMPTY_EXPRESSION` / `XH_FORM_EXPRESSION_ERROR`：规则取值。
 * - `XH_FORM_TOO_DEEP`：嵌套层数超过上限。
 *
 * 值校验与联动的问题码：
 * - `XH_FORM_VALUE_REQUIRED`、`XH_FORM_VALUE_TOO_SHORT`、`XH_FORM_VALUE_TOO_LONG`、`XH_FORM_VALUE_TOO_SMALL`、
 *   `XH_FORM_VALUE_TOO_LARGE`、`XH_FORM_VALUE_PATTERN_MISMATCH`、`XH_FORM_VALUE_EXPRESSION_FALSE`：值不满足规则。
 * - `XH_FORM_VALUE_TYPE_MISMATCH`：值的形状与字段不符，规则无法判定。
 * - `XH_FORM_EXPRESSION_FAILED`：求值失败；`XH_FORM_CONDITION_NOT_BOOLEAN`：条件结果不是布尔或 null。
 */
export type FormIssueCode
  = | 'XH_FORM_INVALID_DOCUMENT'
    | 'XH_FORM_SCHEMA_VERSION'
    | 'XH_FORM_INVALID_NODE'
    | 'XH_FORM_UNKNOWN_NODE_FIELD'
    | 'XH_FORM_DUPLICATE_ID'
    | 'XH_FORM_UNKNOWN_KIND'
    | 'XH_FORM_KIND_TYPE_MISMATCH'
    | 'XH_FORM_UNKNOWN_PROPERTY'
    | 'XH_FORM_INVALID_PROPERTY'
    | 'XH_FORM_INVALID_INITIAL_VALUE'
    | 'XH_FORM_INVALID_KEY'
    | 'XH_FORM_MISSING_KEY'
    | 'XH_FORM_UNEXPECTED_KEY'
    | 'XH_FORM_DUPLICATE_KEY'
    | 'XH_FORM_INVALID_REGION'
    | 'XH_FORM_REGION_COUNT'
    | 'XH_FORM_CHILD_NOT_ALLOWED'
    | 'XH_FORM_TABLE_CELL_OUT_OF_BOUNDS'
    | 'XH_FORM_TABLE_CELL_OVERLAP'
    | 'XH_FORM_TABLE_CELL_GAP'
    | 'XH_FORM_INVALID_RULE'
    | 'XH_FORM_RULE_NOT_APPLICABLE'
    | 'XH_FORM_ACTION_NOT_APPLICABLE'
    | 'XH_FORM_INVALID_RANGE'
    | 'XH_FORM_INVALID_PATTERN'
    | 'XH_FORM_EMPTY_EXPRESSION'
    | 'XH_FORM_EXPRESSION_ERROR'
    | 'XH_FORM_TOO_DEEP'
    | 'XH_FORM_VALUE_REQUIRED'
    | 'XH_FORM_VALUE_TOO_SHORT'
    | 'XH_FORM_VALUE_TOO_LONG'
    | 'XH_FORM_VALUE_TOO_SMALL'
    | 'XH_FORM_VALUE_TOO_LARGE'
    | 'XH_FORM_VALUE_PATTERN_MISMATCH'
    | 'XH_FORM_VALUE_EXPRESSION_FALSE'
    | 'XH_FORM_VALUE_TYPE_MISMATCH'
    | 'XH_FORM_EXPRESSION_FAILED'
    | 'XH_FORM_CONDITION_NOT_BOOLEAN'

/** 问题附带的定位数据：名字、数量、区间，不放文案。 */
export type FormIssueData = Readonly<Record<string, string | number>>

/** 一条表单问题。 */
export interface FormIssue {
  readonly code: FormIssueCode
  readonly nodeId?: string
  readonly regionId?: string
  readonly ruleId?: string
  readonly data?: FormIssueData
}

/** 构造一条冻结的问题，省略取值为 `undefined` 的定位字段。 */
export function formIssue(code: FormIssueCode, at: { nodeId?: string, regionId?: string, ruleId?: string } = {}, data?: Record<string, string | number>): FormIssue {
  const issue: { -readonly [K in keyof FormIssue]: FormIssue[K] } = { code }
  if (at.nodeId !== undefined)
    issue.nodeId = at.nodeId
  if (at.regionId !== undefined)
    issue.regionId = at.regionId
  if (at.ruleId !== undefined)
    issue.ruleId = at.ruleId
  if (data !== undefined)
    issue.data = Object.freeze({ ...data })
  return Object.freeze(issue)
}
