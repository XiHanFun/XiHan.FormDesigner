/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 按原型新建文档、节点与区域；id 一律来自注入的 id 分配器（@xihan-ui/designer-kit 的 IdAllocator）。

import type { IdAllocator } from '@xihan-ui/designer-kit'
import type { ContainerKindDefinition, KindRegistry } from './registry/kinds'
import type { PropertyDescriptor } from './registry/properties'
import type { FormDocument, FormNode, PropertyBag, Region } from './schema'
import { deepFreeze } from '@xihan-ui/core/json'
import { defaultProperties } from './registry/properties'
import { FORM_SCHEMA_VERSION } from './schema'

/** 表单级设置的属性描述。 */
export const FORM_SETTING_PROPERTIES: readonly PropertyDescriptor[] = Object.freeze([
  { name: 'labelPlacement', type: 'enum', choices: ['top', 'start'], default: 'top' },
  { name: 'size', type: 'enum', choices: ['sm', 'md', 'lg'], default: 'md' },
  { name: 'disabled', type: 'boolean', default: false },
  { name: 'readOnly', type: 'boolean', default: false },
])

const KEY_PATTERN = /^[A-Z_]\w*$/i
const RESERVED_KEYS: ReadonlySet<string> = new Set(['true', 'false', 'null', '__proto__', 'constructor', 'prototype'])

/** 字段键是否合法：ASCII 字母或 `_` 开头，后接字母、数字、`_`，不是保留字；`$` 开头的名字留给运行时变量。 */
export function isValidKey(key: string): boolean {
  return KEY_PATTERN.test(key) && !RESERVED_KEYS.has(key)
}

/** 由种类名与 id 派生字段键：种类名转成小驼峰，接 `_` 与 id 里的字母数字。 */
export function deriveKey(kind: string, id: string): string {
  const base = kind.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase())
  return `${base}_${id.replace(/\W/g, '_')}`
}

/** 新建一份空文档。 */
export function createDocument(settings: PropertyBag = {}): FormDocument {
  return deepFreeze({
    schemaVersion: FORM_SCHEMA_VERSION,
    settings: { ...defaultProperties(FORM_SETTING_PROPERTIES), ...settings },
    children: [],
  })
}

/** 按容器种类新建一个区域；`props` 覆盖区域属性的缺省值。 */
export function createRegion(definition: ContainerKindDefinition, ids: IdAllocator, props: PropertyBag = {}): Region {
  return deepFreeze({
    id: ids.next(),
    props: { ...defaultProperties(definition.regionProperties), ...props },
    children: [],
  })
}

/** 新建节点的选项。 */
export interface CreateNodeOptions {
  /** 字段与列表容器的数据键；缺省由种类名与 id 派生。 */
  readonly key?: string
}

/** 按种类原型新建节点；种类没有登记时抛 `TypeError`。 */
export function createNode(registry: KindRegistry, kind: string, ids: IdAllocator, options: CreateNodeOptions = {}): FormNode {
  const definition = registry.get(kind)
  if (definition === undefined)
    throw new TypeError(`没有登记种类 ${kind}`)
  const id = ids.next()
  const groups = {
    basic: defaultProperties(definition.properties.basic),
    data: defaultProperties(definition.properties.data),
    appearance: defaultProperties(definition.properties.appearance),
  }
  switch (definition.type) {
    case 'field':
      return deepFreeze({ type: 'field', id, kind, key: options.key ?? deriveKey(kind, id), ...groups, validation: [], linkage: [] })
    case 'static':
      return deepFreeze({ type: 'static', id, kind, ...groups, linkage: [] })
    case 'container': {
      const regions = definition.regions.initial.map(props => createRegion(definition, ids, props))
      const key = definition.scope === 'list' ? { key: options.key ?? deriveKey(kind, id) } : {}
      return deepFreeze({ type: 'container', id, kind, ...key, ...groups, validation: [], linkage: [], regions })
    }
  }
}
