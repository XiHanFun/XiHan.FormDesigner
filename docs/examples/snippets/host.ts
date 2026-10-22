/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 宿主的几件事：保存模板、把自己的操作与模板标题挂进菜单栏、保存状态放进状态栏、接菜单栏的关闭钮、离开前提醒、服务端复核模板与提交的数据。

import type { FormDocument } from '@xihan-form/core'
import type { XhFormDesigner } from '@xihan-form/designer'
import type { JsonValue } from '@xihan-ui/core/json'
import { resolveLinkage, validateDocument, validateValues } from '@xihan-form/core'
import { createExpressionEngine } from '@xihan-ui/expression'

declare const designer: XhFormDesigner
declare const api: {
  loadTemplate: (id: string) => Promise<FormDocument>
  saveTemplate: (id: string, schema: FormDocument) => Promise<void>
}
/** 宿主自己的确认框：有未保存的修改时问要不要离开。 */
declare function confirmLeave(): Promise<boolean>

// #region save
export async function openTemplate(id: string): Promise<void> {
  designer.schema = await api.loadTemplate(id)
  designer.addEventListener('save', async () => {
    await api.saveTemplate(id, designer.schema)
    designer.markSaved()
  })
}
// #endregion save

// #region menubar
export function hostMenubar(name: string): void {
  designer.extensions = [{
    id: 'acme.host',
    commands: [
      { id: 'acme.new', label: '新建', placement: ['menubar:file'], run: () => location.assign('/forms/new') },
    ],
  }]
  // 菜单栏最右端的关闭钮：回到列表，有未保存的修改时先问
  designer.closable = true
  designer.addEventListener('close', async () => {
    if (!designer.dirty || await confirmLeave())
      history.back()
  })
  const title = document.createElement('span')
  title.slot = 'menubar-center'
  title.textContent = name
  const saved = document.createElement('span')
  saved.slot = 'status-end'
  saved.textContent = '已保存'
  designer.append(title, saved)
}
// #endregion menubar

// #region leave
window.addEventListener('beforeunload', (event) => {
  if (designer.dirty)
    event.preventDefault()
})
// #endregion leave

// #region server
const expressionEngine = createExpressionEngine()

/** 服务端收到模板时：有问题就拒绝保存。 */
export function checkTemplate(schema: unknown): boolean {
  return validateDocument(schema, { expressionEngine, identifiers: ['$limit'] }).length === 0
}

/** 服务端收到表单数据时：先按联动求出各字段的状态与赋值，再按这些状态校验。 */
export function checkSubmission(schema: FormDocument, submitted: Record<string, JsonValue>) {
  const variables = { $limit: 5000 }
  const linkage = resolveLinkage(schema, submitted, { expressionEngine, variables })
  const issues = validateValues(schema, linkage.values, { expressionEngine, states: linkage.states, variables })
  // 赋值字段（小计、合计）以重算出的值为准，不用提交上来的
  return { values: linkage.values, issues }
}
// #endregion server
