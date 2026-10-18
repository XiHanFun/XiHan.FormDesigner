/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 冒烟页面：照文档站快速开始与设计器一页的接法，注册渲染器与设计器、引入样式、切换语言，把同一份模板交给两者。

import type { FieldNode } from '@xihan-form/core'
import { createDocument, createFormModel, createNode } from '@xihan-form/core'
import { defineFormDesigner } from '@xihan-form/designer'
import { defineFormRenderer } from '@xihan-form/runtime'
import { formZhCN } from '@xihan-form/runtime/locale'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { mergeXhConfig, setXhConfig } from '@xihan-ui/web-components'
import { zhCN } from '@xihan-ui/web-components/locale'
import '@xihan-ui/styles/index.css'
import '@xihan-ui/designer-shell/style.css'
import '@xihan-form/runtime/style.css'
import '@xihan-form/designer/style.css'

setXhConfig(mergeXhConfig(zhCN, formZhCN))
defineFormRenderer()
defineFormDesigner()

const { registry } = createFormModel()
const ids = createIdAllocator('n')
const name = createNode(registry, 'text', ids, { key: 'name' }) as FieldNode
const schema = { ...createDocument(), children: [{ ...name, basic: { ...name.basic, label: '姓名' } }] }

const renderer = document.createElement('xh-form-renderer')
renderer.schema = schema
renderer.values = { name: '张三' }

const designer = document.createElement('xh-form-designer')
designer.schema = schema
designer.previewValues = { name: '张三' }
designer.addEventListener('schema-change', () => void designer.schema)

document.body.append(renderer, designer)
