/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单的属性描述：沿用 @xihan-ui/designer-kit/properties 的描述模型，加上表单专用的两种编辑方式（选项列表与选项树）。

import type { PropertyControl, PropertyDescriptor, PropertyEditorTable, PropertyValueIssueCode } from '@xihan-ui/designer-kit/properties'
import type { PropertyGroup } from '../schema'
import { isJsonValue } from '@xihan-ui/core/json'
import { checkPropertyValue } from '@xihan-ui/designer-kit/properties'
import { findOptionViolation } from '@xihan-ui/headless'

/**
 * 表单的编辑方式：designer-kit 的内建编辑方式之外，
 * - `options`：选项数组，元素是 `{ value: string, label: string, disabled?: boolean, tone?: Tone, description?: string }`；
 * - `tree-options`：选项树，元素在 `options` 的基础上可带 `children` 与 `hasChildren`。
 * 两者的结构由 `@xihan-ui/headless` 的 `findOptionViolation` 判定（要求 label、不许多余的键、同一层 value 不重复、最多 32 层）。
 */
export type FormPropertyControl = PropertyControl | { readonly kind: 'options' } | { readonly kind: 'tree-options' }

/** 表单的属性描述：`path` 是属性在所在属性包（basic / data / appearance、区域或表单设置）里的路径，表单只用一段 `[名字]`。 */
export type FormPropertyDescriptor = PropertyDescriptor<FormPropertyControl>

/** 按分组列出的属性描述。 */
export type PropertySchema = Readonly<Record<PropertyGroup, readonly FormPropertyDescriptor[]>>

/** 空的属性描述表。 */
export const EMPTY_PROPERTY_SCHEMA: PropertySchema = Object.freeze({ basic: [], data: [], appearance: [] })

/** 属性名，即属性路径唯一的一段。 */
export function propertyName(descriptor: FormPropertyDescriptor): string {
  return String(descriptor.path[0])
}

/**
 * 检查属性值是否符合编辑方式；符合时为 `undefined`，否则给出问题码。
 * 内建编辑方式交给 designer-kit 的 `checkPropertyValue`；选项与选项树结构不符时为 `invalid-value`；不是 JSON 值时为 `invalid-type`。
 */
export function checkFormPropertyValue(control: FormPropertyControl, value: unknown): PropertyValueIssueCode | 'invalid-value' | undefined {
  if (!isJsonValue(value))
    return 'invalid-type'
  switch (control.kind) {
    case 'options':
      return findOptionViolation(value, { requireLabel: true, strict: true }) === undefined ? undefined : 'invalid-value'
    case 'tree-options':
      return findOptionViolation(value, { tree: true, requireLabel: true, strict: true }) === undefined ? undefined : 'invalid-value'
    default:
      return checkPropertyValue(control, value)
  }
}

/** 属性值是否符合描述。 */
export function isValidPropertyValue(descriptor: FormPropertyDescriptor, value: unknown): boolean {
  return checkFormPropertyValue(descriptor.control, value) === undefined
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
