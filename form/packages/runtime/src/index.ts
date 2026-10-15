/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 导出 @xihan-form/runtime 的公共接口。

export { createFormController } from './state/controller'
export type { AddRowOptions, FormController, FormControllerOptions, FormEvent, FormEventType, FormTarget, GetFormDataOptions, LinkageIssue, SetFormDataOptions, ValidationOutcome } from './state/controller'
export { FormRuntimeError } from './state/errors'
export type { FormRuntimeErrorCode } from './state/errors'
export type { OptionItem, OptionLoader, OptionRequest, OptionsState } from './state/options'
