/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 字段渲染器的协议：与 designer-kit 的 PropertyEditor 同构，工厂函数拿到上下文，返回控件节点与更新、销毁钩子。

import type { FieldNode, NodeState } from '@xihan-form/core'
import type { JsonPath, JsonValue } from '@xihan-ui/core/json'
import type { FileUploadRequest, FileUploadResult } from '@xihan-ui/headless'
import type { OptionsState } from '../state/options'
import type { FormRendererTranslations } from '../translations'

/** 字段的尺寸档。 */
export type FieldSize = 'sm' | 'md' | 'lg'

/** 交给宿主上传函数的请求：UI 的单个文件上传请求，加上所属字段。 */
export interface UploadRequest extends FileUploadRequest {
  /** 字段的 `data.uploadTarget`。 */
  readonly target: string | undefined
  readonly nodeId: string
  /** 字段实例的数据路径。 */
  readonly path: JsonPath
}

/** 宿主提供的上传函数：返回带 `id` 的结果时，这个文件转成附件记录写进字段值。 */
export type FileUploader = (request: UploadRequest) => FileUploadResult | undefined | void | Promise<FileUploadResult | undefined | void>

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
  /** 带搜索串重新加载本字段的选项，结果经 `options` 回来；字段没有选项来源或宿主没给 `loadOptions` 时为 `undefined`。 */
  readonly searchOptions: ((query: string) => void) | undefined
  readonly size: FieldSize
  /** 渲染器当前的文案。 */
  readonly translations: FormRendererTranslations
  /** 上传一个文件，请求里已带上本字段；宿主没给 `uploadFile` 时为 `undefined`。 */
  readonly uploadFile: ((request: FileUploadRequest) => ReturnType<FileUploader>) | undefined
  /** 写值，交给控制器的 setValue；值的形状由种类登记的 valueKind 把关，不符时抛 `XH_FORM_RT_INVALID_VALUE`。 */
  readonly setValue: (value: JsonValue) => void
  /** 一次编辑结束（如失焦）。 */
  readonly commit: () => void
}

/** 字段渲染器产出的实例。 */
export interface FieldRendererInstance {
  /** 控件节点：作为 `<xh-field>` 的 control 部件放进字段外壳，标签、提示与错误文案由外壳给出，不必自带。 */
  readonly element: HTMLElement
  /** 值、状态、错误或选项变化时调用。 */
  readonly update?: (context: FieldRendererContext) => void
  /** 节点移除前调用。 */
  readonly destroy?: () => void
}

/** 字段渲染器：按种类登记，渲染器为每个字段实例调用一次。 */
export type FieldRenderer = (context: FieldRendererContext) => FieldRendererInstance
