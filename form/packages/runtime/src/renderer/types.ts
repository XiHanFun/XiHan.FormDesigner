/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 字段渲染器的协议：与 designer-kit 的 PropertyEditor 同构，工厂函数拿到上下文，返回控件节点与更新、销毁钩子。

import type { FieldNode, NodeState } from '@xihan-form/core'
import type { JsonPath, JsonValue } from '@xihan-ui/core/json'
import type { OptionsState } from '../state/options'
import type { FormRendererTranslations } from '../translations'

/** 字段的尺寸档。 */
export type FieldSize = 'sm' | 'md' | 'lg'

/** 交给字段渲染器的上下文。 */
export interface FieldRendererContext {
  /** 渲染器所在的文档，建节点用。 */
  readonly document: Document
  readonly node: FieldNode
  /** 字段实例的数据路径。 */
  readonly path: JsonPath
  readonly value: JsonValue | undefined
  /** 联动状态与整表的只读、禁用合并后的结果。 */
  readonly state: NodeState
  /** 当前展示的错误文案；没有错误时为 `undefined`。 */
  readonly error: string | undefined
  /** 选项类字段的选项状态，其余为 `undefined`。 */
  readonly options: OptionsState | undefined
  readonly size: FieldSize
  /** 渲染器当前的文案。 */
  readonly translations: FormRendererTranslations
  /** 写值，交给控制器的 setValue；值的形状由种类登记的 valueKind 把关，不符时抛 `XH_FORM_RT_INVALID_VALUE`。 */
  readonly setValue: (value: JsonValue) => void
  /** 一次编辑结束（如失焦）。 */
  readonly commit: () => void
}

/** 字段渲染器产出的实例。 */
export interface FieldRendererInstance {
  /** 放进字段组的控件节点。 */
  readonly element: HTMLElement
  /** 值、状态、错误或选项变化时调用。 */
  readonly update?: (context: FieldRendererContext) => void
  /** 节点移除前调用。 */
  readonly destroy?: () => void
}

/** 字段渲染器：按种类登记，渲染器为每个字段实例调用一次。 */
export type FieldRenderer = (context: FieldRendererContext) => FieldRendererInstance
