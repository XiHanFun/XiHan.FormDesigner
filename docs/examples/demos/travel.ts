/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 模板结构：渲染出差申请，下方随改值显示整份表单数据，看清布局容器不占层级、列表容器的值是行的数组。

import type { FormRendererEventMap } from '@xihan-form/runtime'
import { defineFormRenderer } from '@xihan-form/runtime'
import { schema, values } from '../templates/travel'

defineFormRenderer()

export function mount(host: HTMLElement): () => void {
  const output = document.createElement('pre')
  const renderer = document.createElement('xh-form-renderer')
  renderer.addEventListener('ready', () => {
    output.textContent = JSON.stringify(renderer.getFormData(), null, 2)
  })
  renderer.addEventListener('value-change', (event) => {
    output.textContent = JSON.stringify((event as FormRendererEventMap['value-change']).detail.values, null, 2)
  })
  renderer.schema = schema
  renderer.values = values
  host.append(renderer, output)
  return () => host.replaceChildren()
}
