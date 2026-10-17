/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 渲染器：选项与上传都交给宿主。这里用定时器模拟后端：城市按省份返回，供应商按搜索串筛，物资分类逐级返回，上传分五步汇报进度。

import type { FormRendererEventMap, OptionItem } from '@xihan-form/runtime'
import { defineFormRenderer } from '@xihan-form/runtime'
import { schema, values } from '../templates/purchase'

defineFormRenderer()

const CITIES: Readonly<Record<string, readonly OptionItem[]>> = {
  zj: [{ value: 'hz', label: '杭州' }, { value: 'nb', label: '宁波' }],
  js: [{ value: 'nj', label: '南京' }, { value: 'su', label: '苏州' }],
  gd: [{ value: 'gz', label: '广州' }, { value: 'sz', label: '深圳' }],
}

const VENDORS: readonly OptionItem[] = [
  { value: 'v1', label: '杭州西子办公用品有限公司' },
  { value: 'v2', label: '南京钟山电子有限公司' },
  { value: 'v3', label: '广州珠江文具有限公司' },
]

const CATEGORIES: Readonly<Record<string, readonly OptionItem[]>> = {
  '': [{ value: 'office', label: '办公用品', hasChildren: true }, { value: 'it', label: '电脑设备', hasChildren: true }],
  'office': [{ value: 'paper', label: '纸张' }, { value: 'pen', label: '笔' }],
  'it': [{ value: 'laptop', label: '笔记本电脑' }, { value: 'monitor', label: '显示器' }],
}

function later<T>(value: T): Promise<T> {
  return new Promise(resolve => setTimeout(resolve, 300, value))
}

export function mount(host: HTMLElement): () => void {
  const output = document.createElement('pre')
  const renderer = document.createElement('xh-form-renderer')

  // #region load
  renderer.loadOptions = (request) => {
    if (request.source === 'cities')
      return later(CITIES[String(request.values.province)] ?? [])
    if (request.source === 'vendors')
      return later(VENDORS.filter(vendor => vendor.label.includes(request.query?.trim() ?? '')))
    return later(CATEGORIES[request.parent ?? ''] ?? [])
  }
  // #endregion load

  // #region upload
  renderer.uploadFile = request => new Promise((resolve, reject) => {
    let progress = 0
    const timer = setInterval(() => {
      progress += 20
      request.onProgress(progress)
      if (progress >= 100) {
        clearInterval(timer)
        resolve({ id: `${request.target}-${Date.now()}` })
      }
    }, 200)
    request.signal.addEventListener('abort', () => {
      clearInterval(timer)
      reject(request.signal.reason)
    })
  })
  // #endregion upload

  renderer.addEventListener('value-change', (event) => {
    output.textContent = JSON.stringify((event as FormRendererEventMap['value-change']).detail.values, null, 2)
  })
  renderer.schema = schema
  renderer.values = values
  host.append(renderer, output)
  return () => host.replaceChildren()
}
