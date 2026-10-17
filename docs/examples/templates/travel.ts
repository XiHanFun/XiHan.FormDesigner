/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 模板结构用的出差申请：卡片里的栅格、子表、子表单里的栅格、标签页，以及标题与段落。

import type { FormDocument } from '@xihan-form/core'

// #region schema
export const schema: FormDocument = {
  schemaVersion: 1,
  settings: { labelPlacement: 'top', size: 'md' },
  children: [
    // #region static
    {
      type: 'static',
      id: 's-title',
      kind: 'heading',
      basic: { content: '出差申请' },
      data: {},
      appearance: { level: 3 },
      linkage: [],
    },
    // #endregion static
    // #region card
    {
      type: 'container',
      id: 'c-basic',
      kind: 'card',
      basic: { title: '基本信息' },
      data: {},
      appearance: {},
      validation: [],
      linkage: [],
      regions: [{
        id: 'c-basic-body',
        props: {},
        children: [{
          type: 'container',
          id: 'c-basic-grid',
          kind: 'grid',
          basic: {},
          data: {},
          appearance: {},
          validation: [],
          linkage: [],
          regions: [
            {
              id: 'c-basic-left',
              props: { span: 6 },
              children: [{
                type: 'field',
                id: 'f-applicant',
                kind: 'text',
                key: 'applicant',
                basic: { label: '申请人' },
                data: {},
                appearance: {},
                validation: [{ id: 'r-applicant', kind: 'required' }],
                linkage: [],
              }],
            },
            {
              id: 'c-basic-right',
              props: { span: 6 },
              children: [{
                type: 'field',
                id: 'f-department',
                kind: 'select',
                key: 'department',
                basic: { label: '部门' },
                data: { options: [{ value: 'rd', label: '研发部' }, { value: 'sales', label: '销售部' }, { value: 'finance', label: '财务部' }] },
                appearance: {},
                validation: [{ id: 'r-department', kind: 'required' }],
                linkage: [],
              }],
            },
          ],
        }],
      }],
    },
    // #endregion card
    // #region subtable
    {
      type: 'container',
      id: 'c-companions',
      kind: 'subtable',
      key: 'companions',
      basic: { title: '同行人员' },
      data: { movable: false },
      appearance: {},
      validation: [],
      linkage: [],
      regions: [{
        id: 'c-companions-row',
        props: {},
        children: [
          {
            type: 'field',
            id: 'f-companion-name',
            kind: 'text',
            key: 'name',
            basic: { label: '姓名' },
            data: {},
            appearance: {},
            validation: [{ id: 'r-companion-name', kind: 'required' }],
            linkage: [],
          },
          {
            type: 'field',
            id: 'f-companion-phone',
            kind: 'text',
            key: 'phone',
            basic: { label: '手机号' },
            data: { inputType: 'tel' },
            appearance: {},
            validation: [],
            linkage: [],
          },
        ],
      }],
    },
    // #endregion subtable
    // #region subform
    {
      type: 'container',
      id: 'c-segments',
      kind: 'subform',
      key: 'segments',
      basic: { title: '行程' },
      data: { initialRows: 1 },
      appearance: {},
      validation: [{ id: 'r-segments', kind: 'required', message: '至少填写一段行程' }],
      linkage: [],
      regions: [{
        id: 'c-segments-row',
        props: {},
        children: [{
          type: 'container',
          id: 'c-segment-grid',
          kind: 'grid',
          basic: {},
          data: {},
          appearance: {},
          validation: [],
          linkage: [],
          regions: [
            {
              id: 'c-segment-from',
              props: { span: 4 },
              children: [{ type: 'field', id: 'f-from', kind: 'text', key: 'from', basic: { label: '出发地' }, data: {}, appearance: {}, validation: [], linkage: [] }],
            },
            {
              id: 'c-segment-to',
              props: { span: 4 },
              children: [{ type: 'field', id: 'f-to', kind: 'text', key: 'to', basic: { label: '目的地' }, data: {}, appearance: {}, validation: [], linkage: [] }],
            },
            {
              id: 'c-segment-by',
              props: { span: 4 },
              children: [{
                type: 'field',
                id: 'f-by',
                kind: 'select',
                key: 'by',
                basic: { label: '交通方式' },
                data: { options: [{ value: 'train', label: '火车' }, { value: 'plane', label: '飞机' }, { value: 'car', label: '汽车' }] },
                appearance: {},
                validation: [],
                linkage: [],
              }],
            },
          ],
        }],
      }],
    },
    // #endregion subform
    // #region tabs
    {
      type: 'container',
      id: 'c-more',
      kind: 'tabs',
      basic: {},
      data: {},
      appearance: {},
      validation: [],
      linkage: [],
      regions: [
        {
          id: 'c-more-hotel',
          props: { title: '住宿' },
          children: [{ type: 'field', id: 'f-nights', kind: 'number', key: 'nights', basic: { label: '住几晚' }, data: { precision: 0 }, appearance: {}, validation: [{ id: 'r-nights', kind: 'range', min: 0, max: 30 }], linkage: [] }],
        },
        {
          id: 'c-more-note',
          props: { title: '备注' },
          children: [{ type: 'field', id: 'f-note', kind: 'textarea', key: 'note', basic: { label: '备注' }, data: {}, appearance: {}, validation: [], linkage: [] }],
        },
      ],
    },
    // #endregion tabs
  ],
}
// #endregion schema

/** 示例数据：子表与子表单的值都是行对象的数组。 */
// #region values
export const values = {
  applicant: '张三',
  department: 'rd',
  companions: [{ name: '李四', phone: '13800000001' }],
  segments: [{ from: '杭州', to: '北京', by: 'train' }],
  nights: 3,
}
// #endregion values
