/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单文档的数据结构：节点、区域、校验规则与联动规则，以及各扩展放在文档与节点上的数据。

import type { JsonObject, JsonValue } from '@xihan-ui/core/json'

/** 属性包：一组按名字存放的 JSON 值。 */
export type PropertyBag = Readonly<Record<string, JsonValue>>

/** 扩展数据：扩展 id → 这个扩展自己的 JSON 对象。只给扩展用，与业务属性分开；编辑与复制粘贴原样带着走。 */
export type ExtensionData = Readonly<Record<string, JsonObject>>

/** 当前的文档结构版本。 */
export const FORM_SCHEMA_VERSION = 1

/** 节点的属性分组：基础、数据、外观。校验与联动另以规则列表存放。 */
export type PropertyGroup = 'basic' | 'data' | 'appearance'

/** 全部属性分组。 */
export const PROPERTY_GROUPS: readonly PropertyGroup[] = ['basic', 'data', 'appearance']

/**
 * 必填：值为空时不通过，空值判定取 `@xihan-ui/headless` 的 `isEmptyFormValue`：
 * null、只含空白的字符串、空列表与元素全为空的列表算空，`false` 与 `0` 不算空。
 */
export interface RequiredRule {
  readonly id: string
  readonly kind: 'required'
  readonly message?: string
}

/** 必须为 `true`：用于「必须勾选同意」，值为 `false` 或空时都不通过。只适用于布尔值字段。 */
export interface AcceptedRule {
  readonly id: string
  readonly kind: 'accepted'
  readonly message?: string
}

/** 长度：字符串按字素计（`@xihan-ui/headless` 的 `graphemeLength`，与文本框的字数一致）、列表按元素个数，闭区间。 */
export interface LengthRule {
  readonly id: string
  readonly kind: 'length'
  readonly min?: number
  readonly max?: number
  readonly message?: string
}

/** 数值范围，闭区间。 */
export interface RangeRule {
  readonly id: string
  readonly kind: 'range'
  readonly min?: number
  readonly max?: number
  readonly message?: string
}

/** 正则：`flags` 只允许 `i`、`m`、`s`、`u`，整串不匹配即不通过。 */
export interface PatternRule {
  readonly id: string
  readonly kind: 'pattern'
  readonly pattern: string
  readonly flags?: string
  readonly message?: string
}

/** 表达式：结果为 `false` 时不通过，为 `true` 或 `null` 时通过。 */
export interface ExpressionRule {
  readonly id: string
  readonly kind: 'expression'
  readonly expression: string
  readonly message?: string
}

/** 声明式校验规则。`message` 是模板作者写给最终用户的提示，缺省时由运行时按规则种类给出。 */
export type ValidationRule = RequiredRule | AcceptedRule | LengthRule | RangeRule | PatternRule | ExpressionRule

/** 校验规则的种类。 */
export type ValidationKind = ValidationRule['kind']

/**
 * 联动动作：条件成立时生效，不成立时回到节点的静态设定。
 * - `show` / `hide`：显示 / 隐藏。
 * - `enable` / `disable`：可用 / 禁用。
 * - `require` / `optional`：设为必填 / 取消必填。
 * - `assign`：把 `value` 表达式的结果赋给字段。
 */
export type LinkageAction = 'show' | 'hide' | 'enable' | 'disable' | 'require' | 'optional' | 'assign'

/** 声明式联动规则；`when` 缺省表示总是成立。同一状态有多条规则成立时，排在后面的生效。 */
export interface LinkageRule {
  readonly id: string
  readonly action: LinkageAction
  readonly when?: string
  readonly value?: string
}

/** 字段：有数据键与值。 */
export interface FieldNode {
  readonly type: 'field'
  readonly id: string
  readonly kind: string
  readonly key: string
  readonly basic: PropertyBag
  readonly data: PropertyBag
  readonly appearance: PropertyBag
  readonly validation: readonly ValidationRule[]
  readonly linkage: readonly LinkageRule[]
  readonly extensions?: ExtensionData
}

/** 区域：容器里放子节点的一格，如栅格的一列、标签页的一页、表格布局的一个单元格。 */
export interface Region {
  readonly id: string
  readonly props: PropertyBag
  readonly children: readonly FormNode[]
}

/**
 * 容器：子节点放在区域里。列表作用域的容器（子表单、子表）带 `key`，
 * 它的值是行对象的列表，区域里字段的键相对于行对象。
 */
export interface ContainerNode {
  readonly type: 'container'
  readonly id: string
  readonly kind: string
  readonly key?: string
  readonly basic: PropertyBag
  readonly data: PropertyBag
  readonly appearance: PropertyBag
  readonly validation: readonly ValidationRule[]
  readonly linkage: readonly LinkageRule[]
  readonly regions: readonly Region[]
  readonly extensions?: ExtensionData
}

/** 静态元素：只展示，没有值，如分隔线、说明文字。 */
export interface StaticNode {
  readonly type: 'static'
  readonly id: string
  readonly kind: string
  readonly basic: PropertyBag
  readonly data: PropertyBag
  readonly appearance: PropertyBag
  readonly linkage: readonly LinkageRule[]
  readonly extensions?: ExtensionData
}

/** 表单节点。 */
export type FormNode = FieldNode | ContainerNode | StaticNode

/** 节点类型。 */
export type NodeType = FormNode['type']

/** 表单文档：纯 JSON，不含任何代码。 */
export interface FormDocument {
  readonly schemaVersion: typeof FORM_SCHEMA_VERSION
  readonly settings: PropertyBag
  readonly children: readonly FormNode[]
  readonly extensions?: ExtensionData
}
