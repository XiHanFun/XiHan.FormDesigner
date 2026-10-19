/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 开发预览用的扩展：经物料来源（paletteSources）往物料面板加一组「常用片段」。条目点按插到选中节点之后，
// 拖到画布上就插到放下处，都按粘贴的规则换 id 插入一组字段。只是演示，不进任何发布物。

import type { FieldNode } from '@xihan-form/core'
import type { FormClipboard, FormDesignerExtension } from '@xihan-form/designer'
import type { DesignerPaletteGroup, DesignerPaletteItem } from '@xihan-ui/designer-shell'
import { createFormModel, createNode } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'

/** 片段的分组，第一次用到时建一次。 */
let groups: readonly DesignerPaletteGroup[] | undefined

function fragmentGroups(): readonly DesignerPaletteGroup[] {
  if (groups !== undefined)
    return groups
  const registry = createFormModel().registry
  const ids = createIdAllocator('fragment')
  const field = (kind: string, key: string, label: string): FieldNode => {
    const node = createNode(registry, kind, ids, { key }) as FieldNode
    return { ...node, basic: { ...node.basic, label } }
  }
  const item = (id: string, label: string, nodes: FieldNode[]): DesignerPaletteItem => ({ id, label, payload: { nodes } satisfies FormClipboard })
  groups = [{
    id: 'fragments',
    label: '常用片段',
    items: [
      item('fragment.contact', '联系人', [field('text', 'contactName', '联系人'), field('text', 'contactPhone', '联系电话')]),
      item('fragment.address', '地址', [field('text', 'province', '省份'), field('text', 'city', '城市'), field('textarea', 'street', '详细地址')]),
    ],
  }]
  return groups
}

/** 「常用片段」：物料面板末尾的一组，点按或拖放都由这个来源按粘贴的规则插入。 */
export const fragmentLibrary: FormDesignerExtension = {
  id: '@xihan-form/playground/fragments',
  paletteSources: [{
    id: '@xihan-form/playground/fragments',
    groups: fragmentGroups,
    insert: (item, { designer }, at) => {
      const first = designer.paste(item.payload as FormClipboard, at === undefined ? {} : { at }).nodes[0]
      if (first !== undefined)
        designer.revealNode(first)
    },
  }],
}
