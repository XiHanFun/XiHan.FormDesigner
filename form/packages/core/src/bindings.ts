/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 数据绑定：字段与列表容器的数据键、所在作用域、可引用的名字，以及由文档得出初始值。

import type { JsonValue } from '@xihan-ui/core/json'
import type { KindRegistry, ValueKind } from './registry/kinds'
import type { ContainerNode, FieldNode, FormDocument, FormNode } from './schema'
import { cloneJson, isPlainObject } from '@xihan-ui/core/json'
import { RUNTIME_VARIABLES } from './expression'
import { isJsonValue } from './json'
import { findNode } from './traverse'

/** 一处数据绑定：字段，或带数据键的列表容器。 */
export interface DataBinding {
  readonly node: FieldNode | ContainerNode
  /** 所在列表容器的 id；顶层为 `null`。 */
  readonly scope: string | null
  /** 从顶层起的数据键链；进入列表容器时接上它的键，行下标不计入。 */
  readonly path: readonly string[]
}

function isListContainer(node: FormNode): node is ContainerNode & { key: string } {
  return node.type === 'container' && typeof node.key === 'string'
}

function collect(children: readonly FormNode[], scope: string | null, prefix: readonly string[], out: DataBinding[]): void {
  for (const node of children) {
    if (node.type === 'field') {
      out.push({ node, scope, path: [...prefix, node.key] })
    }
    else if (node.type === 'container') {
      if (isListContainer(node)) {
        const path = [...prefix, node.key]
        out.push({ node, scope, path })
        for (const region of node.regions)
          collect(region.children, node.id, path, out)
      }
      else {
        for (const region of node.regions)
          collect(region.children, scope, prefix, out)
      }
    }
  }
}

/** 按文档顺序列出全部数据绑定。 */
export function listBindings(document: FormDocument): DataBinding[] {
  const out: DataBinding[] = []
  collect(document.children, null, [], out)
  return out
}

/** 某个作用域里直接绑定的数据键，按文档顺序。 */
export function scopeKeys(document: FormDocument, scope: string | null): string[] {
  return listBindings(document)
    .filter(binding => binding.scope === scope)
    .map(binding => binding.node.key as string)
}

/**
 * 节点上的表达式可以引用的顶层名字：顶层作用域的全部数据键、`extra`，
 * 字段与列表容器另有 `$value`，位于列表容器里的节点另有 `$row` 与 `$index`。
 * 节点不存在时返回 `undefined`。
 */
export function identifiersAt(document: FormDocument, nodeId: string, extra: readonly string[] = []): string[] | undefined {
  const found = findNode(document, nodeId)
  if (found === undefined)
    return undefined
  const names = new Set(scopeKeys(document, null))
  for (const name of extra)
    names.add(name)
  if (found.node.type === 'field' || isListContainer(found.node))
    names.add(RUNTIME_VARIABLES.value)
  if (found.ancestors.some(isListContainer)) {
    names.add(RUNTIME_VARIABLES.row)
    names.add(RUNTIME_VARIABLES.index)
  }
  return [...names]
}

/** 值是否符合值形状；`null` 只对标量与对象表示「没有值」。 */
export function isValueOfKind(kind: ValueKind, value: unknown): boolean {
  switch (kind) {
    case 'string':
      return value === null || typeof value === 'string'
    case 'number':
      return value === null || (typeof value === 'number' && Number.isFinite(value))
    case 'boolean':
      return typeof value === 'boolean'
    case 'string-list':
      return Array.isArray(value) && value.every(item => typeof item === 'string')
    case 'number-list':
      return Array.isArray(value) && value.every(item => typeof item === 'number' && Number.isFinite(item))
    case 'list':
      return Array.isArray(value) && isJsonValue(value)
    case 'object':
      return value === null || (isPlainObject(value) && isJsonValue(value))
  }
}

function initialValueOf(node: FieldNode, registry: KindRegistry): JsonValue {
  const definition = registry.get(node.kind)
  if (definition?.type !== 'field')
    throw new TypeError(`字段 ${node.id} 的种类 ${node.kind} 不是登记过的字段种类`)
  const initial = node.basic.initialValue
  return cloneJson(initial === undefined ? definition.emptyValue(node.data) : initial)
}

function initialRowCount(node: ContainerNode): number {
  const count = node.data.initialRows
  return typeof count === 'number' && Number.isSafeInteger(count) && count > 0 ? count : 0
}

function scopeValues(children: readonly FormNode[], registry: KindRegistry, out: Record<string, JsonValue>): Record<string, JsonValue> {
  for (const node of children) {
    if (node.type === 'field') {
      out[node.key] = initialValueOf(node, registry)
    }
    else if (node.type === 'container') {
      if (isListContainer(node))
        out[node.key] = Array.from({ length: initialRowCount(node) }, () => createRowValues(node, registry))
      else
        node.regions.forEach(region => scopeValues(region.children, registry, out))
    }
  }
  return out
}

/** 列表容器新增一行时的行对象：行内各字段取初始值，嵌套列表取各自的初始行数。 */
export function createRowValues(container: ContainerNode, registry: KindRegistry): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {}
  for (const region of container.regions)
    scopeValues(region.children, registry, out)
  return out
}

/** 由文档得出表单的初始值：字段取 `basic.initialValue`，没有则取种类的空值；列表容器取 `data.initialRows` 行。 */
export function createInitialValues(document: FormDocument, registry: KindRegistry): Record<string, JsonValue> {
  return scopeValues(document.children, registry, {})
}
