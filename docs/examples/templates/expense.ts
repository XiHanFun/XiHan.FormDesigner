/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 校验与联动用的报销单：按类型显示与必填、行内小计与合计的赋值、超过宿主给的限额时事由必填、表达式校验与勾选确认。

import type { FormDocument } from '@xihan-form/core'

export const schema: FormDocument = {
  schemaVersion: 1,
  settings: { labelPlacement: 'top', size: 'md' },
  children: [
    {
      type: 'field',
      id: 'f-type',
      kind: 'radio-group',
      key: 'type',
      basic: { label: '费用类型', initialValue: 'office' },
      data: { options: [{ value: 'office', label: '办公' }, { value: 'travel', label: '差旅' }] },
      appearance: { orientation: 'horizontal' },
      validation: [],
      linkage: [],
    },
    // #region show
    {
      type: 'field',
      id: 'f-city',
      kind: 'text',
      key: 'city',
      basic: { label: '出差城市' },
      data: {},
      appearance: {},
      validation: [],
      linkage: [
        { id: 'l-city-hide', action: 'hide', when: 'type != \'travel\'' },
        { id: 'l-city-require', action: 'require', when: 'type == \'travel\'' },
      ],
    },
    // #endregion show
    // #region row
    {
      type: 'container',
      id: 'c-items',
      kind: 'subtable',
      key: 'items',
      basic: { title: '明细' },
      data: { initialRows: 1 },
      appearance: {},
      validation: [{ id: 'r-items', kind: 'required', message: '至少填写一条明细' }],
      linkage: [],
      regions: [{
        id: 'c-items-row',
        props: {},
        children: [
          { type: 'field', id: 'f-item', kind: 'text', key: 'name', basic: { label: '名目' }, data: {}, appearance: { columnMinWidth: 120 }, validation: [{ id: 'r-item', kind: 'required' }], linkage: [] },
          { type: 'field', id: 'f-qty', kind: 'number', key: 'qty', basic: { label: '数量' }, data: { precision: 0 }, appearance: { columnMinWidth: 104 }, validation: [{ id: 'r-qty', kind: 'range', min: 1 }], linkage: [] },
          { type: 'field', id: 'f-price', kind: 'number', key: 'price', basic: { label: '单价' }, data: { precision: 2 }, appearance: { columnMinWidth: 144 }, validation: [], linkage: [] },
          {
            type: 'field',
            id: 'f-amount',
            kind: 'number',
            key: 'amount',
            basic: { label: '小计', readOnly: true },
            data: { precision: 2 },
            appearance: { columnMinWidth: 144 },
            validation: [],
            linkage: [{ id: 'l-amount', action: 'assign', value: '$row.qty * $row.price' }],
          },
        ],
      }],
    },
    // #endregion row
    // #region total
    {
      type: 'field',
      id: 'f-total',
      kind: 'number',
      key: 'total',
      basic: { label: '合计（元）', readOnly: true },
      data: { precision: 2 },
      appearance: {},
      validation: [],
      linkage: [{ id: 'l-total', action: 'assign', value: 'SUM(items.amount)' }],
    },
    {
      type: 'field',
      id: 'f-reason',
      kind: 'textarea',
      key: 'reason',
      basic: { label: '事由', hint: '合计超过限额时必填' },
      data: {},
      appearance: {},
      validation: [{ id: 'r-reason', kind: 'length', max: 200 }],
      linkage: [{ id: 'l-reason', action: 'require', when: 'total > $limit' }],
    },
    // #endregion total
    // #region rules
    {
      type: 'field',
      id: 'f-invoices',
      kind: 'number',
      key: 'invoices',
      basic: { label: '发票张数' },
      data: { precision: 0 },
      appearance: {},
      validation: [
        { id: 'r-invoices-required', kind: 'required' },
        { id: 'r-invoices-max', kind: 'expression', expression: '$value <= 20', message: '一次最多报销 20 张发票' },
      ],
      linkage: [],
    },
    {
      type: 'field',
      id: 'f-agree',
      kind: 'checkbox',
      key: 'agree',
      basic: { label: '我确认以上费用真实发生' },
      data: {},
      appearance: {},
      validation: [{ id: 'r-agree', kind: 'accepted', message: '提交前请先确认' }],
      linkage: [],
    },
    // #endregion rules
  ],
}

/** 示例数据：一行明细，小计与合计由联动算出。 */
export const values = {
  items: [{ name: '高铁', qty: 2, price: 553 }],
}

/** 宿主提供给表达式的变量。 */
// #region variables
export const variables = { $limit: 5000 }
// #endregion variables
