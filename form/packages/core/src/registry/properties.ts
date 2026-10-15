/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 属性描述：属性的名字、取值类型与缺省值，同时驱动属性面板与 schema 自校验。

import type { JsonValue } from '@xihan-ui/core/json'
import type { PropertyBag } from '../json'
import type { PropertyGroup } from '../schema'
import { isPlainObject } from '@xihan-ui/core/json'
import { isJsonValue } from '../json'

/**
 * 属性的取值类型：
 * - `string` / `text`：单行 / 多行文本。
 * - `number` / `integer`：有限数字 / 安全整数，可带 `min`、`max`。
 * - `boolean`：布尔。
 * - `enum`：`choices` 里的一个字符串。
 * - `string-list`：字符串数组。
 * - `options`：选项数组，元素是 `{ value: string, label: string, disabled?: boolean }`。
 * - `tree-options`：树形选项，元素在 `options` 的基础上可带 `children`。
 * - `value`：字段的值，形状由字段种类决定，由 schema 自校验按字段种类核对。
 * - `json`：任意 JSON 值。
 */
export type PropertyType = 'string' | 'text' | 'number' | 'integer' | 'boolean' | 'enum' | 'string-list' | 'options' | 'tree-options' | 'value' | 'json'

/** 一个属性的描述。`default` 缺省时，新建节点不带这个属性。 */
export interface PropertyDescriptor {
  readonly name: string
  readonly type: PropertyType
  readonly default?: JsonValue
  readonly choices?: readonly string[]
  readonly min?: number
  readonly max?: number
}

/** 按分组列出的属性描述。 */
export type PropertySchema = Readonly<Record<PropertyGroup, readonly PropertyDescriptor[]>>

/** 空的属性描述表。 */
export const EMPTY_PROPERTY_SCHEMA: PropertySchema = Object.freeze({ basic: [], data: [], appearance: [] })

const OPTIONS_DEPTH_LIMIT = 32

function inBounds(value: number, descriptor: PropertyDescriptor): boolean {
  return (descriptor.min === undefined || value >= descriptor.min) && (descriptor.max === undefined || value <= descriptor.max)
}

function isOption(value: unknown, tree: boolean, depth: number): boolean {
  if (!isPlainObject(value) || typeof value.value !== 'string' || typeof value.label !== 'string')
    return false
  if (value.disabled !== undefined && typeof value.disabled !== 'boolean')
    return false
  const allowed = tree ? ['value', 'label', 'disabled', 'children'] : ['value', 'label', 'disabled']
  if (Object.keys(value).some(key => !allowed.includes(key)))
    return false
  if (value.children === undefined)
    return true
  return tree && isOptionList(value.children, true, depth + 1)
}

function isOptionList(value: unknown, tree: boolean, depth = 0): boolean {
  if (depth > OPTIONS_DEPTH_LIMIT || !Array.isArray(value))
    return false
  const seen = new Set<string>()
  for (const item of value) {
    if (!isOption(item, tree, depth))
      return false
    const key = (item as { value: string }).value
    if (seen.has(key))
      return false
    seen.add(key)
  }
  return true
}

/** 属性值是否符合描述；`value` 类型只核对是不是 JSON 值。选项列表里同一层的 `value` 不得重复。 */
export function isValidPropertyValue(descriptor: PropertyDescriptor, value: unknown): boolean {
  switch (descriptor.type) {
    case 'string':
    case 'text':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) && inBounds(value, descriptor)
    case 'integer':
      return Number.isSafeInteger(value) && inBounds(value as number, descriptor)
    case 'boolean':
      return typeof value === 'boolean'
    case 'enum':
      return typeof value === 'string' && (descriptor.choices ?? []).includes(value)
    case 'string-list':
      return Array.isArray(value) && value.every(item => typeof item === 'string')
    case 'options':
      return isOptionList(value, false)
    case 'tree-options':
      return isOptionList(value, true)
    case 'value':
    case 'json':
      return isJsonValue(value)
  }
}

/** 按描述取出缺省值组成的属性包。 */
export function defaultProperties(descriptors: readonly PropertyDescriptor[]): PropertyBag {
  const out: Record<string, JsonValue> = {}
  for (const descriptor of descriptors) {
    if (descriptor.default !== undefined)
      out[descriptor.name] = descriptor.default
  }
  return out
}
