/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 复制节点：把一组节点改造成能插进文档某个区域的副本，id 全部换新，数据键与目标作用域不冲突。

import type { IdAllocator } from '@xihan-ui/designer-kit'
import type { ContainerNode, FormDocument, FormNode, Region } from './schema'
import { remapIds } from '@xihan-ui/designer-kit'
import { scopeKeys } from './bindings'
import { deriveKey } from './create'
import { collectIds, findRegion } from './traverse'

function isList(node: FormNode): node is ContainerNode & { readonly key: string } {
  return node.type === 'container' && typeof node.key === 'string'
}

/** 区域所在的数据作用域：最近的列表容器 id，文档顶层与不在列表里的区域为 `null`；区域不存在时返回 `undefined`。 */
export function regionScope(document: FormDocument, regionId: string | null): string | null | undefined {
  if (regionId === null)
    return null
  const found = findRegion(document, regionId)
  if (found === undefined)
    return undefined
  const chain = [...found.ancestors, found.container]
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    if (isList(chain[index]!))
      return chain[index]!.id
  }
  return null
}

/** 深拷贝并把每个 `id` 键的值按对照表换掉。 */
function renameIds<T>(value: T, map: ReadonlyMap<string, string>): T {
  if (Array.isArray(value))
    return value.map(item => renameIds(item, map)) as T
  if (value === null || typeof value !== 'object')
    return value
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value))
    out[key] = key === 'id' && typeof item === 'string' ? (map.get(item) ?? item) : renameIds(item, map)
  return out as T
}

/** 本作用域里直接绑定的节点（穿过布局容器，不进入列表容器），用于改键。 */
function renameScopeKeys(nodes: readonly FormNode[], taken: Set<string>): FormNode[] {
  return nodes.map((node): FormNode => {
    if (node.type === 'field' || isList(node)) {
      const key = taken.has(node.key) ? deriveKey(node.kind, node.id) : node.key
      taken.add(key)
      return key === node.key ? node : { ...node, key } as FormNode
    }
    if (node.type === 'container') {
      return { ...node, regions: node.regions.map((region): Region => ({ ...region, children: renameScopeKeys(region.children, taken) })) }
    }
    return node
  })
}

/**
 * 把节点改造成能插进 parent 区域（`null` 为文档顶层）的副本：节点、区域与规则的 id 全部由 ids 重新分配；
 * 直接落在目标作用域里的数据键与该作用域已有的键或彼此冲突时，改为 `deriveKey(种类, 新 id)`。
 * 列表容器内部的键属于它自己的作用域，原样保留。parent 不存在时抛 `RangeError`。
 */
export function cloneNodesForInsert(document: FormDocument, parent: string | null, nodes: readonly FormNode[], ids: IdAllocator): FormNode[] {
  const scope = regionScope(document, parent)
  if (scope === undefined)
    throw new RangeError(`[form-core] region ${JSON.stringify(parent)} not found`)
  const old: string[] = []
  nodes.forEach(node => collectIds(node, old))
  const map = remapIds(old, () => ids.next())
  return renameScopeKeys(renameIds(nodes, map), new Set(scopeKeys(document, scope)))
}
