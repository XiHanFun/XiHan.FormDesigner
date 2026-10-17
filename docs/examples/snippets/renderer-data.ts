/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 渲染器的取值、赋值、重置、异步提交与强制状态。

import type { FormDocument } from '@xihan-form/core'
import type { XhFormRenderer } from '@xihan-form/runtime'

declare const renderer: XhFormRenderer
declare const schema: FormDocument
declare function saveOrder(values: object): Promise<void>

// #region data
renderer.schema = schema
// 已有的数据：也是 reset 与 isDirty 的基准
renderer.values = { applicant: '张三', items: [{ name: '高铁', qty: 2, price: 553 }] }

const all = renderer.getFormData() // 整份数据的副本，含联动赋值
const visible = renderer.getFormData({ omitHidden: true }) // 去掉隐藏字段的值，与 submit 交出的一样
const first = renderer.getValue(['items', 0, 'name']) // 按数据路径读

renderer.setValue(['items', 0, 'qty'], 3) // 写一个字段，形状不符时抛错
renderer.setFormData({ applicant: '李四' }, { baseline: true }) // 整份替换，同时作为新的基准
renderer.reset() // 回到基准值并清空校验状态
const changed = renderer.isDirty()
// #endregion data

// #region submit-action
renderer.submitAction = async ({ values }) => {
  // 返回的 Promise 落定之前表单处于提交中，期间再提交不会发生；失败时派发 submit-error
  await saveOrder(values)
}
// #endregion submit-action

// #region force
// ready 之后拿到控制器；模板、扩展、表达式引擎或选项加载函数一换就是新的控制器
renderer.addEventListener('ready', () => {
  const controller = renderer.controller!
  controller.setReadOnly(['applicant'], true) // 强制只读，盖过联动
  controller.setHidden('f-remark', true) // 也可以用节点 id
  controller.setReadOnly(['applicant'], null) // null 撤销强制
})
// #endregion force

export { all, changed, first, visible }
