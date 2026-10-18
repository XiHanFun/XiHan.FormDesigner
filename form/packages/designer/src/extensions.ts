/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器层的扩展：在运行时层之上加属性编辑器、命令、面板、导入导出与装上时的回调；内置命令也写成一个扩展。

import type { FormDocument, FormRuleContext } from '@xihan-form/core'
import type { FormRuntimeExtension, FormRuntimeModel } from '@xihan-form/runtime'
import type { PropertyEditorTable } from '@xihan-ui/designer-kit/properties'
import type { DesignerCommandTable, DesignerSettingsSection, DesignerShellExtension } from '@xihan-ui/designer-shell'
import type { FormDesignerContext } from './commands'
import type { FormPropertyEditor } from './properties'
import { createFormRuntimeModel } from '@xihan-form/runtime'
import { extensionCommands, extensionEditors } from '@xihan-ui/designer-kit'
import { collectSettingsSections } from '@xihan-ui/designer-shell'
import { FORM_COMMANDS } from './commands'

/** 表单设计器层的扩展：运行时层的全部字段，加上属性编辑器、命令、面板、导入导出与 setup。 */
export interface FormDesignerExtension extends FormRuntimeExtension, DesignerShellExtension<FormDesignerContext, FormPropertyEditor, FormDocument, FormRuleContext> {}

/** 设计器的内置扩展：内置命令。种类、渲染等内置部分在 core 与运行时的内置扩展里。 */
export const FORM_DESIGNER_EXTENSION: FormDesignerExtension = Object.freeze({
  id: '@xihan-form/designer',
  commands: FORM_COMMANDS,
})

/** 一组设计器扩展合出的东西：运行时模型、命令表、属性编辑器表与设置分区。 */
export interface FormDesignerModel {
  /** 全部扩展：core、运行时与设计器的内置扩展在前，传入的在后；面板与命令按它的顺序。 */
  readonly extensions: readonly FormDesignerExtension[]
  readonly runtime: FormRuntimeModel
  readonly commands: DesignerCommandTable<FormDesignerContext>
  readonly editors: PropertyEditorTable<FormPropertyEditor>
  /** 扩展登记的设置分区，按扩展顺序。 */
  readonly settings: readonly DesignerSettingsSection[]
}

/** 合出设计器用的模型；任何一处重名（设置分区与 general 重名也算）都抛 DesignerExtensionError。 */
export function createFormDesignerModel(extensions: readonly FormDesignerExtension[]): FormDesignerModel {
  const runtime = createFormRuntimeModel([FORM_DESIGNER_EXTENSION, ...extensions])
  const all = runtime.extensions as readonly FormDesignerExtension[]
  return Object.freeze({ extensions: all, runtime, commands: extensionCommands(all), editors: extensionEditors<FormPropertyEditor>(undefined, all), settings: collectSettingsSections(all) })
}
