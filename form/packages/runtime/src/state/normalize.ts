/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 把宿主给的数据按文档规整成一份表单值：核对形状，缺的取初始值，多带的键原样保留。

import type { ContainerNode, FormNode, JsonValue, KindRegistry } from '@xihan-form/core'
import type { BoundNode, DataPath } from './paths'
import { createRowValues, isJsonValue, isPlainObject, isValueOfKind } from '@xihan-form/core'
import { FormRuntimeError, pathText } from './errors'
import { cloneJson, isListContainer, rowChildren, scopeBindings } from './paths'

function invalid(path: DataPath): never {
  throw new FormRuntimeError('XH_FORM_RT_INVALID_VALUE', { path: pathText(path) })
}

/** 核对单个绑定节点的值并返回规整后的副本；值的形状不符时抛 `XH_FORM_RT_INVALID_VALUE`。 */
export function normalizeValue(node: BoundNode, value: unknown, path: DataPath, registry: KindRegistry): JsonValue {
  if (!isJsonValue(value))
    invalid(path)
  if (isListContainer(node)) {
    if (!Array.isArray(value))
      invalid(path)
    return value.map((row, index) => normalizeRow(node, row, [...path, index], registry))
  }
  const definition = registry.get(node.kind)
  if (definition?.type !== 'field' || !isValueOfKind(definition.valueKind(node.data), value))
    invalid(path)
  return cloneJson(value)
}

/** 规整列表容器的一行：缺的键取新行的初始值。 */
export function normalizeRow(container: ContainerNode, row: unknown, path: DataPath, registry: KindRegistry): Record<string, JsonValue> {
  return normalizeScope(rowChildren(container), row, path, createRowValues(container, registry), registry)
}

/** 规整一个作用域的数据：`defaults` 提供缺失键的初始值。 */
export function normalizeScope(children: readonly FormNode[], data: unknown, path: DataPath, defaults: Readonly<Record<string, JsonValue>>, registry: KindRegistry): Record<string, JsonValue> {
  if (!isPlainObject(data) || !isJsonValue(data))
    invalid(path)
  const out = cloneJson(data as Record<string, JsonValue>)
  for (const node of scopeBindings(children)) {
    out[node.key] = Object.hasOwn(data, node.key)
      ? normalizeValue(node, data[node.key], [...path, node.key], registry)
      : cloneJson(defaults[node.key] ?? null)
  }
  return out
}
