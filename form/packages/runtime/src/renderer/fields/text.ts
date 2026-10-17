/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 文本类字段：单行与多行文本、密码、数字、验证码与标签；标签、提示与错误由字段外壳给出。
// 都只建宿主元素，部件由元素按标准结构生成。
// 节点的属性在模板换掉前不变，建节点时写一次；update 只写值与状态。

import type { FieldRenderer, FieldRendererContext, FieldRendererInstance } from '../types'
import type { ContextRef } from './shared'
import { assign, host, make, numberOf, stringOf, text } from '../dom'
import { on, paintCommon, textValue, toList } from './shared'

/** 外观带前缀或后缀时，用 `xh-input-group` 把它们与控件拼成一体；都没有时原样返回。 */
function affixed(context: FieldRendererContext, instance: FieldRendererInstance): FieldRendererInstance {
  const doc = context.document
  const prefix = stringOf(context.node.appearance.prefix) ?? ''
  const suffix = stringOf(context.node.appearance.suffix) ?? ''
  if (prefix === '' && suffix === '')
    return instance
  const items = (affix: string): HTMLElement[] => {
    if (affix === '')
      return []
    const item = make(doc, 'span', 'item')
    text(item, affix)
    return [item]
  }
  const root = make(doc, 'div', 'root')
  root.append(...items(prefix), instance.element, ...items(suffix))
  const group = host(doc, 'xh-input-group')
  group.append(root)
  return { ...instance, element: group }
}

function textual(context: FieldRendererContext, element: HTMLElement, configure: (element: HTMLElement) => void): ReturnType<FieldRenderer> {
  configure(element)
  const ref: ContextRef = { current: context }
  on<{ value: string }>(element, 'value-change', detail => ref.current.setValue(detail.value))
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next, { placeholder: true })
    assign(element, 'value', textValue(next.value))
  }
  update(context)
  return { element, update }
}

/** 单行文本：`xh-text-field`，输入类型取 `data.inputType`，可带前后缀。 */
export const textField: FieldRenderer = (context) => {
  return affixed(context, textual(context, host(context.document, 'xh-text-field'), element => assign(element, 'type', stringOf(context.node.data.inputType) ?? 'text')))
}

/** 多行文本：`xh-text-field` 开 multiline，输入框由元素铺成 textarea；行数取外观的 `minRows` / `maxRows`。 */
export const textareaField: FieldRenderer = (context) => {
  const minRows = numberOf(context.node.appearance.minRows)
  const maxRows = numberOf(context.node.appearance.maxRows)
  return textual(context, host(context.document, 'xh-text-field'), (element) => {
    assign(element, 'multiline', true)
    assign(element, 'autoSize', {
      ...(minRows === undefined ? {} : { minRows }),
      ...(maxRows === undefined ? {} : { maxRows }),
    })
  })
}

/** 密码：`xh-password-input`。 */
export const passwordField: FieldRenderer = (context) => {
  return textual(context, host(context.document, 'xh-password-input'), () => {})
}

/** 数字：`xh-number-field`，可带前后缀。UI 的值是文本，表单里是数或 `null`；小数位数取 `precision`。 */
export const numberField: FieldRenderer = (context) => {
  const element = host(context.document, 'xh-number-field')
  const precision = numberOf(context.node.data.precision)
  const format = (value: number): string => (precision === undefined ? String(value) : value.toFixed(precision))
  assign(element, 'step', numberOf(context.node.data.step))
  if (precision !== undefined)
    assign(element, 'format', format)
  const ref: ContextRef = { current: context }
  on<{ valueAsNumber: number }>(element, 'value-change', (detail) => {
    ref.current.setValue(Number.isFinite(detail.valueAsNumber) ? detail.valueAsNumber : null)
  })
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next, { placeholder: true })
    assign(element, 'value', typeof next.value === 'number' ? format(next.value) : '')
  }
  update(context)
  return affixed(context, { element, update })
}

/** 验证码：`xh-pin-input`，位数取 `length`，格子由元素按位数生成。UI 的值是逐位数组，表单里是拼好的字符串。 */
export const pinField: FieldRenderer = (context) => {
  const length = numberOf(context.node.data.length) ?? 6
  const element = host(context.document, 'xh-pin-input')
  assign(element, 'length', length)
  if (context.node.data.mask === true)
    assign(element, 'mask', true)
  const ref: ContextRef = { current: context }
  on<{ valueAsString: string }>(element, 'value-change', detail => ref.current.setValue(detail.valueAsString))
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next, { placeholder: true })
    assign(element, 'value', Array.from(textValue(next.value)))
  }
  update(context)
  return { element, update }
}

/** 标签：`xh-tags-input`，每个值一个标签，个数上限取 `max`。 */
export const tagsField: FieldRenderer = (context) => {
  const element = host(context.document, 'xh-tags-input')
  assign(element, 'max', numberOf(context.node.data.max))
  const ref: ContextRef = { current: context }
  on<{ value: string[] }>(element, 'value-change', detail => ref.current.setValue([...detail.value]))
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next, { placeholder: true })
    assign(element, 'value', toList(next.value))
  }
  update(context)
  return { element, update }
}
