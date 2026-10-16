/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 度量类字段：滑块与评分，部件树照 UI 文档的写法。

import type { FieldRenderer, FieldRendererContext } from '../types'
import type { ContextRef } from './shared'
import { assign, host, make, numberOf } from '../dom'
import { on, paintCommon, paintLabel } from './shared'

/** 滑块：`xh-slider`，`range` 时两个滑柄。UI 的值总是数组，单值字段取第一项。 */
export const sliderField: FieldRenderer = (context) => {
  const doc = context.document
  const range = context.node.data.range === true
  const element = host(doc, 'xh-slider')
  const label = make(doc, 'label', 'label')
  const track = make(doc, 'div', 'track')
  track.append(make(doc, 'div', 'range'))
  const control = make(doc, 'div', 'control')
  control.append(track)
  for (let index = 0; index < (range ? 2 : 1); index += 1) {
    const thumb = make(doc, 'div', 'thumb', range ? { index: String(index) } : {})
    thumb.append(make(doc, 'input', 'hidden-input'))
    control.append(thumb)
  }
  const root = make(doc, 'div', 'root')
  root.append(label, control)
  element.append(root)
  paintLabel(label, context.node)
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
    paintCommon(element, next, { required: false })
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
  const doc = context.document
  const count = numberOf(context.node.data.count) ?? 5
  const element = host(doc, 'xh-rating')
  const label = make(doc, 'span', 'label')
  const control = make(doc, 'div', 'control')
  for (let index = 1; index <= count; index += 1)
    control.append(make(doc, 'span', 'item', { value: String(index) }))
  const root = make(doc, 'div', 'root')
  root.append(label, control)
  element.append(root)
  paintLabel(label, context.node)
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
