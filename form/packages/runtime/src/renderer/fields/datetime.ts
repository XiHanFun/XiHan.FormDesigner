/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 日期时间类字段：都只建宿主元素，部件由元素按标准结构生成；值是 ISO 文字，与 UI 的约定一致。

import type { FieldRenderer, FieldRendererContext } from '../types'
import type { ContextRef } from './shared'
import { assign, host, stringOf } from '../dom'
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

/** 两端都空时是空数组，否则原样保留两端（只填一端时另一端是空串）。 */
function rangeOf(value: readonly string[]): string[] {
  return value.every(item => item === '') ? [] : [...value]
}

/**
 * 日期范围：`xh-date-range-picker`，值是起止两个 ISO 日期串，`withTime` 时是日期时间串；还没选时是空数组，只填一端时另一端是空串。
 * 占位符写到起止两组段位的整条占位上。
 */
export const dateRangeField: FieldRenderer = (context) => {
  const element = host(context.document, 'xh-date-range-picker')
  if (context.node.data.withTime === true)
    assign(element, 'showTime', true)
  const ref: ContextRef = { current: context }
  on<{ value: string[] }>(element, 'value-change', detail => ref.current.setValue(rangeOf(detail.value)))
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next)
    const placeholder = stringOf(next.node.basic.placeholder)
    assign(element, 'startPlaceholder', placeholder)
    assign(element, 'endPlaceholder', placeholder)
    const value = toList(next.value)
    assign(element, 'value', value.length === 2 ? value : ['', ''])
  }
  update(context)
  return { element, update }
}
