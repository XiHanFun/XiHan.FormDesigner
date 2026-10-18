/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 颜色字段：只建宿主元素，部件由元素按标准结构生成。外观 `display` 缺省是取色器，`swatches` 时是平铺的色板。

import type { FieldRenderer, FieldRendererContext } from '../types'
import type { ContextRef } from './shared'
import { assign, host, stringOf } from '../dom'
import { on, paintCommon, toList } from './shared'

/** `data.swatches` 里的颜色串，空串不算。 */
function swatchesOf(context: FieldRendererContext): string[] {
  return toList(context.node.data.swatches)
}

/** 取色器：`xh-color-picker`，值是按 `format` 写法的颜色串（缺省 hex）；给了 `swatches` 时浮层里带这组预设色。UI 交回数组，取第一项，空时为 `null`。 */
function pickerField(context: FieldRendererContext): ReturnType<FieldRenderer> {
  const element = host(context.document, 'xh-color-picker')
  assign(element, 'format', stringOf(context.node.data.format))
  const swatches = swatchesOf(context)
  if (swatches.length > 0)
    assign(element, 'swatches', swatches)
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

/** 色板：`xh-color-swatch-picker`，每格是 `swatches` 里的一个颜色串，值是选中那格的颜色串，没选时为 `null`。 */
function swatchField(context: FieldRendererContext): ReturnType<FieldRenderer> {
  const element = host(context.document, 'xh-color-swatch-picker')
  assign(element, 'swatches', swatchesOf(context).map(value => ({ value })))
  const ref: ContextRef = { current: context }
  on<{ value: string | null }>(element, 'value-change', detail => ref.current.setValue(detail.value ?? null))
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next)
    assign(element, 'value', typeof next.value === 'string' ? next.value : null)
  }
  update(context)
  return { element, update }
}

/** 颜色：外观 `display` 是 `swatches` 时铺色板，否则是取色器。 */
export const colorField: FieldRenderer = context => (context.node.appearance.display === 'swatches' ? swatchField(context) : pickerField(context))
