/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 导出 @xihan-form/designer 的公共接口。

export { checkFormClipboard, decodeFormClipboard, encodeFormClipboard, readFormClipboard, writeFormClipboard } from './clipboard'
export { FORM_COMMANDS, FORM_DESIGNER_HELP_URL, FORM_DESIGNER_PANELS, FORM_MENU_LAYOUTS, FORM_TOOLBAR_LAYOUT } from './commands'
export type { FormDesignerCommand, FormDesignerContext, FormMenuSubject } from './commands'
export { createFormEditor } from './editor'
export type { FormClipboard, FormDropTarget, FormEditor, FormEditorChange, FormEditorOptions, FormRuleInit, FormSelection, FormSelectMode } from './editor'
export { createFormDesignerModel, FORM_DESIGNER_EXTENSION } from './extensions'
export type { FormDesignerExtension, FormDesignerModel } from './extensions'
export { defineFormDesigner, FORM_DESIGNER_TAG, XhFormDesigner } from './form-designer'
export type { FormDesignerEventMap, FormDesignerMode, FormPreviewWidth, FormSchemaChangeKind } from './form-designer'
export type { FormCanvasDragPayload, FormDragSubject, FormFragmentDragPayload, FormPalettePayload } from './palette'
export type { FormPropertyEditor } from './properties'
