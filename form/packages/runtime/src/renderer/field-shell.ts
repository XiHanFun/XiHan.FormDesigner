/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 字段外壳：用 UI 的 <xh-field> 包住字段渲染器产出的控件，给出标签、提示与错误文案；
// 控件作为 control 部件，字段把标签、描述链与状态接到控件真正可聚焦的部件上。

import type { FieldNode } from '@xihan-form/core'
import type { FieldRendererContext } from './types'
import { assign, host, make, stringOf, text } from './dom'

/** UI 的视觉隐藏类。 */
const VISUALLY_HIDDEN = 'xh-visually-hidden'

/** 字段外壳：`<xh-field>` 宿主与按上下文刷新的函数。 */
export interface FieldShell {
  readonly element: HTMLElement
  readonly update: (context: FieldRendererContext) => void
}

/** 用 `<xh-field>` 包住控件：标签取 `basic.label`（`labelHidden` 或 `options.labelHidden` 时只在视觉上隐藏），有 `basic.hint` 时带提示。 */
export function createFieldShell(doc: Document, node: FieldNode, control: HTMLElement, options: { readonly labelHidden?: boolean } = {}): FieldShell {
  const element = host(doc, 'xh-field')
  const root = make(doc, 'div', 'root')
  const label = make(doc, 'label', 'label')
  text(label, stringOf(node.basic.label) ?? '')
  label.classList.toggle(VISUALLY_HIDDEN, options.labelHidden === true || node.appearance.labelHidden === true)
  control.setAttribute('data-xh-part', 'control')
  root.append(label, control)
  const hint = stringOf(node.basic.hint) ?? ''
  if (hint !== '') {
    const description = make(doc, 'p', 'description')
    text(description, hint)
    root.append(description)
  }
  const error = make(doc, 'p', 'error-text')
  root.append(error)
  element.append(root)
  return {
    element,
    update: (context) => {
      assign(element, 'disabled', context.state.disabled ? true : undefined)
      assign(element, 'readOnly', context.state.readOnly ? true : undefined)
      assign(element, 'required', context.state.required ? true : undefined)
      text(error, context.error ?? '')
    },
  }
}
