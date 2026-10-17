/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 不经界面使用表单：控制器有与渲染器同一套取值、联动、选项与校验，不碰 DOM。

import type { FormDocument } from '@xihan-form/core'
import type { OptionLoader } from '@xihan-form/runtime'
import { createFormController } from '@xihan-form/runtime'
import { createExpressionEngine } from '@xihan-ui/expression'

declare const schema: FormDocument
declare const loadOptions: OptionLoader
declare function sync(values: object): void

// #region controller
const controller = createFormController({
  document: schema,
  expressionEngine: createExpressionEngine(),
  values: { type: 'travel' },
  loadOptions,
})

const unsubscribe = controller.subscribe((event) => {
  if (event.type === 'values')
    sync(controller.getFormData())
})

controller.setValue(['city'], '杭州')
const outcome = controller.validate() // { valid, issues }

unsubscribe()
controller.dispose()
// #endregion controller

export { outcome }
