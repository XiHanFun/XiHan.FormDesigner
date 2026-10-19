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
import { DesignerExtensionError, extensionCommands, extensionEditors } from '@xihan-ui/designer-kit'
import { collectSettingsSections, DESIGNER_FRAME_REGIONS, designerPanelCommands } from '@xihan-ui/designer-shell'
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

/**
 * 命令表并上扩展面板的开关命令 panel:<区名>。扩展面板与外框的内置区或别的扩展面板重名时抛面板冲突，
 * 扩展自己登记了同名命令时抛命令冲突，都是 DesignerExtensionError。
 */
function withPanelCommands(commands: DesignerCommandTable<FormDesignerContext>, extensions: readonly FormDesignerExtension[]): DesignerCommandTable<FormDesignerContext> {
  const owners = new Map<string, string>(DESIGNER_FRAME_REGIONS.map(region => [region.name, 'builtin']))
  const panels: string[] = []
  for (const extension of extensions) {
    for (const { region } of extension.panels ?? []) {
      const previous = owners.get(region.name)
      if (previous !== undefined)
        throw new DesignerExtensionError('panel', region.name, [previous, extension.id])
      owners.set(region.name, extension.id)
      panels.push(region.name)
    }
  }
  if (panels.length === 0)
    return commands
  const table = new Map(commands)
  for (const command of designerPanelCommands<FormDesignerContext>({ panels, frame: context => context.frame })) {
    if (table.has(command.id)) {
      const owner = extensions.find(extension => extension.commands?.some(item => item.id === command.id))?.id ?? FORM_DESIGNER_EXTENSION.id
      throw new DesignerExtensionError('command', command.id, [FORM_DESIGNER_EXTENSION.id, owner])
    }
    table.set(command.id, command)
  }
  return table
}

/** 合出设计器用的模型；任何一处重名（设置分区与 general 重名、扩展面板与外框的区重名、扩展面板的开关命令与已有命令重名也算）都抛 DesignerExtensionError。 */
export function createFormDesignerModel(extensions: readonly FormDesignerExtension[]): FormDesignerModel {
  const runtime = createFormRuntimeModel([FORM_DESIGNER_EXTENSION, ...extensions])
  const all = runtime.extensions as readonly FormDesignerExtension[]
  return Object.freeze({ extensions: all, runtime, commands: withPanelCommands(extensionCommands(all), all), editors: extensionEditors<FormPropertyEditor>(undefined, all), settings: collectSettingsSections(all) })
}
