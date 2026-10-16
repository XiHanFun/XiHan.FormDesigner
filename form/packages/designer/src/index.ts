/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 导出 @xihan-form/designer 的公共接口。

export { decodeFormClipboard, encodeFormClipboard, readFormClipboard, writeFormClipboard } from './clipboard'
export { createFormEditor } from './editor'
export type { FormClipboard, FormDropTarget, FormEditor, FormEditorChange, FormEditorOptions, FormRuleInit, FormSelection, FormSelectMode } from './editor'
export { defineFormDesigner, FORM_DESIGNER_TAG, XhFormDesigner } from './form-designer'
export type { FormDesignerEventMap, FormDesignerMode, FormDesignerPanel, FormPreviewWidth, FormSchemaChangeKind } from './form-designer'
