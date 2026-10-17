import type { ContainerNode, FieldNode, FormDocument, FormNode, KindRegistry, LinkageRule, Region, ValidationRule } from '@xihan-form/core'
import type { IdAllocator } from '@xihan-ui/designer-kit'
import { createDocument, createFormModel, createNode } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'

/** 每个用例一套独立的登记表与 id 来源。 */
export function setup(): { registry: KindRegistry, ids: IdAllocator } {
  return { registry: createFormModel().registry, ids: createIdAllocator('n') }
}

/** 新建字段并指定键，可带校验与联动规则、覆盖部分属性。 */
export function field(
  registry: KindRegistry,
  ids: IdAllocator,
  kind: string,
  key: string,
  extra: { validation?: ValidationRule[], linkage?: LinkageRule[], basic?: Record<string, unknown>, data?: Record<string, unknown> } = {},
): FieldNode {
  const node = createNode(registry, kind, ids, { key }) as FieldNode
  return {
    ...node,
    basic: { ...node.basic, ...extra.basic } as FieldNode['basic'],
    data: { ...node.data, ...extra.data } as FieldNode['data'],
    validation: extra.validation ?? node.validation,
    linkage: extra.linkage ?? node.linkage,
  }
}

/** 新建容器，第一个区域放 `children`。 */
export function container(registry: KindRegistry, ids: IdAllocator, kind: string, children: readonly FormNode[], extra: { key?: string, linkage?: LinkageRule[], basic?: Record<string, unknown>, data?: Record<string, unknown>, validation?: ValidationRule[] } = {}): ContainerNode {
  const node = createNode(registry, kind, ids, extra.key === undefined ? {} : { key: extra.key }) as ContainerNode
  return {
    ...node,
    basic: { ...node.basic, ...extra.basic } as ContainerNode['basic'],
    data: { ...node.data, ...extra.data } as ContainerNode['data'],
    validation: extra.validation ?? node.validation,
    linkage: extra.linkage ?? node.linkage,
    regions: node.regions.map((region, index): Region => (index === 0 ? { ...region, children } : region)),
  }
}

/** 以给定的顶层节点组成文档。 */
export function documentOf(children: readonly FormNode[]): FormDocument {
  return { ...createDocument(), children }
}
