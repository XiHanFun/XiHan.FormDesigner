/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 值校验问题的展示文案：规则自带的 message 优先，否则按问题码取文案。

import type { ValueIssue } from '@xihan-form/core'
import type { FormRendererTranslations } from '../translations'

function numberOf(data: ValueIssue['data'], key: string): number {
  const value = data?.[key]
  return typeof value === 'number' ? value : Number(value)
}

/** 一条值校验问题的文案。 */
export function issueMessage(issue: ValueIssue, t: FormRendererTranslations): string {
  if (issue.message !== undefined && issue.message !== '')
    return issue.message
  switch (issue.code) {
    case 'XH_FORM_VALUE_REQUIRED':
      return t.valueRequired
    case 'XH_FORM_VALUE_NOT_ACCEPTED':
      return t.valueNotAccepted
    case 'XH_FORM_VALUE_TOO_SHORT':
      return t.valueTooShort(numberOf(issue.data, 'min'))
    case 'XH_FORM_VALUE_TOO_LONG':
      return t.valueTooLong(numberOf(issue.data, 'max'))
    case 'XH_FORM_VALUE_TOO_SMALL':
      return t.valueTooSmall(numberOf(issue.data, 'min'))
    case 'XH_FORM_VALUE_TOO_LARGE':
      return t.valueTooLarge(numberOf(issue.data, 'max'))
    case 'XH_FORM_VALUE_PATTERN_MISMATCH':
      return t.valuePatternMismatch
    case 'XH_FORM_VALUE_EXPRESSION_FALSE':
      return t.valueExpressionFalse
    case 'XH_FORM_VALUE_TYPE_MISMATCH':
      return t.valueTypeMismatch
    case 'XH_FORM_INVALID_PATTERN':
      return t.invalidPattern
    case 'XH_FORM_EXPRESSION_FAILED':
      return t.expressionFailed
    case 'XH_FORM_CONDITION_NOT_BOOLEAN':
      return t.conditionNotBoolean
  }
}
