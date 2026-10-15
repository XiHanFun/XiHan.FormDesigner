/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 运行时状态引擎的错误：只有错误码与定位数据，不带文案。

import type { FormIssue } from '@xihan-form/core'

/**
 * 运行时错误码：
 * - `XH_FORM_RT_INVALID_DOCUMENT`：文档没通过 schema 自校验，问题列表在 `issues`。
 * - `XH_FORM_RT_NO_ENGINE`：文档里有表达式，却没有提供表达式引擎。
 * - `XH_FORM_RT_UNKNOWN_NODE` / `XH_FORM_RT_UNKNOWN_PATH`：节点 id 或数据路径找不到。
 * - `XH_FORM_RT_INVALID_VALUE`：值的形状与字段不符。
 * - `XH_FORM_RT_NOT_A_LIST`：路径指向的不是列表容器。
 * - `XH_FORM_RT_INDEX_OUT_OF_RANGE`：行号越界。
 * - `XH_FORM_RT_NO_OPTIONS`：目标不是选项类字段。
 * - `XH_FORM_RT_NO_OPTION_LOADER`：字段有选项来源，却没有提供选项加载函数。
 * - `XH_FORM_RT_DISPOSED`：控制器已经销毁。
 */
export type FormRuntimeErrorCode
  = | 'XH_FORM_RT_INVALID_DOCUMENT'
    | 'XH_FORM_RT_NO_ENGINE'
    | 'XH_FORM_RT_UNKNOWN_NODE'
    | 'XH_FORM_RT_UNKNOWN_PATH'
    | 'XH_FORM_RT_INVALID_VALUE'
    | 'XH_FORM_RT_NOT_A_LIST'
    | 'XH_FORM_RT_INDEX_OUT_OF_RANGE'
    | 'XH_FORM_RT_NO_OPTIONS'
    | 'XH_FORM_RT_NO_OPTION_LOADER'
    | 'XH_FORM_RT_DISPOSED'

/** 运行时错误；`message` 就是错误码。 */
export class FormRuntimeError extends Error {
  readonly code: FormRuntimeErrorCode
  readonly data: Readonly<Record<string, string | number>>
  readonly issues: readonly FormIssue[]

  constructor(code: FormRuntimeErrorCode, data: Record<string, string | number> = {}, issues: readonly FormIssue[] = []) {
    super(code)
    this.name = 'FormRuntimeError'
    this.code = code
    this.data = Object.freeze({ ...data })
    this.issues = Object.freeze([...issues])
  }
}

/** 把数据路径写成便于定位的文本，如 `lines[1].price`。 */
export function pathText(path: readonly (string | number)[]): string {
  return path.map((segment, index) => (typeof segment === 'number' ? `[${segment}]` : index === 0 ? segment : `.${segment}`)).join('')
}
