/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 快速开始用的联系人表单：四个字段，带必填、长度与正则校验。

import type { FormDocument } from '@xihan-form/core'

// #region schema
export const schema: FormDocument = {
  schemaVersion: 1,
  settings: { labelPlacement: 'top', size: 'md' },
  children: [
    {
      type: 'field',
      id: 'f-name',
      kind: 'text',
      key: 'name',
      basic: { label: '姓名', placeholder: '请输入姓名' },
      data: {},
      appearance: {},
      validation: [
        { id: 'r-name-required', kind: 'required' },
        { id: 'r-name-length', kind: 'length', min: 2, max: 20 },
      ],
      linkage: [],
    },
    {
      type: 'field',
      id: 'f-email',
      kind: 'text',
      key: 'email',
      basic: { label: '邮箱', hint: '用于接收回复' },
      data: { inputType: 'email' },
      appearance: {},
      validation: [
        { id: 'r-email-required', kind: 'required' },
        { id: 'r-email-pattern', kind: 'pattern', pattern: '^[^@\\s]+@[^@\\s]+$', message: '请输入有效的邮箱' },
      ],
      linkage: [],
    },
    {
      type: 'field',
      id: 'f-topic',
      kind: 'select',
      key: 'topic',
      basic: { label: '咨询类型', initialValue: 'product' },
      data: {
        options: [
          { value: 'product', label: '产品咨询' },
          { value: 'billing', label: '账单问题' },
          { value: 'other', label: '其他' },
        ],
      },
      appearance: {},
      validation: [],
      linkage: [],
    },
    {
      type: 'field',
      id: 'f-message',
      kind: 'textarea',
      key: 'message',
      basic: { label: '留言' },
      data: {},
      appearance: { minRows: 3 },
      validation: [{ id: 'r-message-length', kind: 'length', max: 200 }],
      linkage: [],
    },
  ],
}
// #endregion schema

/** 示例数据：已经填好的部分。 */
export const values = { name: '张三' }
