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

/** 补成起止两端：缺的一端是空串。 */
function bothEnds(value: readonly string[]): string[] {
  return [value[0] ?? '', value[1] ?? '']
}

/** UI 交回的区间写成字段值：两端都空时是空数组，否则是两端（只填一端时另一端是空串）。UI 交回时会去掉末尾的空端。 */
function rangeOf(value: readonly string[]): string[] {
  const ends = bothEnds(value)
  return ends.every(item => item === '') ? [] : ends
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
    assign(element, 'value', bothEnds(toList(next.value)))
  }
  update(context)
  return { element, update }
}

/**
 * 时间范围：`xh-time-range-picker`，值是起止两个 ISO 时间串，精确到分（`withSeconds` 时到秒）；
 * 还没选时是空数组，只填一端时另一端是空串。
 */
export const timeRangeField: FieldRenderer = (context) => {
  const element = host(context.document, 'xh-time-range-picker')
  if (context.node.data.withSeconds === true)
    assign(element, 'granularity', 'second')
  const ref: ContextRef = { current: context }
  on<{ value: string[] }>(element, 'value-change', detail => ref.current.setValue(rangeOf(detail.value)))
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next)
    assign(element, 'value', bothEnds(toList(next.value)))
  }
  update(context)
  return { element, update }
}

/** 时间：`xh-time-picker`，值是 ISO 时间串，精确到分（`withSeconds` 时到秒）；UI 交回数组，取第一项，空时为 `null`。 */
export const timeField: FieldRenderer = (context) => {
  const element = host(context.document, 'xh-time-picker')
  if (context.node.data.withSeconds === true)
    assign(element, 'granularity', 'second')
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
