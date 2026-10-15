/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 选项数据：宿主的加载函数、单个实例的加载状态，以及按字段种类核对返回的选项。

import type { FieldNode, KindRegistry, PropertyDescriptor } from '@xihan-form/core'
import type { JsonValue } from '@xihan-ui/core/json'
import type { DataPath } from './paths'
import { isValidPropertyValue } from '@xihan-form/core'

/** 一个选项；树形选项可带 `children`。 */
export interface OptionItem {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean
  readonly children?: readonly OptionItem[]
}

/** 交给宿主加载函数的请求。 */
export interface OptionRequest {
  /** 字段的 `data.optionSource`。 */
  readonly source: string
  readonly nodeId: string
  /** 字段实例的数据路径。 */
  readonly path: DataPath
  /** 当前表单值的副本。 */
  readonly values: Readonly<Record<string, JsonValue>>
}

/** 宿主提供的选项加载函数，返回选项数组或它的 Promise。 */
export type OptionLoader = (request: OptionRequest) => readonly OptionItem[] | Promise<readonly OptionItem[]>

/** 一个字段实例的选项状态。 */
export interface OptionsState {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly items: readonly OptionItem[]
}

/** 字段种类里描述选项的属性；不是选项类字段时返回 `undefined`。 */
export function optionsDescriptor(node: FieldNode, registry: KindRegistry): PropertyDescriptor | undefined {
  const definition = registry.get(node.kind)
  if (definition?.type !== 'field')
    return undefined
  return definition.properties.data.find(property => property.name === 'options' && (property.type === 'options' || property.type === 'tree-options'))
}

/** 字段的选项来源名；没有来源时返回 `undefined`。 */
export function optionSourceOf(node: FieldNode): string | undefined {
  const source = node.data.optionSource
  return typeof source === 'string' && source !== '' ? source : undefined
}

/** 宿主返回的选项是否符合字段种类的选项描述。 */
export function isValidOptions(descriptor: PropertyDescriptor, items: unknown): items is readonly OptionItem[] {
  return isValidPropertyValue(descriptor, items)
}
