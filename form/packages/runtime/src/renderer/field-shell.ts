/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 字段外壳：用 UI 的 <xh-field> 包住字段渲染器产出的控件，只建宿主元素：标题、提示与错误文案写到属性上，
// 控件写成 slot="control"，由元素按标准结构铺出部件并把控件原样放进去；字段把标题、描述链与状态接到控件真正可聚焦的部件上。

import type { FieldNode } from '@xihan-form/core'
import type { FieldRendererContext } from './types'
import { assign, host, stringOf } from './dom'

/** 字段外壳：`<xh-field>` 宿主与按上下文刷新的函数。 */
export interface FieldShell {
  readonly element: HTMLElement
  readonly update: (context: FieldRendererContext) => void
}

/** 带前后缀时控件包在 `xh-input-group` 里，名字要落在里面的控件元素上。 */
function namedControl(control: HTMLElement): HTMLElement {
  if (control.localName !== 'xh-input-group')
    return control
  return control.querySelector<HTMLElement>(':scope > [data-xh-part="root"] > :not([data-xh-part])') ?? control
}

/**
 * 用 `<xh-field>` 包住控件：标题取 `basic.label`，有 `basic.hint` 时带提示，错误文案常挂、随校验写入。
 * `labelHidden` 或 `options.labelHidden` 时不铺标题，标题文字写成控件的 aria-label，名字照旧。
 */
export function createFieldShell(doc: Document, node: FieldNode, control: HTMLElement, options: { readonly labelHidden?: boolean } = {}): FieldShell {
  const element = host(doc, 'xh-field')
  const label = stringOf(node.basic.label) ?? ''
  if (options.labelHidden === true || node.appearance.labelHidden === true)
    namedControl(control).setAttribute('aria-label', label)
  else
    assign(element, 'label', label)
  const hint = stringOf(node.basic.hint) ?? ''
  if (hint !== '')
    assign(element, 'description', hint)
  assign(element, 'errorText', '')
  control.setAttribute('slot', 'control')
  element.append(control)
  return {
    element,
    update: (context) => {
      assign(element, 'disabled', context.state.disabled ? true : undefined)
      assign(element, 'readOnly', context.state.readOnly ? true : undefined)
      assign(element, 'required', context.state.required ? true : undefined)
      assign(element, 'errorText', context.error ?? '')
    },
  }
}
