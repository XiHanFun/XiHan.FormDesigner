/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 数据路径：作用域里的绑定、按路径找节点实例、按路径读写值。

import type { ContainerNode, FieldNode, FormNode, JsonValue } from '@xihan-form/core'
import { isPlainObject } from '@xihan-form/core'
import { FormRuntimeError, pathText } from './errors'

/** 数据路径：键与行号交替，如 `['lines', 1, 'price']`。 */
export type DataPath = readonly (string | number)[]

/** 带数据键的节点：字段，或列表容器。 */
export type BoundNode = FieldNode | (ContainerNode & { readonly key: string })

/** 是否为列表容器。 */
export function isListContainer(node: FormNode): node is ContainerNode & { readonly key: string } {
  return node.type === 'container' && typeof node.key === 'string'
}

/** 一个作用域里直接绑定的节点：穿过布局容器，不进入列表容器。 */
export function scopeBindings(children: readonly FormNode[]): BoundNode[] {
  const out: BoundNode[] = []
  for (const node of children) {
    if (node.type === 'field' || isListContainer(node))
      out.push(node)
    else if (node.type === 'container')
      node.regions.forEach(region => out.push(...scopeBindings(region.children)))
  }
  return out
}

/** 列表容器一行里的子节点。 */
export function rowChildren(container: ContainerNode): FormNode[] {
  return container.regions.flatMap(region => region.children)
}

/** 路径解析结果：节点与它的行号链。 */
export interface ResolvedPath {
  readonly node: BoundNode
  readonly rowPath: readonly number[]
}

/** 按文档结构解析数据路径；路径必须以数据键结尾，列表之后紧跟行号。解析不了返回 `undefined`。 */
export function resolvePath(children: readonly FormNode[], path: DataPath): ResolvedPath | undefined {
  let scope = children
  const rowPath: number[] = []
  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index]
    const node = typeof segment === 'string' ? scopeBindings(scope).find(item => item.key === segment) : undefined
    if (node === undefined)
      return undefined
    if (index === path.length - 1)
      return { node, rowPath }
    if (!isListContainer(node))
      return undefined
    const row = path[index + 1]
    if (!Number.isSafeInteger(row) || (row as number) < 0 || index + 1 === path.length - 1)
      return undefined
    rowPath.push(row as number)
    scope = rowChildren(node)
    index += 1
  }
  return undefined
}

/** 深拷贝 JSON 值。 */
export function cloneJson<T extends JsonValue>(value: T): T {
  if (value === null || typeof value !== 'object')
    return value
  if (Array.isArray(value))
    return value.map(item => cloneJson(item)) as unknown as T
  const out: Record<string, JsonValue> = {}
  for (const [key, item] of Object.entries(value))
    out[key] = cloneJson(item)
  return out as T
}

/** 按路径读值；途中缺失返回 `undefined`。 */
export function getAt(values: Readonly<Record<string, JsonValue>>, path: DataPath): JsonValue | undefined {
  let current: JsonValue | undefined = values as JsonValue
  for (const segment of path) {
    if (typeof segment === 'number') {
      if (!Array.isArray(current))
        return undefined
      current = (current as readonly JsonValue[])[segment]
    }
    else {
      if (!isPlainObject(current) || !Object.hasOwn(current, segment))
        return undefined
      current = (current as Record<string, JsonValue>)[segment]
    }
  }
  return current
}

/** 按路径写值，原地修改；途中的行或对象不存在时抛 `XH_FORM_RT_UNKNOWN_PATH`。 */
export function setAt(values: Record<string, JsonValue>, path: DataPath, value: JsonValue): void {
  const parentPath = path.slice(0, -1)
  const parent = parentPath.length === 0 ? values : getAt(values, parentPath)
  const last = path[path.length - 1]
  if (typeof last !== 'string' || !isPlainObject(parent))
    throw new FormRuntimeError('XH_FORM_RT_UNKNOWN_PATH', { path: pathText(path) })
  const target = parent as Record<string, JsonValue>
  target[last] = value
}
