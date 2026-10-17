/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 文件字段：`xh-file-upload`，表单值是附件记录 `{ id, name, size?, type?, url? }[]`，即 UI 的 remoteFiles；
// 上传交给宿主的 uploadFile，返回带 id 的结果后文件转成附件记录，经 remote-files-change 写回字段值。

import type { JsonValue } from '@xihan-ui/core/json'
import type { FileUploadRemoteFile, FileUploadRequest } from '@xihan-ui/headless'
import type { FieldRenderer, FieldRendererContext } from '../types'
import type { ContextRef } from './shared'
import { jsonEquals } from '@xihan-ui/core/json'
import { assign, host, make, numberOf, stringOf, text } from '../dom'
import { on, paintCommon } from './shared'

/** 字段值里的附件记录；缺 id 或 name 的项不算附件。 */
function recordsOf(value: JsonValue | undefined): FileUploadRemoteFile[] {
  if (!Array.isArray(value))
    return []
  return value.flatMap((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item) || typeof item.id !== 'string' || typeof item.name !== 'string')
      return []
    const record: FileUploadRemoteFile = { id: item.id, name: item.name }
    if (typeof item.size === 'number')
      record.size = item.size
    if (typeof item.type === 'string')
      record.type = item.type
    if (typeof item.url === 'string')
      record.url = item.url
    return [record]
  })
}

/** 附件记录写成 JSON：没有的键不写。 */
function valueOf(files: readonly FileUploadRemoteFile[]): JsonValue {
  return files.map((file) => {
    const record: Record<string, JsonValue> = { id: file.id, name: file.name }
    if (file.size !== undefined)
      record.size = file.size
    if (file.type !== undefined)
      record.type = file.type
    if (file.url !== undefined)
      record.url = file.url
    return record
  })
}

/** 列表里的一行：缩略图位、文件名、大小、进度与删除钮，文字与可及名由元素填入。 */
function itemRow(doc: Document): HTMLElement {
  const item = make(doc, 'div', 'item')
  const remove = make(doc, 'button', 'item-delete-trigger', { type: 'button' })
  item.append(make(doc, 'span', 'item-preview'), make(doc, 'span', 'item-name'), make(doc, 'span', 'item-size-text'), make(doc, 'div', 'item-progress'), remove)
  return item
}

/** 文件：`xh-file-upload`，类型与个数取 `accept`、`maxFiles`；附件在前、待传的本地文件在后，同列一行一个。 */
export const fileField: FieldRenderer = (context) => {
  const doc = context.document
  const element = host(doc, 'xh-file-upload')
  const root = make(doc, 'div', 'root')
  const dropzone = make(doc, 'div', 'dropzone')
  const trigger = make(doc, 'button', 'trigger', { type: 'button' })
  const actions = make(doc, 'div')
  actions.append(trigger)
  const list = make(doc, 'div', 'list')
  root.append(dropzone, actions, make(doc, 'input', 'hidden-input'), list)
  element.append(root)
  const data = context.node.data
  assign(element, 'accept', stringOf(data.accept))
  assign(element, 'maxFiles', numberOf(data.maxFiles))
  const ref: ContextRef = { current: context }
  let records: FileUploadRemoteFile[] = []
  let recorded: JsonValue | undefined
  let pending = 0
  const upload = (request: FileUploadRequest): ReturnType<NonNullable<FieldRendererContext['uploadFile']>> => ref.current.uploadFile?.(request)
  const layout = (): void => {
    const count = records.length + pending
    while (list.children.length < count)
      list.append(itemRow(doc))
    while (list.children.length > count)
      list.lastElementChild!.remove()
  }
  on<{ files: File[] }>(element, 'files-change', (detail) => {
    pending = detail.files.length
    layout()
  })
  on<{ files: FileUploadRemoteFile[] }>(element, 'remote-files-change', detail => ref.current.setValue(valueOf(detail.files)))
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next)
    text(dropzone, next.translations.fileDropzone)
    text(trigger, next.translations.fileTrigger)
    assign(element, 'upload', next.uploadFile === undefined ? undefined : upload)
    if (recorded === undefined || !jsonEquals(recorded, next.value ?? null)) {
      recorded = next.value ?? null
      records = recordsOf(next.value)
      assign(element, 'remoteFiles', records)
      layout()
    }
  }
  update(context)
  return { element, update }
}
