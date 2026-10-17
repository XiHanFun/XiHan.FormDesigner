/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 列表容器（子表单、子表）的部件树：<xh-field> 包住 <xh-field-array>，标题、整份列表的错误文案与状态由字段给出；
// 一行一个 item，行号、行内容与把手各占一块，行内容由渲染器按行的数据路径渲染。

import type { ContainerNode, NodeState } from '@xihan-form/core'
import { assign, host, make, stringOf, text } from './dom'

/** 列表容器的外壳。 */
export interface ListShell {
  /** `<xh-field>` 宿主。 */
  readonly element: HTMLElement
  /** `<xh-field-array>` 宿主。 */
  readonly array: HTMLElement
  /** 行所在的容器，行排在新增把手前面。 */
  readonly root: HTMLElement
  readonly add: HTMLElement
  /** 状态、错误文案与新增把手的文字变化时调用。 */
  readonly update: (state: NodeState, error: string | undefined, addText: string) => void
}

/** 列表里的一行。 */
export interface ListRow {
  readonly item: HTMLElement
  /** 行号。 */
  readonly label: HTMLElement
  /** 行内容，由渲染器填入。 */
  readonly content: HTMLElement
}

/** 建列表容器的外壳：标题取 `basic.title`，`data.movable` 不为 `false` 时可以换序。 */
export function createListShell(doc: Document, node: ContainerNode): ListShell {
  const element = host(doc, 'xh-field')
  const fieldRoot = make(doc, 'div', 'root')
  const label = make(doc, 'label', 'label')
  text(label, stringOf(node.basic.title) ?? '')
  const array = host(doc, 'xh-field-array')
  array.setAttribute('data-xh-part', 'control')
  if (node.data.movable !== false)
    assign(array, 'movable', true)
  const root = make(doc, 'div', 'root')
  const add = make(doc, 'button', 'add-trigger', { type: 'button' })
  root.append(add)
  array.append(root)
  const error = make(doc, 'p', 'error-text')
  fieldRoot.append(label, array, error)
  element.append(fieldRoot)
  return {
    element,
    array,
    root,
    add,
    update: (state, message, addText) => {
      assign(element, 'disabled', state.disabled ? true : undefined)
      assign(element, 'readOnly', state.readOnly ? true : undefined)
      assign(element, 'required', state.required ? true : undefined)
      assign(array, 'disabled', state.disabled ? true : undefined)
      assign(array, 'readOnly', state.readOnly ? true : undefined)
      text(error, message ?? '')
      text(add, addText)
    },
  }
}

/** 建一行：行号、行内容，以及换序与删除把手（不可换序时只有删除）。 */
export function createListRow(doc: Document, movable: boolean): ListRow {
  const item = make(doc, 'div', 'item')
  const label = make(doc, 'div', 'item-label')
  const content = make(doc, 'div', 'item-content')
  const action = make(doc, 'div', 'item-action')
  if (movable)
    action.append(make(doc, 'button', 'move-up-trigger', { type: 'button' }), make(doc, 'button', 'move-down-trigger', { type: 'button' }))
  action.append(make(doc, 'button', 'item-delete-trigger', { type: 'button' }))
  item.append(label, content, action)
  return { item, label, content }
}
