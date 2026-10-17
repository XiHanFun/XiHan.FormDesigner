/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 校验与联动：报销单的显示与必填随类型切换，小计与合计随明细算出，合计超过宿主给的限额时事由变成必填。

import type { FormRendererEventMap } from '@xihan-form/runtime'
import { defineFormRenderer } from '@xihan-form/runtime'
import { schema, values, variables } from '../templates/expense'

defineFormRenderer()

export function mount(host: HTMLElement): () => void {
  const output = document.createElement('pre')
  // #region render
  const renderer = document.createElement('xh-form-renderer')
  renderer.schema = schema
  renderer.values = values
  renderer.variables = variables
  // #endregion render
  renderer.addEventListener('submit', (event: Event) => {
    output.textContent = JSON.stringify((event as FormRendererEventMap['submit']).detail.values, null, 2)
  })
  renderer.addEventListener('invalid', (event) => {
    const { issues } = (event as FormRendererEventMap['invalid']).detail
    output.textContent = issues.map(issue => `${issue.path.join('.')}：${issue.code}`).join('\n')
  })

  const submit = document.createElement('button')
  submit.type = 'button'
  submit.textContent = '提交'
  submit.addEventListener('click', () => renderer.submit())

  host.append(renderer, submit, output)
  return () => host.replaceChildren()
}
