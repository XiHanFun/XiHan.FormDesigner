/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单的英文语言包，与渲染器、设计器不配语言包时的缺省文案相同。

import type { XhConfig } from '@xihan-ui/web-components'
import { designerShellEnUS } from '@xihan-ui/designer-shell/locale'
import { mergeXhConfig } from '@xihan-ui/web-components'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS } from '../designer-translations'
import { DEFAULT_FORM_RENDERER_TRANSLATIONS } from '../translations'

/** 英语：渲染器、设计器与 designer-shell 零件。 */
export const formEnUS: XhConfig = /* @__PURE__ */ mergeXhConfig(designerShellEnUS, {
  translations: {
    'xh-form-renderer': DEFAULT_FORM_RENDERER_TRANSLATIONS,
    'xh-form-designer': DEFAULT_FORM_DESIGNER_TRANSLATIONS,
  },
})
