/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 通用遍历：只认节点的区域，不认容器种类。

import type { ContainerNode, FormDocument, FormNode, Region } from './schema'
import { isPlainObject } from '@xihan-ui/core/json'

/** 节点在树里的位置：所在区域（文档顶层为 `null`）与下标。 */
export interface NodeLocation {
  readonly region: string | null
  readonly index: number
}

/** 遍历时传给访问函数的上下文。 */
export interface VisitContext {
  /** 从顶层到父容器的容器链。 */
  readonly ancestors: readonly ContainerNode[]
  /** 所在区域，文档顶层为 `null`。 */
  readonly region: Region | null
  readonly index: number
}

/** 访问函数返回 `false` 时不再进入该节点的子节点。 */
export type NodeVisitor = (node: FormNode, context: VisitContext) => boolean | void

function visitList(children: readonly FormNode[], region: Region | null, ancestors: readonly ContainerNode[], visit: NodeVisitor): void {
  children.forEach((node, index) => {
    const descend = visit(node, { ancestors, region, index })
    if (descend === false || node.type !== 'container')
      return
    const chain = [...ancestors, node]
    for (const child of node.regions)
      visitList(child.children, child, chain, visit)
  })
}

/** 按文档顺序深度优先访问全部节点。 */
export function walkNodes(document: FormDocument, visit: NodeVisitor): void {
  visitList(document.children, null, [], visit)
}

/** 节点的查找结果。 */
export interface FoundNode extends VisitContext {
  readonly node: FormNode
}

/** 按 id 查节点；找不到返回 `undefined`。 */
export function findNode(document: FormDocument, nodeId: string): FoundNode | undefined {
  let found: FoundNode | undefined
  walkNodes(document, (node, context) => {
    if (found !== undefined)
      return false
    if (node.id === nodeId)
      found = { node, ...context }
    return found === undefined
  })
  return found
}

/** 区域的查找结果：所在容器、容器链与区域下标。 */
export interface FoundRegion {
  readonly region: Region
  readonly container: ContainerNode
  readonly ancestors: readonly ContainerNode[]
  readonly index: number
}

/** 按 id 查区域；找不到返回 `undefined`。 */
export function findRegion(document: FormDocument, regionId: string): FoundRegion | undefined {
  let found: FoundRegion | undefined
  walkNodes(document, (node, context) => {
    if (found !== undefined)
      return false
    if (node.type === 'container') {
      const index = node.regions.findIndex(region => region.id === regionId)
      if (index !== -1)
        found = { region: node.regions[index]!, container: node, ancestors: context.ancestors, index }
    }
    return found === undefined
  })
  return found
}

/** 节点自身及全部后代。 */
export function descendantsOf(node: FormNode): FormNode[] {
  const out: FormNode[] = [node]
  if (node.type === 'container') {
    for (const region of node.regions) {
      for (const child of region.children)
        out.push(...descendantsOf(child))
    }
  }
  return out
}

/** 把节点、区域、规则里的全部 id 按出现顺序收进 out；不是对象的值跳过。 */
export function collectIds(value: unknown, out: string[]): void {
  if (!isPlainObject(value))
    return
  if (typeof value.id === 'string')
    out.push(value.id)
  for (const key of ['regions', 'children', 'validation', 'linkage']) {
    const list = value[key]
    if (Array.isArray(list))
      list.forEach(item => collectIds(item, out))
  }
}

/** 文档里已用的全部 id：节点、区域与规则共用一个命名空间。 */
export function collectDocumentIds(document: FormDocument): Set<string> {
  const out: string[] = []
  document.children.forEach(node => collectIds(node, out))
  return new Set(out)
}
