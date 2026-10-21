/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 设计器：打开出差申请，工具栏末尾加上保存，模板标题放在菜单栏正中，保存状态写在状态栏右端；按 Ctrl / ⌘ + S 或点保存时宿主「存」好模板，再告诉设计器已保存。

// #region setup
import type { FormDocument } from '@xihan-form/core'
import type { FormDesignerEventMap } from '@xihan-form/designer'
import { defineFormDesigner, FORM_TOOLBAR_LAYOUT } from '@xihan-form/designer'
import { schema, values } from '../templates/travel'
import '@xihan-ui/styles/index.css'
import '@xihan-ui/designer-shell/style.css'
import '@xihan-form/runtime/style.css'
import '@xihan-form/designer/style.css'

defineFormDesigner()
// #endregion setup

export function mount(host: HTMLElement): () => void {
  // 模板标题是设计器的子元素 slot="menubar-center"，显示在菜单栏正中；保存状态是 slot="status-end"，显示在状态栏右端
  const title = document.createElement('span')
  title.slot = 'menubar-center'
  title.textContent = '出差申请'
  const status = document.createElement('span')
  status.slot = 'status-end'
  status.textContent = '没有修改'

  // #region render
  const designer = document.createElement('xh-form-designer')
  designer.schema = schema
  designer.previewValues = values
  designer.commandLayout = { toolbar: [...FORM_TOOLBAR_LAYOUT, ['save']] }
  // #endregion render
  // 文档页里不自动开始新手引导
  designer.autoTour = false

  // #region save
  let saved: FormDocument = schema
  designer.addEventListener('dirty-change', (event) => {
    status.textContent = (event as FormDesignerEventMap['dirty-change']).detail.dirty ? '有未保存的修改' : `已保存，共 ${saved.children.length} 个顶层节点`
  })
  designer.addEventListener('save', () => {
    // 这里由宿主把模板存进数据库或文件
    saved = designer.schema
    designer.markSaved()
  })
  // #endregion save

  designer.append(title, status)
  host.append(designer)
  return () => host.replaceChildren()
}
