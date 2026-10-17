/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 颜色字段：只建宿主元素，部件由元素按标准结构生成。

import type { FieldRenderer, FieldRendererContext } from '../types'
import type { ContextRef } from './shared'
import { assign, host, stringOf } from '../dom'
import { on, paintCommon, toList } from './shared'

/** 颜色：`xh-color-picker`，值是按 `format` 写法的颜色串（缺省 hex）；UI 交回数组，取第一项，空时为 `null`。 */
export const colorField: FieldRenderer = (context) => {
  const element = host(context.document, 'xh-color-picker')
  assign(element, 'format', stringOf(context.node.data.format))
  const ref: ContextRef = { current: context }
  on<{ value: string[] }>(element, 'value-change', detail => ref.current.setValue(detail.value[0] ?? null))
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next)
    assign(element, 'value', toList(next.value))
  }
  update(context)
  return { element, update }
}
