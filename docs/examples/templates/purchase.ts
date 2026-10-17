/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 渲染器用的采购申请：静态选项、随省份级联的城市、按名称搜索的供应商、逐级展开的物资分类，以及报价单附件。

import type { FormDocument } from '@xihan-form/core'

export const schema: FormDocument = {
  schemaVersion: 1,
  settings: { labelPlacement: 'top', size: 'md' },
  children: [
    // #region static
    {
      type: 'field',
      id: 'f-province',
      kind: 'select',
      key: 'province',
      basic: { label: '收货省份', placeholder: '请选择' },
      data: { options: [{ value: 'zj', label: '浙江' }, { value: 'js', label: '江苏' }, { value: 'gd', label: '广东' }] },
      appearance: {},
      validation: [],
      linkage: [],
    },
    // #endregion static
    // #region cascade
    {
      type: 'field',
      id: 'f-city',
      kind: 'select',
      key: 'city',
      basic: { label: '收货城市', placeholder: '先选省份' },
      data: { optionSource: 'cities', optionDependencies: ['province'] },
      appearance: {},
      validation: [],
      linkage: [],
    },
    // #endregion cascade
    // #region search
    {
      type: 'field',
      id: 'f-vendor',
      kind: 'combobox',
      key: 'vendor',
      basic: { label: '供应商', placeholder: '输入名称搜索' },
      data: { optionSource: 'vendors' },
      appearance: {},
      validation: [],
      linkage: [],
    },
    // #endregion search
    // #region tree
    {
      type: 'field',
      id: 'f-category',
      kind: 'tree-select',
      key: 'category',
      basic: { label: '物资分类', placeholder: '请选择' },
      data: { optionSource: 'categories' },
      appearance: {},
      validation: [],
      linkage: [],
    },
    // #endregion tree
    // #region file
    {
      type: 'field',
      id: 'f-quotes',
      kind: 'file',
      key: 'quotes',
      basic: { label: '报价单', hint: '支持 PDF 与图片，最多 3 个' },
      data: { accept: '.pdf,image/*', maxFiles: 3, uploadTarget: 'quotes' },
      appearance: {},
      validation: [],
      linkage: [],
    },
    // #endregion file
  ],
}

export const values = { province: 'zj' }
