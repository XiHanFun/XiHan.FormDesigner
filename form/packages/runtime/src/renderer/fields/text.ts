/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 文本类字段：单行与多行文本、密码、数字、验证码与标签，部件树照 UI 文档的写法；标签、提示与错误由字段外壳给出。
// 节点的属性在模板换掉前不变，建节点时写一次；update 只写值与状态。

import type { FieldRenderer, FieldRendererContext, FieldRendererInstance } from '../types'
import type { ContextRef } from './shared'
import { assign, host, make, numberOf, stringOf, text } from '../dom'
import { on, paintCommon, textValue, toList } from './shared'

function hosted(context: FieldRendererContext, tag: string, control: HTMLElement): HTMLElement {
  const doc = context.document
  const element = host(doc, tag)
  const root = make(doc, 'div', 'root')
  root.append(control)
  element.append(root)
  return element
}

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

function textual(context: FieldRendererContext, tag: string, control: HTMLElement, configure: (element: HTMLElement) => void): ReturnType<FieldRenderer> {
  const element = hosted(context, tag, control)
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
  const control = make(context.document, 'div', 'control')
  control.append(make(context.document, 'input', 'input'))
  return affixed(context, textual(context, 'xh-text-field', control, element => assign(element, 'type', stringOf(context.node.data.inputType) ?? 'text')))
}

/** 多行文本：`xh-text-field` 的输入部件写成 `<textarea>`，行数取外观的 `minRows` / `maxRows`。 */
export const textareaField: FieldRenderer = (context) => {
  const control = make(context.document, 'div', 'control')
  control.append(make(context.document, 'textarea', 'input'))
  const minRows = numberOf(context.node.appearance.minRows)
  const maxRows = numberOf(context.node.appearance.maxRows)
  return textual(context, 'xh-text-field', control, element => assign(element, 'autoSize', {
    ...(minRows === undefined ? {} : { minRows }),
    ...(maxRows === undefined ? {} : { maxRows }),
  }))
}

/** 密码：`xh-password-input`。 */
export const passwordField: FieldRenderer = (context) => {
  const control = make(context.document, 'div', 'control')
  control.append(make(context.document, 'input', 'input'), make(context.document, 'button', 'visibility-trigger', { type: 'button' }))
  return textual(context, 'xh-password-input', control, () => {})
}

/** 数字：`xh-number-field`，可带前后缀。UI 的值是文本，表单里是数或 `null`；小数位数取 `precision`。 */
export const numberField: FieldRenderer = (context) => {
  const doc = context.document
  const control = make(doc, 'div', 'control')
  control.append(make(doc, 'button', 'decrement-trigger', { type: 'button' }), make(doc, 'input', 'input'), make(doc, 'button', 'increment-trigger', { type: 'button' }))
  const element = hosted(context, 'xh-number-field', control)
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
    paintCommon(element, next)
    assign(element, 'value', typeof next.value === 'number' ? format(next.value) : '')
  }
  update(context)
  return affixed(context, { element, update })
}

/** 验证码：`xh-pin-input`，位数取 `length`，每位一个输入框。UI 的值是逐位数组，表单里是拼好的字符串。 */
export const pinField: FieldRenderer = (context) => {
  const doc = context.document
  const length = numberOf(context.node.data.length) ?? 6
  const cells = make(doc, 'div')
  for (let index = 0; index < length; index += 1)
    cells.append(make(doc, 'input', 'input'))
  const element = hosted(context, 'xh-pin-input', cells)
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

/** 标签：`xh-tags-input`，每个值一个标签，个数上限取 `max`。标签节点按值增删，已在的原地保留。 */
export const tagsField: FieldRenderer = (context) => {
  const doc = context.document
  const control = make(doc, 'div', 'control')
  const input = make(doc, 'input', 'input')
  control.append(input)
  const element = hosted(context, 'xh-tags-input', control)
  assign(element, 'max', numberOf(context.node.data.max))
  const items = new Map<string, HTMLElement>()
  const tag = (value: string): HTMLElement => {
    const item = make(doc, 'div', 'item', { value })
    const preview = make(doc, 'div', 'item-preview')
    const label = make(doc, 'span', 'item-text')
    text(label, value)
    preview.append(label, make(doc, 'button', 'item-delete-trigger', { type: 'button' }))
    item.append(preview)
    return item
  }
  const sync = (values: readonly string[]): void => {
    for (const [value, item] of items) {
      if (!values.includes(value)) {
        item.remove()
        items.delete(value)
      }
    }
    let cursor = control.firstElementChild
    for (const value of values) {
      let item = items.get(value)
      if (item === undefined) {
        item = tag(value)
        items.set(value, item)
      }
      if (item === cursor)
        cursor = cursor.nextElementSibling
      else
        control.insertBefore(item, cursor)
    }
  }
  const ref: ContextRef = { current: context }
  on<{ value: string[] }>(element, 'value-change', detail => ref.current.setValue([...detail.value]))
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next, { placeholder: true })
    const values = toList(next.value)
    assign(element, 'value', values)
    sync(values)
  }
  update(context)
  return { element, update }
}
