/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 文件字段：只建 `xh-file-upload` 宿主，投放区、表单影子与按文件铺的每一行都由元素按标准结构生成。
// 表单值是附件记录 `{ id, name, size?, type?, url? }[]`，即 UI 的 remoteFiles；
// 上传交给宿主的 uploadFile，返回带 id 的结果后文件转成附件记录，经 remote-files-change 写回字段值。

import type { JsonValue } from '@xihan-ui/core/json'
import type { FileUploadRemoteFile, FileUploadRequest } from '@xihan-ui/headless'
import type { FieldRenderer, FieldRendererContext } from '../types'
import type { ContextRef } from './shared'
import { jsonEquals } from '@xihan-ui/core/json'
import { assign, host, numberOf, stringOf } from '../dom'
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

/** 文件：`xh-file-upload`，类型与个数取 `accept`、`maxFiles`；投放区的说明取表单语言包的 fileDropzone。 */
export const fileField: FieldRenderer = (context) => {
  const element = host(context.document, 'xh-file-upload')
  const data = context.node.data
  assign(element, 'accept', stringOf(data.accept))
  assign(element, 'maxFiles', numberOf(data.maxFiles))
  const ref: ContextRef = { current: context }
  let recorded: JsonValue | undefined
  let dropzone: string | undefined
  const upload = (request: FileUploadRequest): ReturnType<NonNullable<FieldRendererContext['uploadFile']>> => ref.current.uploadFile?.(request)
  on<{ files: FileUploadRemoteFile[] }>(element, 'remote-files-change', detail => ref.current.setValue(valueOf(detail.files)))
  const update = (next: FieldRendererContext): void => {
    ref.current = next
    paintCommon(element, next)
    if (next.translations.fileDropzone !== dropzone) {
      dropzone = next.translations.fileDropzone
      assign(element, 'translations', { dropzone })
    }
    assign(element, 'upload', next.uploadFile === undefined ? undefined : upload)
    if (recorded === undefined || !jsonEquals(recorded, next.value ?? null)) {
      recorded = next.value ?? null
      assign(element, 'remoteFiles', recordsOf(next.value))
    }
  }
  update(context)
  return { element, update }
}
