/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 属性编辑器登记表：按「种类 + 属性名」「属性名」「取值类型」三级查出属性面板用哪个编辑器。

import type { PropertyDescriptor, PropertyType } from './properties'

/** 各取值类型的缺省编辑器 id。 */
export const DEFAULT_EDITORS: Readonly<Record<PropertyType, string>> = Object.freeze({
  'string': 'text',
  'text': 'textarea',
  'number': 'number',
  'integer': 'integer',
  'boolean': 'switch',
  'enum': 'choice',
  'string-list': 'tags',
  'options': 'options',
  'tree-options': 'tree-options',
  'value': 'value',
  'json': 'json',
})

/** 创建编辑器登记表的选项；越具体的一级越优先。 */
export interface EditorRegistryOptions {
  /** 按取值类型覆盖缺省编辑器。 */
  readonly byType?: Partial<Record<PropertyType, string>>
  /** 按属性名指定编辑器，对所有种类生效。 */
  readonly byName?: Readonly<Record<string, string>>
  /** 按种类与属性名指定编辑器，只对该种类生效。 */
  readonly byKind?: Readonly<Record<string, Readonly<Record<string, string>>>>
}

/** 编辑器登记表。 */
export interface EditorRegistry {
  /** 查出某种类的某个属性用哪个编辑器：种类 + 属性名 → 属性名 → 取值类型。 */
  readonly resolve: (kind: string, property: PropertyDescriptor) => string
}

/** 创建编辑器登记表。 */
export function createEditorRegistry(options: EditorRegistryOptions = {}): EditorRegistry {
  const byType: Readonly<Record<PropertyType, string>> = { ...DEFAULT_EDITORS, ...options.byType }
  const byName = new Map(Object.entries(options.byName ?? {}))
  const byKind = new Map(Object.entries(options.byKind ?? {}).map(([kind, names]) => [kind, new Map(Object.entries(names))]))
  return Object.freeze({
    resolve: (kind: string, property: PropertyDescriptor) =>
      byKind.get(kind)?.get(property.name) ?? byName.get(property.name) ?? byType[property.type],
  })
}
