/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单的剪贴板数据：被复制的节点，经 designer-kit 的剪贴板包序列化成 JSON 文本，读出时按 schema 自校验。

import type { FormNode, KindRegistry } from '@xihan-form/core'
import type { JsonValue } from '@xihan-ui/core/json'
import type { FormClipboard } from './editor'
import { createDocument, validateDocument } from '@xihan-form/core'
import { isPlainObject } from '@xihan-ui/core/json'
import { clipboardMimeType, decodeClipboard, encodeClipboard } from '@xihan-ui/designer-kit'
import { hasErrors } from '@xihan-ui/designer-kit/schema'

/** 剪贴板包上的产品名。 */
const PRODUCT = 'form'
/** 载荷的结构版本。 */
const VERSION = 1

/** 把剪贴板内容序列化成剪贴板包的 JSON 文本。 */
export function encodeFormClipboard(clipboard: FormClipboard): string {
  return encodeClipboard(PRODUCT, VERSION, { nodes: clipboard.nodes } as unknown as JsonValue)
}

/**
 * 解析剪贴板文本：不是表单的剪贴板包、版本不认得、节点结构不合法、种类没有在 registry 登记、id 重复时返回 undefined。
 * 节点之间重名的数据键照样读出，粘贴时改开。
 */
export function decodeFormClipboard(text: string, registry: KindRegistry): FormClipboard | undefined {
  const decoded = decodeClipboard(text, PRODUCT)
  if (!decoded.ok || decoded.version !== VERSION || !isPlainObject(decoded.payload) || !Array.isArray(decoded.payload.nodes))
    return undefined
  const nodes = decoded.payload.nodes as unknown as readonly FormNode[]
  if (nodes.length === 0)
    return undefined
  const issues = validateDocument({ ...createDocument(), children: nodes }, registry, { severity: { 'duplicate-key': 'off' } })
  return hasErrors(issues) ? undefined : { nodes }
}

/** 把剪贴板内容写进剪贴板事件的数据：表单自己的类型一份，text/plain 一份。 */
export function writeFormClipboard(data: DataTransfer, clipboard: FormClipboard): void {
  const text = encodeFormClipboard(clipboard)
  data.setData(clipboardMimeType(PRODUCT), text)
  data.setData('text/plain', text)
}

/** 从剪贴板事件的数据里读出表单的剪贴板内容：先取表单自己的类型，没有再取 text/plain。 */
export function readFormClipboard(data: DataTransfer, registry: KindRegistry): FormClipboard | undefined {
  const text = data.getData(clipboardMimeType(PRODUCT)) || data.getData('text/plain')
  return text === '' ? undefined : decodeFormClipboard(text, registry)
}
