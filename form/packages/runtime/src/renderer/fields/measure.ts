/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 度量类字段：滑块与评分，只建宿主元素，部件由元素按标准结构生成：滑块按值的个数铺滑柄，评分按 count 铺星。

import type { FieldRenderer, FieldRendererContext } from '../types'
import type { ContextRef } from './shared'
import { assign, host, numberOf } from '../dom'
import { on, paintCommon } from './shared'

/** 滑块：`xh-slider`，`range` 时两个滑柄。UI 的值总是数组，单值字段取第一项。 */
export const sliderField: FieldRenderer = (context) => {
  const range = context.node.data.range === true
  const element = host(context.document, 'xh-slider')
  const data = context.node.data
  assign(element, 'min', numberOf(data.min))
  assign(element, 'max', numberOf(data.max))
  assign(element, 'step', numberOf(data.step))
  const ref: ContextRef = { current: context }
  on<{ value: number[] }>(element, 'value-change', (detail) => {
    ref.current.setValue(range ? [...detail.value] : (detail.value[0] ?? null))
  })
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next)
    const value = next.value
    const min = numberOf(data.min) ?? 0
    const max = numberOf(data.max) ?? 100
    assign(element, 'value', range
      ? (Array.isArray(value) && value.length === 2 ? value : [min, max])
      : [typeof value === 'number' ? value : min])
  }
  update(context)
  return { element, update }
}

/** 评分：`xh-rating`，星数取 `count`；0 即未评分，表单里是 `null`。 */
export const ratingField: FieldRenderer = (context) => {
  const count = numberOf(context.node.data.count) ?? 5
  const element = host(context.document, 'xh-rating')
  assign(element, 'count', count)
  if (context.node.data.allowHalf === true)
    assign(element, 'allowHalf', true)
  assign(element, 'allowClear', true)
  const ref: ContextRef = { current: context }
  on<{ value: number }>(element, 'value-change', detail => ref.current.setValue(detail.value > 0 ? detail.value : null))
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next)
    assign(element, 'value', typeof next.value === 'number' ? next.value : 0)
  }
  update(context)
  return { element, update }
}
