/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单的属性描述：沿用 @xihan-ui/designer-kit/properties 的描述模型；内建编辑方式之外的编辑方式由扩展登记。

import type { JsonPath } from '@xihan-ui/core/json'
import type { ControlKind, PropertyControl, PropertyDescriptor, PropertyEditorTable } from '@xihan-ui/designer-kit/properties'
import type { PropertyGroup } from '../schema'
import { isJsonValue } from '@xihan-ui/core/json'
import { BUILTIN_CONTROL_KINDS, findPropertyValueIssue } from '@xihan-ui/designer-kit/properties'

/** 表单的编辑方式：designer-kit 的内建编辑方式，或扩展登记的编辑方式（`kind` 是登记的键）。 */
export type FormPropertyControl = PropertyControl | { readonly kind: string }

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

/** 没有登记别的编辑方式。 */
const NO_CONTROLS: Readonly<Record<string, ControlKind>> = Object.freeze({})

/** 属性值的一处问题：`path` 相对这个值，落在值本身时是 `[]`。 */
export interface FormPropertyValueIssue {
  readonly code: string
  readonly path: JsonPath
}

/**
 * 找出属性值第一处不符合编辑方式的地方；符合时为 `undefined`。不是 JSON 值时为 `invalid-type`；
 * 内建编辑方式交给 designer-kit 的 `findPropertyValueIssue`（选项列表 `options` 的问题落在那一项的那个键上，如 `[2, "value"]`；
 * 选项树 `treeOptions` 的落在那一层那一项的那个键上，如 `[0, "children", 1, "value"]`），
 * 登记在 `controls` 里的交给它的 `check`，两边都没有时为 `unknown-control`，这两种落在值本身。
 * `controls` 缺省为空，按扩展合出的表见 `createFormModel` 的 `controls`。
 */
export function findFormPropertyValueIssue(control: FormPropertyControl, value: unknown, controls: Readonly<Record<string, ControlKind>> = NO_CONTROLS): FormPropertyValueIssue | undefined {
  if (!isJsonValue(value))
    return { code: 'invalid-type', path: [] }
  if ((BUILTIN_CONTROL_KINDS as readonly string[]).includes(control.kind))
    return findPropertyValueIssue(control as PropertyControl, value)
  const code = Object.hasOwn(controls, control.kind) ? controls[control.kind]!.check?.(value, control) : 'unknown-control'
  return code === undefined ? undefined : { code, path: [] }
}

/** 检查属性值是否符合编辑方式；符合时为 `undefined`，否则给出问题码。规则同 `findFormPropertyValueIssue`。 */
export function checkFormPropertyValue(control: FormPropertyControl, value: unknown, controls: Readonly<Record<string, ControlKind>> = NO_CONTROLS): string | undefined {
  return findFormPropertyValueIssue(control, value, controls)?.code
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
    text: 'text',
    number: 'number',
    boolean: 'switch',
    select: 'choice',
    tags: 'tags',
    color: 'color',
    json: 'json',
    options: 'options',
    treeOptions: 'treeOptions',
  }),
  byPath: Object.freeze({ initialValue: 'value' }),
})
