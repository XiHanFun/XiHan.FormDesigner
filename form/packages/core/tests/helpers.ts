import type { ContainerNode, FieldNode, FormDocument, FormNode, IdSource, KindRegistry, Region } from '../src'
import { createBuiltinKindRegistry, createDocument, createNode, createSequentialIds } from '../src'

/** 每个用例一套独立的登记表与 id 来源。 */
export function setup(): { registry: KindRegistry, ids: IdSource } {
  return { registry: createBuiltinKindRegistry(), ids: createSequentialIds() }
}

/** 新建字段并指定键。 */
export function fieldOf(registry: KindRegistry, ids: IdSource, kind: string, key: string): FieldNode {
  return createNode(registry, kind, ids, { key }) as FieldNode
}

/** 新建容器。 */
export function containerOf(registry: KindRegistry, ids: IdSource, kind: string, key?: string): ContainerNode {
  return createNode(registry, kind, ids, key === undefined ? {} : { key }) as ContainerNode
}

/** 换掉容器某个区域的子节点。 */
export function withChildren(container: ContainerNode, regionIndex: number, children: readonly FormNode[]): ContainerNode {
  return {
    ...container,
    regions: container.regions.map((region, index): Region => (index === regionIndex ? { ...region, children } : region)),
  }
}

/** 以给定的顶层节点组成文档。 */
export function documentOf(children: readonly FormNode[]): FormDocument {
  return { ...createDocument(), children }
}
