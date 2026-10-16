/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 属性面板的数据：把当前选择换成 <xh-designer-properties> 的编辑对象，把面板的写入换成编辑操作，
// 把模板结构问题落到面板的字段上。节点的属性路径带分组前缀，如 ['basic', 'label']；数据键是 ['key']。

import type { FormDocument, FormNode, FormOperation, FormPropertyDescriptor, FormSchemaIssue, KindRegistry, PropertyGroup } from '@xihan-form/core'
import type { JsonPath, JsonValue } from '@xihan-ui/core/json'
import type { DesignerPropertyDescriptor, DesignerPropertyEditor, DesignerPropertyError, DesignerPropertyTarget, DesignerPropertyTargetRef } from '@xihan-ui/designer-shell'
import type { FormSelection } from './editor'
import { findNode, findRegion, FORM_SETTING_PROPERTIES, PROPERTY_GROUPS, propertyName } from '@xihan-form/core'
import { nestProperties } from '@xihan-ui/designer-kit/properties'

/**
 * 宿主的属性编辑器，经 `editors` 压在内建编辑器之上。查找表的路径键带分组前缀（如 `basic.label`、`data.options`），
 * 数据键为 `key`；`byTarget` 的对象种类：节点用种类名，区域用 `region`，表单设置用 `settings`。
 */
export type FormPropertyEditor = DesignerPropertyEditor

/** 属性面板在编辑什么：选中的节点、选中的区域，或什么都没选时的表单设置。 */
export type PropertyScope = 'nodes' | 'regions' | 'settings'

/** 区域作为编辑对象时的种类。 */
export const REGION_TARGET_KIND = 'region'
/** 表单设置作为编辑对象时的种类与 id。 */
export const SETTINGS_TARGET_KIND = 'settings'

/** 查属性名文案用的三段：种类、分组（basic / data / appearance / region / settings）与属性名。 */
export interface PropertyName {
  readonly kind: string
  readonly group: string
  readonly name: string
}

/** 一次选择对应的面板内容。 */
export interface PropertyView {
  readonly scope: PropertyScope
  readonly targets: readonly DesignerPropertyTarget[]
  /** 节点种类与数据键，选中一个节点时才有。 */
  readonly node?: { readonly kind: string, readonly key: string | undefined }
  /** 区域所在容器的种类，选中区域时才有。 */
  readonly container?: string
  /** 面板上的属性描述 → 查文案用的名字。 */
  readonly names: ReadonlyMap<DesignerPropertyDescriptor, PropertyName>
}

const KEY_DESCRIPTOR: DesignerPropertyDescriptor = { path: ['key'], group: 'basic', control: { kind: 'text' }, required: true }

function isGroup(value: unknown): value is PropertyGroup {
  return (PROPERTY_GROUPS as readonly unknown[]).includes(value)
}

function keyOf(node: FormNode): string | undefined {
  return node.type === 'static' ? undefined : node.key
}

/** 把当前选择换成面板的编辑对象：选中节点时按节点，选中区域时按区域，什么都没选时是表单设置。 */
export function propertyView(document: FormDocument, registry: KindRegistry, selection: FormSelection): PropertyView {
  const names = new Map<DesignerPropertyDescriptor, PropertyName>()
  const regions = selection.regions ?? []
  if (regions.length > 0) {
    const found = regions.map(id => findRegion(document, id)).filter(item => item !== undefined)
    const definition = found[0] === undefined ? undefined : registry.get(found[0].container.kind)
    const descriptors = definition?.type === 'container' ? definition.regionProperties : []
    const targets = found.map(({ region, container }) => {
      const own = descriptors.map(descriptor => ({ ...descriptor }))
      own.forEach(descriptor => names.set(descriptor, { kind: container.kind, group: 'region', name: propertyName(descriptor) }))
      return { kind: REGION_TARGET_KIND, id: region.id, value: region.props, descriptors: own }
    })
    return { scope: 'regions', targets, container: found[0]?.container.kind, names }
  }
  const nodes = selection.nodes.map(id => findNode(document, id)?.node).filter(node => node !== undefined)
  if (nodes.length > 0) {
    const single = nodes.length === 1
    const targets = nodes.map((node) => {
      const definition = registry.get(node.kind)
      const key = keyOf(node)
      const descriptors: DesignerPropertyDescriptor[] = []
      if (single && key !== undefined) {
        const own = { ...KEY_DESCRIPTOR }
        names.set(own, { kind: node.kind, group: 'basic', name: 'key' })
        descriptors.push(own)
      }
      for (const group of PROPERTY_GROUPS) {
        const own: readonly FormPropertyDescriptor[] = definition?.properties[group] ?? []
        for (const descriptor of nestProperties([group], own)) {
          const nested = { ...descriptor, group }
          names.set(nested, { kind: node.kind, group, name: String(descriptor.path[1]) })
          descriptors.push(nested)
        }
      }
      const value: Record<string, JsonValue> = { basic: node.basic, data: node.data, appearance: node.appearance }
      if (key !== undefined)
        value.key = key
      return { kind: node.kind, id: node.id, value, descriptors }
    })
    return { scope: 'nodes', targets, node: single ? { kind: nodes[0]!.kind, key: keyOf(nodes[0]!) } : undefined, names }
  }
  const descriptors = FORM_SETTING_PROPERTIES.map(descriptor => ({ ...descriptor }))
  descriptors.forEach(descriptor => names.set(descriptor, { kind: '', group: 'settings', name: propertyName(descriptor) }))
  return { scope: 'settings', targets: [{ kind: SETTINGS_TARGET_KIND, id: SETTINGS_TARGET_KIND, value: document.settings, descriptors }], names }
}

/** 把面板的一次写入换成编辑操作：每个对象各写一份；路径不认识时为空。 */
export function propertyOperations(scope: PropertyScope, path: JsonPath, value: JsonValue | undefined, targets: readonly DesignerPropertyTargetRef[]): FormOperation[] {
  switch (scope) {
    case 'nodes': {
      if (path.length === 1 && path[0] === 'key')
        return targets.map(target => ({ type: 'setKey', nodeId: target.id, key: typeof value === 'string' ? value : '' }))
      const [group, name] = path
      if (path.length !== 2 || !isGroup(group) || typeof name !== 'string')
        return []
      return targets.map(target => ({ type: 'setProperty', nodeId: target.id, group, name, value }))
    }
    case 'regions':
      return path.length === 1 && typeof path[0] === 'string' ? targets.map(target => ({ type: 'setRegionProperty', regionId: target.id, name: path[0] as string, value })) : []
    case 'settings':
      return path.length === 1 && typeof path[0] === 'string' ? [{ type: 'setSetting', name: path[0], value }] : []
  }
}

/** 文档里每个节点与区域的路径，写法与模板结构问题的 path 相同。 */
function locations(document: FormDocument): Map<string, JsonPath> {
  const out = new Map<string, JsonPath>()
  const visit = (children: readonly FormNode[], base: JsonPath): void => {
    children.forEach((node, index) => {
      const path = [...base, 'children', index]
      out.set(node.id, path)
      if (node.type !== 'container')
        return
      node.regions.forEach((region, regionIndex) => {
        const regionPath = [...path, 'regions', regionIndex]
        out.set(region.id, regionPath)
        visit(region.children, regionPath)
      })
    })
  }
  visit(document.children, [])
  return out
}

function startsWith(path: JsonPath, prefix: JsonPath): boolean {
  return prefix.length <= path.length && prefix.every((segment, index) => path[index] === segment)
}

/** 面板上的路径：问题落在属性值里面时取到属性这一层。 */
function fieldPath(scope: PropertyScope, rest: JsonPath): JsonPath | undefined {
  if (scope === 'nodes') {
    if (rest[0] === 'key')
      return ['key']
    return isGroup(rest[0]) && rest.length >= 2 ? rest.slice(0, 2) : undefined
  }
  if (scope === 'regions')
    return rest[0] === 'props' && rest.length >= 2 ? rest.slice(1, 2) : undefined
  return rest.length >= 1 ? rest.slice(0, 1) : undefined
}

/** 把模板结构问题里落在当前编辑对象属性上的那些，换成面板字段上的错误。 */
export function propertyErrors(
  document: FormDocument,
  view: PropertyView,
  issues: readonly FormSchemaIssue[],
  message: (issue: FormSchemaIssue) => string,
): DesignerPropertyError[] {
  if (issues.length === 0)
    return []
  const paths = view.scope === 'settings' ? undefined : locations(document)
  const errors: DesignerPropertyError[] = []
  for (const target of view.targets) {
    const ref = { kind: target.kind, id: target.id }
    const base = paths === undefined ? ['settings'] : paths.get(target.id)
    if (base === undefined)
      continue
    for (const issue of issues) {
      const owner = issue.target?.id
      if (view.scope !== 'settings' && owner !== target.id)
        continue
      if (!startsWith(issue.path, base))
        continue
      const path = fieldPath(view.scope, issue.path.slice(base.length))
      if (path !== undefined)
        errors.push({ target: ref, path, message: message(issue) })
    }
  }
  return errors
}
