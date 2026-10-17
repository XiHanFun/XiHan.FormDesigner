/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单产品各元素的文案键：渲染器的文案类型与缺省英文文案，并补进 UI 的 XhTranslationOverrides。

/** 渲染器的文案：无参的是字符串，带参的是函数。 */
export interface FormRendererTranslations {
  /** 错误摘要的标题。 */
  readonly errorSummary: (count: number) => string
  /** 错误摘要里的一条：字段标签与问题文案。 */
  readonly errorSummaryItem: (label: string, message: string) => string
  /** 没有选项。 */
  readonly optionsEmpty: string
  /** 列表容器的新增把手。 */
  readonly addRow: string
  /** 文件字段投放区的说明。 */
  readonly fileDropzone: string
  /** 文件字段打开选择框的按钮。 */
  readonly fileTrigger: string
  /** 值校验问题的文案，按问题码取：`XH_FORM_VALUE_REQUIRED`。规则写了 message 时用规则的。 */
  readonly valueRequired: string
  /** `XH_FORM_VALUE_NOT_ACCEPTED`。 */
  readonly valueNotAccepted: string
  /** `XH_FORM_VALUE_TOO_SHORT`，参数是长度下限。 */
  readonly valueTooShort: (min: number) => string
  /** `XH_FORM_VALUE_TOO_LONG`，参数是长度上限。 */
  readonly valueTooLong: (max: number) => string
  /** `XH_FORM_VALUE_TOO_SMALL`，参数是下限。 */
  readonly valueTooSmall: (min: number) => string
  /** `XH_FORM_VALUE_TOO_LARGE`，参数是上限。 */
  readonly valueTooLarge: (max: number) => string
  /** `XH_FORM_VALUE_PATTERN_MISMATCH`。 */
  readonly valuePatternMismatch: string
  /** `XH_FORM_VALUE_EXPRESSION_FALSE`。 */
  readonly valueExpressionFalse: string
  /** `XH_FORM_VALUE_TYPE_MISMATCH`。 */
  readonly valueTypeMismatch: string
  /** `XH_FORM_INVALID_PATTERN`。 */
  readonly invalidPattern: string
  /** `XH_FORM_EXPRESSION_FAILED`。 */
  readonly expressionFailed: string
  /** `XH_FORM_CONDITION_NOT_BOOLEAN`。 */
  readonly conditionNotBoolean: string
}

/** 渲染器的缺省文案。 */
export const DEFAULT_FORM_RENDERER_TRANSLATIONS: FormRendererTranslations = Object.freeze({
  errorSummary: (count: number) => (count === 1 ? '1 field needs attention' : `${count} fields need attention`),
  errorSummaryItem: (label: string, message: string) => `${label}: ${message}`,
  optionsEmpty: 'No options',
  addRow: 'Add row',
  fileDropzone: 'Drop files here or click to choose',
  fileTrigger: 'Choose files',
  valueRequired: 'This field is required',
  valueNotAccepted: 'This must be checked',
  valueTooShort: (min: number) => `Enter at least ${min} characters`,
  valueTooLong: (max: number) => `Enter at most ${max} characters`,
  valueTooSmall: (min: number) => `Must be at least ${min}`,
  valueTooLarge: (max: number) => `Must be at most ${max}`,
  valuePatternMismatch: 'The format is not valid',
  valueExpressionFalse: 'The value is not valid',
  valueTypeMismatch: 'The value has the wrong type',
  invalidPattern: 'The validation pattern is not valid',
  expressionFailed: 'The validation expression failed',
  conditionNotBoolean: 'The validation expression did not return true or false',
})

declare module '@xihan-ui/web-components' {
  interface XhTranslationOverrides {
    'xh-form-renderer'?: Partial<FormRendererTranslations>
  }
}
