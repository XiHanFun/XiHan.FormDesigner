/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 数据路径：作用域里的绑定、按路径找节点实例；路径读写取 @xihan-ui/core/json。

import type { ContainerNode, FieldNode, FormNode } from '@xihan-form/core'
import type { JsonPath } from '@xihan-ui/core/json'

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
export function resolvePath(children: readonly FormNode[], path: JsonPath): ResolvedPath | undefined {
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

/** 选项依赖的数据路径：依赖键先在实例所在作用域找，找不到再逐层往外；都找不到返回 `undefined`。 */
export function dependencyPath(children: readonly FormNode[], instancePath: JsonPath, key: string): JsonPath | undefined {
  const scopes: { children: readonly FormNode[], prefix: JsonPath }[] = [{ children, prefix: [] }]
  let scope = children
  for (let index = 0; index + 2 < instancePath.length; index += 2) {
    const list = scopeBindings(scope).find(item => item.key === instancePath[index])
    if (list === undefined || !isListContainer(list))
      return undefined
    scope = rowChildren(list)
    scopes.push({ children: scope, prefix: instancePath.slice(0, index + 2) })
  }
  for (const { children: members, prefix } of scopes.reverse()) {
    if (scopeBindings(members).some(item => item.key === key))
      return [...prefix, key]
  }
  return undefined
}
