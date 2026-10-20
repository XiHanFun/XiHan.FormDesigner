/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 新手引导里表单自己的几步：排在 designer-shell 的通用步骤后面，讲页面结构、校验与联动两页和预览。
// 目标面板隐藏、工具栏没有那条命令时那一步由引导零件跳过；只读时不讲编辑用的两步。菜单栏显示着时预览一步多一句「视图」菜单。

import type { DesignerTourStep } from '@xihan-ui/designer-shell'
import type { FormDesignerContext } from './commands'
import { menubarVisibleOf } from '@xihan-ui/designer-shell'

/** 能编辑时才走的步骤。 */
const editable = ({ designer }: FormDesignerContext): boolean => designer.readonly !== true

/** 表单的引导步骤，内置扩展登记；id 写 form. 开头，order 从 100 起。 */
export const FORM_TOUR_STEPS: readonly DesignerTourStep<FormDesignerContext>[] = Object.freeze([
  {
    id: 'form.outline',
    target: { panel: 'outline' },
    order: 100,
    title: ({ translations }) => translations.tour.outlineTitle,
    description: ({ translations }) => translations.tour.outlineDescription,
  },
  {
    id: 'form.rules',
    target: { panel: 'properties', part: 'inspector-tabs' },
    order: 110,
    title: ({ translations }) => translations.tour.rulesTitle,
    description: ({ translations }) => translations.tour.rulesDescription,
    when: editable,
  },
  {
    id: 'form.preview',
    target: { command: 'preview' },
    order: 120,
    title: ({ translations }) => translations.tour.previewTitle,
    description: ({ translations, settings }) => (menubarVisibleOf(settings) ? translations.tour.previewMenubarDescription : translations.tour.previewDescription),
  },
] satisfies DesignerTourStep<FormDesignerContext>[])
