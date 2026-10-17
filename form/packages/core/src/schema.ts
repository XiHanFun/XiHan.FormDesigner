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
  /** 规则 id，在所在规则列表里唯一；设计器编辑与问题定位都按它找规则。 */
  readonly id: string
  /** 规则种类。 */
  readonly kind: 'required'
  /** 不通过时给最终用户看的提示；不写时由运行时按问题码给出缺省文案。 */
  readonly message?: string
}

/** 必须为 `true`：用于「必须勾选同意」，值为 `false` 或空时都不通过。只适用于布尔值字段。 */
export interface AcceptedRule {
  /** 规则 id，在所在规则列表里唯一；设计器编辑与问题定位都按它找规则。 */
  readonly id: string
  /** 规则种类。 */
  readonly kind: 'accepted'
  /** 不通过时给最终用户看的提示；不写时由运行时按问题码给出缺省文案。 */
  readonly message?: string
}

/** 长度：字符串按字素计（`@xihan-ui/headless` 的 `graphemeLength`，与文本框的字数一致）、列表按元素个数，闭区间。 */
export interface LengthRule {
  /** 规则 id，在所在规则列表里唯一；设计器编辑与问题定位都按它找规则。 */
  readonly id: string
  /** 规则种类。 */
  readonly kind: 'length'
  /** 最少多少个字符或元素。 */
  readonly min?: number
  /** 最多多少个字符或元素。 */
  readonly max?: number
  /** 不通过时给最终用户看的提示；不写时由运行时按问题码给出缺省文案。 */
  readonly message?: string
}

/** 数值范围，闭区间。 */
export interface RangeRule {
  /** 规则 id，在所在规则列表里唯一；设计器编辑与问题定位都按它找规则。 */
  readonly id: string
  /** 规则种类。 */
  readonly kind: 'range'
  /** 下限。 */
  readonly min?: number
  /** 上限。 */
  readonly max?: number
  /** 不通过时给最终用户看的提示；不写时由运行时按问题码给出缺省文案。 */
  readonly message?: string
}

/** 正则：`flags` 只允许 `i`、`m`、`s`、`u`，整串不匹配即不通过。 */
export interface PatternRule {
  /** 规则 id，在所在规则列表里唯一；设计器编辑与问题定位都按它找规则。 */
  readonly id: string
  /** 规则种类。 */
  readonly kind: 'pattern'
  /** 正则的源码，不带两边的斜杠。 */
  readonly pattern: string
  /** 正则标志。 */
  readonly flags?: string
  /** 不通过时给最终用户看的提示；不写时由运行时按问题码给出缺省文案。 */
  readonly message?: string
}

/** 表达式：结果为 `false` 时不通过，为 `true` 或 `null` 时通过。 */
export interface ExpressionRule {
  /** 规则 id，在所在规则列表里唯一；设计器编辑与问题定位都按它找规则。 */
  readonly id: string
  /** 规则种类。 */
  readonly kind: 'expression'
  /** 受限表达式，`$value` 是字段自己的值。 */
  readonly expression: string
  /** 不通过时给最终用户看的提示；不写时由运行时按问题码给出缺省文案。 */
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
  /** 规则 id，在所在规则列表里唯一。 */
  readonly id: string
  /** 条件成立时做什么。 */
  readonly action: LinkageAction
  /** 条件，受限表达式，结果为 `true` 时成立；缺省总是成立。 */
  readonly when?: string
  /** `assign` 的取值，受限表达式；其它动作不用。 */
  readonly value?: string
}

/** 字段：有数据键与值。 */
export interface FieldNode {
  /** 节点类型。 */
  readonly type: 'field'
  /** 节点 id，在整份文档里唯一。 */
  readonly id: string
  /** 种类，如 `text`、`select`，决定渲染方式与可用的属性。 */
  readonly kind: string
  /** 数据键：字段的值在表单数据里的键，在所在作用域里唯一。 */
  readonly key: string
  /** 基础属性，如标签、提示、初始值、隐藏与禁用。 */
  readonly basic: PropertyBag
  /** 数据属性，如选项、精度、数据来源。 */
  readonly data: PropertyBag
  /** 外观属性，如尺寸、前后缀。 */
  readonly appearance: PropertyBag
  /** 校验规则。 */
  readonly validation: readonly ValidationRule[]
  /** 联动规则。 */
  readonly linkage: readonly LinkageRule[]
  /** 各扩展放在这个节点上的数据。 */
  readonly extensions?: ExtensionData
}

/** 区域：容器里放子节点的一格，如栅格的一列、标签页的一页、表格布局的一个单元格。 */
export interface Region {
  /** 区域 id，在整份文档里唯一。 */
  readonly id: string
  /** 区域属性，如栅格的列宽、标签页的标题、表格布局单元格的位置。 */
  readonly props: PropertyBag
  /** 放在这一格里的节点。 */
  readonly children: readonly FormNode[]
}

/**
 * 容器：子节点放在区域里。列表作用域的容器（子表单、子表）带 `key`，
 * 它的值是行对象的列表，区域里字段的键相对于行对象。
 */
export interface ContainerNode {
  /** 节点类型。 */
  readonly type: 'container'
  /** 节点 id，在整份文档里唯一。 */
  readonly id: string
  /** 种类，如 `grid`、`subform`，决定渲染方式与可用的属性。 */
  readonly kind: string
  /** 数据键：只有列表容器有，值是行对象的列表。 */
  readonly key?: string
  /** 基础属性，如标签、提示、初始值、隐藏与禁用。 */
  readonly basic: PropertyBag
  /** 数据属性，如选项、精度、数据来源。 */
  readonly data: PropertyBag
  /** 外观属性，如尺寸、前后缀。 */
  readonly appearance: PropertyBag
  /** 校验规则：只对列表容器的整份列表生效。 */
  readonly validation: readonly ValidationRule[]
  /** 联动规则。 */
  readonly linkage: readonly LinkageRule[]
  /** 区域，按顺序排列。 */
  readonly regions: readonly Region[]
  /** 各扩展放在这个节点上的数据。 */
  readonly extensions?: ExtensionData
}

/** 静态元素：只展示，没有值，如分隔线、说明文字。 */
export interface StaticNode {
  /** 节点类型。 */
  readonly type: 'static'
  /** 节点 id，在整份文档里唯一。 */
  readonly id: string
  /** 种类，如 `divider`、`paragraph`，决定渲染方式与可用的属性。 */
  readonly kind: string
  /** 基础属性，如正文、标题文字与隐藏。 */
  readonly basic: PropertyBag
  /** 数据属性。 */
  readonly data: PropertyBag
  /** 外观属性，如级别、宽度。 */
  readonly appearance: PropertyBag
  /** 联动规则：只有显示与隐藏。 */
  readonly linkage: readonly LinkageRule[]
  /** 各扩展放在这个节点上的数据。 */
  readonly extensions?: ExtensionData
}

/** 表单节点。 */
export type FormNode = FieldNode | ContainerNode | StaticNode

/** 节点类型。 */
export type NodeType = FormNode['type']

/** 表单文档：纯 JSON，不含任何代码。 */
export interface FormDocument {
  /** 结构版本，当前是 `FORM_SCHEMA_VERSION`。 */
  readonly schemaVersion: typeof FORM_SCHEMA_VERSION
  /** 表单设置，如标签位置、尺寸、整表禁用与只读。 */
  readonly settings: PropertyBag
  /** 顶层节点，按顺序排列。 */
  readonly children: readonly FormNode[]
  /** 各扩展放在文档上的数据。 */
  readonly extensions?: ExtensionData
}
