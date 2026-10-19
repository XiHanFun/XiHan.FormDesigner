/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 导出 @xihan-form/runtime 的公共接口。

export { DEFAULT_FORM_DESIGNER_TRANSLATIONS } from './designer-translations'
export type { FormDesignerTranslations, FormHistoryTranslations } from './designer-translations'
export { createFormRuntimeModel, FORM_RUNTIME_EXTENSION } from './extensions'
export type { FormRuntimeExtension, FormRuntimeModel } from './extensions'
export type { ContainerBuilder, ContainerView, StaticBuilder, StaticView } from './renderer/containers'
export { defineFormRenderer, FORM_RENDERER_TAG, XhFormRenderer } from './renderer/element'
export type { FormRendererEventMap, FormSubmitAction, FormValidateOn } from './renderer/element'
export { FORM_FIELD_RENDERERS } from './renderer/fields'
export type { FieldRenderer, FieldRendererContext, FieldRendererInstance, FieldSize, FileUploader, UploadRequest } from './renderer/types'
export { createFormController } from './state/controller'
export type { AddRowOptions, FormController, FormControllerOptions, FormEvent, FormEventType, FormTarget, GetFormDataOptions, LinkageIssue, SetFormDataOptions, ValidationOutcome } from './state/controller'
export { FormRuntimeError } from './state/errors'
export type { FormRuntimeErrorCode } from './state/errors'
export type { OptionItem, OptionLoader, OptionRequest, OptionsState } from './state/options'
export { DEFAULT_FORM_RENDERER_TRANSLATIONS } from './translations'
export type { FormRendererTranslations } from './translations'
