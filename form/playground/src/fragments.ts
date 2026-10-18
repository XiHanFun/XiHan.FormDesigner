/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 开发预览用的扩展：「常用片段」面板。条目按住拖到画布上，或点按插到选中节点之后，按粘贴的规则换 id 插入一组字段。

import type { FieldNode } from '@xihan-form/core'
import type { FormDesignerExtension, FormPalettePayload } from '@xihan-form/designer'
import type { DesignerPaletteEventMap, DesignerPaletteGroup, DesignerPaletteItem, XhDesignerPaletteElement } from '@xihan-ui/designer-shell'
import { createFormModel, createNode } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'

function fragmentGroups(): DesignerPaletteGroup[] {
  const registry = createFormModel().registry
  const ids = createIdAllocator('fragment')
  const field = (kind: string, key: string, label: string): FieldNode => {
    const node = createNode(registry, kind, ids, { key }) as FieldNode
    return { ...node, basic: { ...node.basic, label } }
  }
  const item = (id: string, label: string, nodes: FieldNode[]): DesignerPaletteItem => ({ id, label, payload: { clipboard: { nodes } } satisfies FormPalettePayload })
  return [{
    id: 'fields',
    label: '字段组',
    items: [
      item('contact', '联系人', [field('text', 'contactName', '联系人'), field('text', 'contactPhone', '联系电话')]),
      item('address', '地址', [field('text', 'province', '省份'), field('text', 'city', '城市'), field('textarea', 'street', '详细地址')]),
    ],
  }]
}

/** 「常用片段」面板：放在物料下面，画成带标题与帮助的卡片，可从工具栏的「面板」菜单开关。 */
export const fragmentLibrary: FormDesignerExtension = {
  id: '@xihan-form/playground/fragments',
  panels: [{
    region: { name: 'fragments', position: 'start', title: '常用片段', help: '常用的几组字段：拖到画布上，或点一下插到选中节点之后。' },
    create: ({ designer }) => {
      const element = designer.ownerDocument.createElement('xh-designer-palette') as XhDesignerPaletteElement
      element.headless = true
      element.groups = fragmentGroups()
      element.addEventListener('item-activate', (event) => {
        event.stopPropagation()
        const payload = (event as DesignerPaletteEventMap['item-activate']).detail.payload as FormPalettePayload
        if ('clipboard' in payload)
          designer.paste(payload.clipboard)
      })
      return {
        element,
        update: (context) => {
          element.readonly = context.designer.readonly === true
        },
      }
    },
  }],
}
