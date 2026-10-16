/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 生成 UI 元素部件树用的小工具：建节点、标部件、写属性与文字。

import type { NodeState } from '@xihan-form/core'

/** 建一个节点；给了 name 就标成该部件。 */
export function make<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, name?: string, attributes: Readonly<Record<string, string>> = {}): HTMLElementTagNameMap[K] {
  const element = doc.createElement(tag)
  if (name !== undefined)
    element.setAttribute('data-xh-part', name)
  for (const [key, value] of Object.entries(attributes))
    element.setAttribute(key, value)
  return element
}

/** 建一个 UI 元素宿主。 */
export function host(doc: Document, tag: string): HTMLElement {
  return doc.createElement(tag)
}

/** 有值时写属性，`undefined` 时移除。 */
export function attr(element: Element, name: string, value: string | undefined): void {
  if (value === undefined)
    element.removeAttribute(name)
  else if (element.getAttribute(name) !== value)
    element.setAttribute(name, value)
}

/** 文字不同时才写。 */
export function text(element: Element, value: string): void {
  if (element.textContent !== value)
    element.textContent = value
}

/** 取字符串属性，不是字符串时为 `undefined`。 */
export function stringOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** 取数值属性，不是有限数时为 `undefined`。 */
export function numberOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** 能接收表单控件状态的 UI 元素：禁用、只读、必填只在为真时写实例值，否则交回字段与表单。 */
export function applyControlState(element: HTMLElement, state: NodeState, options: { readOnly?: boolean, required?: boolean } = {}): void {
  const target = element as HTMLElement & { disabled?: boolean, readOnly?: boolean, required?: boolean }
  target.disabled = state.disabled ? true : undefined
  if (options.readOnly !== false)
    target.readOnly = state.readOnly ? true : undefined
  if (options.required !== false)
    target.required = state.required ? true : undefined
}

/** 写一个响应式属性；值与当前值相同（数组逐项相同）时不写。 */
export function assign(element: HTMLElement, name: string, value: unknown): void {
  const target = element as unknown as Record<string, unknown>
  const current = target[name]
  if (Array.isArray(current) && Array.isArray(value) && current.length === value.length && current.every((item, index) => Object.is(item, value[index])))
    return
  if (!Object.is(current, value))
    target[name] = value
}
