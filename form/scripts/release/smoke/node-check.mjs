/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 冒烟的 Node 侧：core 不碰 DOM，在 Node 里建一份模板并校验，没有 error 级问题即通过。
import { createDocument, createFormModel, createNode, validateDocument } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'

const { registry } = createFormModel()
const ids = createIdAllocator('n')
const name = createNode(registry, 'text', ids, { key: 'name' })
const document = { ...createDocument(), children: [{ ...name, validation: [{ id: ids.next(), kind: 'required' }] }] }
const errors = validateDocument(document).filter(issue => (issue.severity ?? 'error') === 'error')
if (errors.length > 0) {
  console.error('[smoke] ✗ Node 里建的模板校验不通过：', errors)
  process.exit(1)
}
console.log('[smoke] Node 侧：@xihan-form/core 导入、建模板与校验正常')
