/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单问题，只有问题码与定位，不带文案：模板结构问题取 designer-kit/schema 的 SchemaIssue，值校验与联动的问题沿用 FormIssue。

import type { CommonIssueCode, SchemaIssue } from '@xihan-ui/designer-kit/schema'

/**
 * 模板结构问题里表单专属的问题码（通用问题码见 designer-kit/schema 的 CommonIssueCode）：
 * - `document.unsupportedVersion`：结构版本不受支持；`document.tooDeep`：嵌套层数超过上限。
 * - `node.unknownKind` / `node.kindTypeMismatch`：种类没有登记 / 登记的类型与节点类型不符。
 * - `region.childNotAllowed`：区域不收这种节点（如子表只收字段）。
 * - `table.cellOutOfBounds` / `table.cellOverlap` / `table.cellGap`：表格布局的单元格越界、重叠、留空。
 * - `rule.notApplicable`：校验规则不适用于字段的种类或值形状；`rule.boundsMissing`：长度或范围规则上下限都没给；
 *   `rule.invalidRange`：下限大于上限；`rule.invalidPattern`：正则编译不过，参数 reason 给出原因。
 * - `linkage.actionNotApplicable`：联动动作不适用于节点类型。
 * - `expression.invalid`：表达式引擎报出问题，参数带上引擎的问题码与源码区间。
 * - `field.dependencyWithoutSource`：声明了选项依赖却没有选项来源；`field.unknownDependency`：依赖的键在所在作用域及其外层都找不到；
 *   `field.selfDependency`：依赖指向字段自己。
 */
export type FormSchemaProductCode
  = | 'document.unsupportedVersion'
    | 'document.tooDeep'
    | 'node.unknownKind'
    | 'node.kindTypeMismatch'
    | 'region.childNotAllowed'
    | 'table.cellOutOfBounds'
    | 'table.cellOverlap'
    | 'table.cellGap'
    | 'rule.notApplicable'
    | 'rule.boundsMissing'
    | 'rule.invalidRange'
    | 'rule.invalidPattern'
    | 'linkage.actionNotApplicable'
    | 'expression.invalid'
    | 'field.dependencyWithoutSource'
    | 'field.unknownDependency'
    | 'field.selfDependency'

/** 模板结构问题的问题码：通用问题码加表单专属问题码。 */
export type FormSchemaIssueCode = CommonIssueCode | FormSchemaProductCode

/** 一条模板结构问题：路径从文档根算起，节点、区域、规则用 target 标出（kind 为 node、region、rule）。 */
export type FormSchemaIssue = SchemaIssue<FormSchemaIssueCode>

/**
 * 值校验与联动的问题码：
 * - `XH_FORM_VALUE_REQUIRED`、`XH_FORM_VALUE_NOT_ACCEPTED`、`XH_FORM_VALUE_TOO_SHORT`、`XH_FORM_VALUE_TOO_LONG`、
 *   `XH_FORM_VALUE_TOO_SMALL`、`XH_FORM_VALUE_TOO_LARGE`、`XH_FORM_VALUE_PATTERN_MISMATCH`、`XH_FORM_VALUE_EXPRESSION_FALSE`：值不满足规则。
 * - `XH_FORM_VALUE_TYPE_MISMATCH`：值的形状与字段不符，规则无法判定。
 * - `XH_FORM_INVALID_PATTERN`：校验时正则编译不过。
 * - `XH_FORM_EXPRESSION_FAILED`：求值失败；`XH_FORM_CONDITION_NOT_BOOLEAN`：条件结果不是布尔或 null。
 */
export type FormIssueCode
  = | 'XH_FORM_INVALID_PATTERN'
    | 'XH_FORM_VALUE_REQUIRED'
    | 'XH_FORM_VALUE_NOT_ACCEPTED'
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

/** 一条值校验或联动问题。 */
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
