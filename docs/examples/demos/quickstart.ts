/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 快速开始：把联系人表单交给 <xh-form-renderer> 渲染，点提交时校验，通过后显示交出来的表单数据。

// #region setup
import type { FormRendererEventMap } from '@xihan-form/runtime'
import { defineFormRenderer } from '@xihan-form/runtime'
import { schema, values } from '../templates/contact'
import '@xihan-ui/styles/index.css'
import '@xihan-form/runtime/style.css'

defineFormRenderer()
// #endregion setup

export function mount(host: HTMLElement): () => void {
  const output = document.createElement('pre')

  // #region render
  const renderer = document.createElement('xh-form-renderer')
  renderer.schema = schema
  renderer.values = values
  renderer.addEventListener('submit', (event: Event) => {
    const { values } = (event as FormRendererEventMap['submit']).detail
    output.textContent = JSON.stringify(values, null, 2)
  })
  renderer.addEventListener('invalid', (event) => {
    const { issues } = (event as FormRendererEventMap['invalid']).detail
    output.textContent = `还有 ${issues.length} 处没填对`
  })
  // #endregion render

  // #region submit
  const submit = document.createElement('button')
  submit.type = 'button'
  submit.textContent = '提交'
  submit.addEventListener('click', () => renderer.submit())
  // #endregion submit

  host.append(renderer, submit, output)
  return () => host.replaceChildren()
}
