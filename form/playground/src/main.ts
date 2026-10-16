/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 开发预览页：注册 UI 元素、表单渲染器与设计器，两个页签装上同一份示例报销单，接好工具栏、开关与事件日志。

import type { FormDesignerEventMap } from '@xihan-form/designer'
import type { FormRendererEventMap } from '@xihan-form/runtime'
import { defineFormDesigner } from '@xihan-form/designer'
import { defineFormRenderer } from '@xihan-form/runtime'
import { formZhCN } from '@xihan-form/runtime/locale'
import { mergeXhConfig, setXhConfig } from '@xihan-ui/web-components'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { zhCN } from '@xihan-ui/web-components/locale'
import { expenseForm, loadOptions } from './sample'
import '@xihan-ui/styles/index.css'
import '@xihan-form/runtime/style.css'
import '@xihan-form/designer/style.css'

defineXhElements()
defineFormRenderer()
defineFormDesigner()
setXhConfig(mergeXhConfig(zhCN, formZhCN))

const renderer = document.querySelector('xh-form-renderer')!
const data = document.querySelector<HTMLElement>('#data')!
const log = document.querySelector<HTMLElement>('#log')!

function write(line: string): void {
  log.textContent = `${line}\n${log.textContent ?? ''}`.slice(0, 4000)
}

function showData(): void {
  data.textContent = JSON.stringify(renderer.getFormData(), null, 2)
}

function on<K extends keyof FormRendererEventMap>(type: K, listener: (event: FormRendererEventMap[K]) => void): void {
  renderer.addEventListener(type, event => listener(event as FormRendererEventMap[K]))
}

on('ready', () => {
  write('ready')
  showData()
})
on('schema-error', event => write(`schema-error ${event.detail.code} ${JSON.stringify(event.detail.data)}`))
on('value-change', (event) => {
  write(`value-change ${event.detail.paths.map(path => path.join('.')).join(', ')}`)
  showData()
})
on('issues-change', event => write(`issues-change ${event.detail.issues.map(issue => `${issue.path.join('.')}:${issue.code}`).join(', ') || '无问题'}`))
on('submit', event => write(`submit ${JSON.stringify(event.detail.values)}`))
on('invalid', event => write(`invalid ${event.detail.issues.length} 处`))
on('linkage-error', event => write(`linkage-error ${event.detail.issues.map(issue => issue.code).join(', ')}`))

renderer.loadOptions = loadOptions
renderer.schema = expenseForm()

document.querySelector('[aria-label="表单操作"]')!.addEventListener('click', (event) => {
  const item = (event.target as Element).closest<HTMLButtonElement>('button[value]')
  switch (item?.value) {
    case 'submit':
      renderer.submit()
      break
    case 'validate':
      write(`validate ${renderer.validate().valid ? '通过' : '未通过'}`)
      break
    case 'reset':
      renderer.reset()
      break
    case 'fill':
      renderer.setFormData({ applicant: '张三', phone: '13800000000', department: 'rd', type: 'travel', province: 'zj', city: 'hz', amount: 6800, invoices: 3 })
      break
  }
})

function onSwitch(id: string, apply: (checked: boolean) => void): void {
  document.querySelector(`#${id}`)!.addEventListener('checked-change', event => apply((event as CustomEvent<{ checked: boolean }>).detail.checked))
}

onSwitch('readonly', (checked) => {
  renderer.readonly = checked
})
onSwitch('disabled', (checked) => {
  renderer.disabled = checked
})
onSwitch('zh', checked => setXhConfig(checked ? mergeXhConfig(zhCN, formZhCN) : {}))

const designer = document.querySelector('xh-form-designer')!
const designerLog = document.querySelector<HTMLElement>('#designer-log')!

function writeDesigner(line: string): void {
  designerLog.textContent = `${line}
${designerLog.textContent ?? ''}`.slice(0, 4000)
}

function onDesigner<K extends keyof FormDesignerEventMap>(type: K, listener: (event: FormDesignerEventMap[K]) => void): void {
  designer.addEventListener(type, event => listener(event as FormDesignerEventMap[K]))
}

onDesigner('schema-change', event => writeDesigner(`schema-change ${event.detail.kind} ${event.detail.operations.map(operation => operation.type).join(', ')}`))
onDesigner('selection-change', event => writeDesigner(`selection-change ${JSON.stringify(event.detail)}`))
onDesigner('issues-change', event => writeDesigner(`issues-change ${event.detail.issues.map(issue => issue.code).join(', ') || '无问题'}`))
onDesigner('dirty-change', event => writeDesigner(`dirty-change ${event.detail.dirty}`))
onDesigner('mode-change', event => writeDesigner(`mode-change ${event.detail.mode}`))
onDesigner('save', () => writeDesigner('save'))

designer.loadOptions = loadOptions
designer.schema = expenseForm()
