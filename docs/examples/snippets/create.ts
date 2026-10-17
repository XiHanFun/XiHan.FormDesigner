/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 用代码拼模板：按种类新建节点会带上属性的缺省值与一个区域模板，再自检一遍。

import type { FieldNode, FormDocument } from '@xihan-form/core'
import { createDocument, createFormModel, createNode, validateDocument } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'

// #region create
const { registry } = createFormModel()
const ids = createIdAllocator('n')

const name = createNode(registry, 'text', ids, { key: 'name' }) as FieldNode
const document: FormDocument = {
  ...createDocument(),
  children: [
    { ...name, basic: { ...name.basic, label: '姓名' }, validation: [{ id: ids.next(), kind: 'required' }] },
  ],
}

const issues = validateDocument(document)
// #endregion create

export { document, issues }
