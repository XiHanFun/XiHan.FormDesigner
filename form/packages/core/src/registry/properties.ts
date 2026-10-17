/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单的属性描述：沿用 @xihan-ui/designer-kit/properties 的描述模型；内建编辑方式之外的编辑方式由扩展登记，
// 表单自己的选项列表与选项树也是这样登记的两种。

import type { ControlKind, PropertyControl, PropertyDescriptor, PropertyEditorTable } from '@xihan-ui/designer-kit/properties'
import type { PropertyGroup } from '../schema'
import { isJsonValue } from '@xihan-ui/core/json'
import { BUILTIN_CONTROL_KINDS, checkPropertyValue } from '@xihan-ui/designer-kit/properties'
import { findOptionViolation } from '@xihan-ui/headless'

/** 表单的编辑方式：designer-kit 的内建编辑方式，或扩展登记的编辑方式（`kind` 是登记的键）。 */
export type FormPropertyControl = PropertyControl | { readonly kind: string }

/**
 * 表单内置扩展登记的两种编辑方式：
 * - `options`：选项数组，元素是 `{ value: string, label: string, disabled?: boolean, tone?: Tone, description?: string }`；
 * - `tree-options`：选项树，元素在 `options` 的基础上可带 `children` 与 `hasChildren`。
 * 两者的结构由 `@xihan-ui/headless` 的 `findOptionViolation` 判定（要求 label、不许多余的键、同一层 value 不重复、最多 32 层），不符时为 `invalid-value`。
 */
export const FORM_CONTROLS: Readonly<Record<string, ControlKind>> = Object.freeze({
  'options': { check: value => (findOptionViolation(value, { requireLabel: true, strict: true }) === undefined ? undefined : 'invalid-value') },
  'tree-options': { check: value => (findOptionViolation(value, { tree: true, requireLabel: true, strict: true }) === undefined ? undefined : 'invalid-value') },
})

/** 表单的属性描述：`path` 是属性在所在属性包（basic / data / appearance、区域或表单设置）里的路径，表单只用一段 `[名字]`。 */
export type FormPropertyDescriptor = PropertyDescriptor<FormPropertyControl>

/** 按分组列出的属性描述。 */
export type PropertySchema = Readonly<Record<PropertyGroup, readonly FormPropertyDescriptor[]>>

/** 空的属性描述表。 */
export const EMPTY_PROPERTY_SCHEMA: PropertySchema = Object.freeze({ basic: [], data: [], appearance: [] })

/** 内建的数字编辑方式：control 是 number 时原样返回，否则为 undefined。 */
export function numberControl(control: FormPropertyControl): Extract<PropertyControl, { readonly kind: 'number' }> | undefined {
  return control.kind === 'number' ? control as Extract<PropertyControl, { readonly kind: 'number' }> : undefined
}

/** 属性名，即属性路径唯一的一段。 */
export function propertyName(descriptor: FormPropertyDescriptor): string {
  return String(descriptor.path[0])
}

/**
 * 检查属性值是否符合编辑方式；符合时为 `undefined`，否则给出问题码。不是 JSON 值时为 `invalid-type`；
 * 内建编辑方式交给 designer-kit 的 `checkPropertyValue`，登记在 `controls` 里的交给它的 `check`，两边都没有时为 `unknown-control`。
 * `controls` 缺省为表单内置的两种，按扩展合出的表见 `createFormModel` 的 `controls`。
 */
export function checkFormPropertyValue(control: FormPropertyControl, value: unknown, controls: Readonly<Record<string, ControlKind>> = FORM_CONTROLS): string | undefined {
  if (!isJsonValue(value))
    return 'invalid-type'
  if ((BUILTIN_CONTROL_KINDS as readonly string[]).includes(control.kind))
    return checkPropertyValue(control as PropertyControl, value)
  return Object.hasOwn(controls, control.kind) ? controls[control.kind]!.check?.(value, control) : 'unknown-control'
}

/** 属性值是否符合描述；`controls` 同 `checkFormPropertyValue`。 */
export function isValidPropertyValue(descriptor: FormPropertyDescriptor, value: unknown, controls?: Readonly<Record<string, ControlKind>>): boolean {
  return checkFormPropertyValue(descriptor.control, value, controls) === undefined
}

/**
 * 表单内置的属性编辑器查找表，交给 designer-kit 的 `resolvePropertyEditor` 使用：
 * 按编辑方式取缺省编辑器，字段初始值按路径另用 `value` 编辑器（形状随字段种类）。宿主可在此基础上覆盖。
 */
export const FORM_PROPERTY_EDITORS: PropertyEditorTable<string> = Object.freeze({
  byControl: Object.freeze({
    'text': 'text',
    'number': 'number',
    'boolean': 'switch',
    'select': 'choice',
    'tags': 'tags',
    'color': 'color',
    'json': 'json',
    'options': 'options',
    'tree-options': 'tree-options',
  }),
  byPath: Object.freeze({ initialValue: 'value' }),
})
