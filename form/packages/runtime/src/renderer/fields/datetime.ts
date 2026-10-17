/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 日期时间类字段：都只建宿主元素，部件由元素按标准结构生成；值是 ISO 文字，与 UI 的约定一致。

import type { FieldRenderer, FieldRendererContext } from '../types'
import type { ContextRef } from './shared'
import { assign, host } from '../dom'
import { on, paintCommon, toList } from './shared'

/** 日期：`xh-date-picker`，值是 ISO 日期串，`withTime` 时是 ISO 日期时间串；UI 交回数组，单选取第一项，空时为 `null`。 */
export const dateField: FieldRenderer = (context) => {
  const element = host(context.document, 'xh-date-picker')
  if (context.node.data.withTime === true)
    assign(element, 'showTime', true)
  const ref: ContextRef = { current: context }
  on<{ value: string[] }>(element, 'value-change', detail => ref.current.setValue(detail.value[0] ?? null))
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next, { placeholder: true })
    assign(element, 'value', toList(next.value))
  }
  update(context)
  return { element, update }
}
