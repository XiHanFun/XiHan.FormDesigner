/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 内置字段渲染器共用的部分：占位符、尺寸与状态，以及把 UI 元素的事件接到最新的上下文上。

import type { FieldRendererContext } from '../types'
import { applyControlState, assign, stringOf } from '../dom'

/** 控件上与种类无关的那几项：尺寸、占位符与状态。 */
export function paintCommon(element: HTMLElement, context: FieldRendererContext, options: { placeholder?: boolean } = {}): void {
  assign(element, 'size', context.size)
  if (options.placeholder === true)
    assign(element, 'placeholder', stringOf(context.node.basic.placeholder))
  applyControlState(element, context.state)
}

/**
 * 单选的下拉、树选择与级联：字段此刻不必填（规则与联动都算）时带清空钮，由元素按标准结构放在展开钮那一格；
 * 必填时不带；多选能逐个去掉已选项，不带。
 */
export function paintClearable(element: HTMLElement, context: FieldRendererContext, multiple: boolean): void {
  assign(element, 'clearable', !multiple && !context.state.required ? true : undefined)
}

/** 持有最新上下文：事件回调总拿到最近一次 update 交来的那份。 */
export interface ContextRef {
  current: FieldRendererContext
}

/** 监听 UI 元素的事件，取 detail 交给处理函数。 */
export function on<T>(element: HTMLElement, type: string, handler: (detail: T) => void): void {
  element.addEventListener(type, event => handler((event as CustomEvent<T>).detail))
}

/** 取字符串值，`null` 与其它类型都当空串。 */
export function textValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** 单值字段在 UI 里写成数组：空值是空数组。 */
export function toList(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((item): item is string => typeof item === 'string')
  return typeof value === 'string' && value !== '' ? [value] : []
}

/** UI 交回的数组按字段的单选、多选还原：单选取第一项，空时为 `null`。 */
export function fromList(value: readonly string[], multiple: boolean): string | string[] | null {
  return multiple ? [...value] : (value[0] ?? null)
}
