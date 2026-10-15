/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 节点种类登记表：每种字段、容器、静态元素一份原型，驱动物料面板、属性面板与遍历。

import type { JsonValue } from '@xihan-ui/core/json'
import type { IssueParamValue } from '@xihan-ui/designer-kit/schema'
import type { FormSchemaIssueCode } from '../issues'
import type { ContainerNode, LinkageAction, PropertyBag, ValidationKind } from '../schema'
import type { FormPropertyDescriptor, PropertySchema } from './properties'

/**
 * 字段值的形状：
 * - `string` / `number` / `boolean`：标量，空值见各字段种类的 `emptyValue`。
 * - `string-list` / `number-list`：字符串 / 数字数组。
 * - `list`：任意 JSON 数组。
 * - `object`：JSON 对象。
 */
export type ValueKind = 'string' | 'number' | 'boolean' | 'string-list' | 'number-list' | 'list' | 'object'

/** 容器的结构问题，由容器种类自行检查，问题码不带文案：给出 regionId 时落在该区域上，否则落在容器本身。 */
export interface StructureProblem {
  readonly code: FormSchemaIssueCode
  readonly regionId?: string
  readonly params?: Readonly<Record<string, IssueParamValue>>
}

/** 字段种类。 */
export interface FieldKindDefinition {
  readonly type: 'field'
  readonly kind: string
  /** 物料面板里的分组名。 */
  readonly category: string
  /** 运行时缺省使用的 XiHan.UI 元素标签。 */
  readonly element: string
  readonly properties: PropertySchema
  /** 适用的校验规则种类。 */
  readonly validations: readonly ValidationKind[]
  /** 值的形状，可随 `data` 属性变化（如单选与多选）。 */
  readonly valueKind: (data: PropertyBag) => ValueKind
  /** 没有初始值时的空值。 */
  readonly emptyValue: (data: PropertyBag) => JsonValue
}

/** 容器种类。 */
export interface ContainerKindDefinition {
  readonly type: 'container'
  readonly kind: string
  readonly category: string
  readonly element: string
  /** `list`：容器带 `key`，值是行对象的列表；`none`：只管布局，对数据透明。 */
  readonly scope: 'none' | 'list'
  readonly properties: PropertySchema
  readonly regionProperties: readonly FormPropertyDescriptor[]
  /** 区域个数的上下限，`max` 为 `null` 表示不限；`initial` 是新建时各区域的属性。 */
  readonly regions: {
    readonly min: number
    readonly max: number | null
    readonly initial: readonly PropertyBag[]
  }
  /** 区域里能放的节点：`any` 任意，`fields` 只能放字段。 */
  readonly accepts: 'any' | 'fields'
  readonly validations: readonly ValidationKind[]
  /** 种类自己的结构检查，如表格布局的单元格铺排。 */
  readonly check?: (node: ContainerNode) => readonly StructureProblem[]
}

/** 静态元素种类。 */
export interface StaticKindDefinition {
  readonly type: 'static'
  readonly kind: string
  readonly category: string
  readonly element: string
  readonly properties: PropertySchema
}

/** 节点种类。 */
export type KindDefinition = FieldKindDefinition | ContainerKindDefinition | StaticKindDefinition

/** 各类节点可用的联动动作。 */
export const LINKAGE_ACTIONS: Readonly<Record<KindDefinition['type'], readonly LinkageAction[]>> = Object.freeze({
  field: ['show', 'hide', 'enable', 'disable', 'require', 'optional', 'assign'],
  container: ['show', 'hide', 'enable', 'disable'],
  static: ['show', 'hide'],
})

const KIND_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

/** 节点种类登记表。 */
export interface KindRegistry {
  /** 按登记顺序列出全部种类。 */
  readonly list: () => readonly KindDefinition[]
  readonly get: (kind: string) => KindDefinition | undefined
}

/** 创建种类登记表；种类名必须是小写短横线形式且不重复，否则抛 `TypeError`。 */
export function createKindRegistry(definitions: Iterable<KindDefinition>): KindRegistry {
  const entries = new Map<string, KindDefinition>()
  for (const definition of definitions) {
    if (!KIND_NAME.test(definition.kind))
      throw new TypeError(`种类名 ${definition.kind} 必须是小写短横线形式`)
    if (entries.has(definition.kind))
      throw new TypeError(`种类 ${definition.kind} 重复登记`)
    if (definition.type === 'container') {
      const { min, max, initial } = definition.regions
      if (!Number.isSafeInteger(min) || min < 0 || (max !== null && (!Number.isSafeInteger(max) || max < min)))
        throw new TypeError(`容器 ${definition.kind} 的区域个数上下限不合法`)
      if (initial.length < min || (max !== null && initial.length > max))
        throw new TypeError(`容器 ${definition.kind} 的初始区域个数超出上下限`)
    }
    entries.set(definition.kind, Object.freeze(definition))
  }
  const ordered = Object.freeze([...entries.values()])
  return Object.freeze({
    list: () => ordered,
    get: (kind: string) => entries.get(kind),
  })
}
