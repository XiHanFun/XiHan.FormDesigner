/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 演示用的费用报销单：栅格、卡片、折叠、标签页与分组排布，带联动、校验、异步选项、级联选项与附件上传。

import type { ContainerNode, FieldNode, FormDocument, FormNode, LinkageRule, PropertyBag, StaticNode, ValidationRule } from '@xihan-form/core'
import type { FileUploader, OptionItem, OptionLoader } from '@xihan-form/runtime'
import { createDocument, createFormModel, createNode } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'

const registry = createFormModel().registry
const ids = createIdAllocator('n')

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never

interface FieldExtra {
  readonly basic?: PropertyBag
  readonly data?: PropertyBag
  readonly appearance?: PropertyBag
  readonly validation?: readonly ValidationRule[]
  readonly linkage?: readonly LinkageRule[]
}

function field(kind: string, key: string, label: string, extra: FieldExtra = {}): FieldNode {
  const node = createNode(registry, kind, ids, { key }) as FieldNode
  return {
    ...node,
    basic: { ...node.basic, label, ...extra.basic },
    data: { ...node.data, ...extra.data },
    appearance: { ...node.appearance, ...extra.appearance },
    validation: [...(extra.validation ?? node.validation)],
    linkage: [...(extra.linkage ?? node.linkage)],
  }
}

function container(kind: string, regions: readonly (readonly FormNode[])[], extra: { key?: string, basic?: PropertyBag, data?: PropertyBag, appearance?: PropertyBag, regionProps?: readonly PropertyBag[], validation?: readonly ValidationRule[] } = {}): ContainerNode {
  const node = createNode(registry, kind, ids, extra.key === undefined ? {} : { key: extra.key }) as ContainerNode
  const template = node.regions[0]!
  return {
    ...node,
    basic: { ...node.basic, ...extra.basic },
    data: { ...node.data, ...extra.data },
    appearance: { ...node.appearance, ...extra.appearance },
    validation: extra.validation ?? node.validation,
    regions: regions.map((children, index) => ({
      id: index === 0 ? template.id : ids.next(),
      props: { ...template.props, ...extra.regionProps?.[index] },
      children: [...children],
    })),
  }
}

function divider(label: string): StaticNode {
  const node = createNode(registry, 'divider', ids) as StaticNode
  return { ...node, basic: { ...node.basic, label } }
}

function paragraph(content: string): StaticNode {
  const node = createNode(registry, 'paragraph', ids) as StaticNode
  return { ...node, basic: { ...node.basic, content } }
}

function element(kind: string, basic: PropertyBag, appearance: PropertyBag = {}): StaticNode {
  const node = createNode(registry, kind, ids) as StaticNode
  return { ...node, basic: { ...node.basic, ...basic }, appearance: { ...node.appearance, ...appearance } }
}

/** 示例用的内联标志图，省得开发预览页依赖外部资源。 */
const LOGO = 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2016%209%22%3E%3Crect%20width=%2216%22%20height=%229%22%20fill=%22%23475569%22/%3E%3Cpath%20d=%22M0%209%206%203%2016%209z%22%20fill=%22%2394a3b8%22/%3E%3C/svg%3E'

function rule(rule: WithoutId<ValidationRule>): ValidationRule {
  return { id: ids.next(), ...rule } as ValidationRule
}

function linkage(action: LinkageRule['action'], when: string, value?: string): LinkageRule {
  return { id: ids.next(), action, when, ...(value === undefined ? {} : { value }) }
}

const PROVINCES = [{ value: 'zj', label: '浙江' }, { value: 'js', label: '江苏' }, { value: 'gd', label: '广东' }]

/** 费用报销单。 */
export function expenseForm(): FormDocument {
  const applicant = field('text', 'applicant', '申请人', { validation: [rule({ kind: 'required' }), rule({ kind: 'length', min: 2, max: 20 })] })
  const phone = field('text', 'phone', '手机号', {
    basic: { placeholder: '11 位手机号', hint: '用于接收审批结果短信' },
    data: { inputType: 'tel' },
    appearance: { prefix: '+86' },
    validation: [rule({ kind: 'required' }), rule({ kind: 'pattern', pattern: '^1\\d{10}$', message: '请输入 11 位手机号' })],
  })
  const department = field('select', 'department', '部门', { basic: { placeholder: '请选择部门' }, data: { optionSource: 'departments' }, validation: [rule({ kind: 'required' })] })
  const type = field('radio-group', 'type', '费用类型', {
    basic: { initialValue: 'office' },
    data: { options: [{ value: 'travel', label: '差旅' }, { value: 'office', label: '办公' }, { value: 'meal', label: '招待' }] },
  })
  const province = field('select', 'province', '出差省份', { data: { options: PROVINCES }, linkage: [linkage('hide', 'type != \'travel\'')] })
  const city = field('select', 'city', '出差城市', {
    data: { optionSource: 'cities', optionDependencies: ['province'] },
    linkage: [linkage('hide', 'type != \'travel\'')],
  })
  const amount = field('number', 'amount', '金额（元）', { basic: { placeholder: '例如 1280.50' }, data: { precision: 2, step: 100 }, validation: [rule({ kind: 'required' }), rule({ kind: 'range', min: 0.01, max: 100000 })] })
  const vendor = field('combobox', 'vendor', '开票单位', { basic: { placeholder: '输入名称搜索', hint: '按名称搜索，结果来自宿主' }, data: { optionSource: 'vendors' } })
  const bank = field('select', 'bank', '收款银行', { basic: { placeholder: '请选择银行', hint: '首次加载会失败，展开后点重试' }, data: { optionSource: 'banks' } })
  const account = field('tree-select', 'account', '费用科目', { basic: { placeholder: '请选择科目', hint: '展开一级科目时才向宿主要下级' }, data: { optionSource: 'accounts' } })
  const invoices = field('number', 'invoices', '发票张数', { data: { precision: 0 }, validation: [rule({ kind: 'expression', expression: '$value == null || $value <= 20', message: '一次最多报销 20 张发票' })] })
  const reason = field('textarea', 'reason', '事由', {
    basic: { placeholder: '金额超过 5000 元时必填', hint: '写清费用用途，财务审核时会对照发票' },
    appearance: { minRows: 2, maxRows: 6 },
    linkage: [linkage('require', 'amount > 5000')],
    validation: [rule({ kind: 'length', max: 200 })],
  })
  const attachments = field('file', 'attachments', '发票附件', { basic: { hint: '支持 PDF 与图片，最多 5 个' }, data: { accept: '.pdf,image/*', maxFiles: 5, uploadTarget: 'invoices' } })
  const urgent = field('switch', 'urgent', '加急处理')
  const urgentNote = field('text', 'urgentNote', '加急原因', { linkage: [linkage('hide', 'urgent != true'), linkage('require', 'urgent == true')] })

  const basics = container('grid', [[applicant], [phone], [department], [type], [province], [city], [amount], [invoices], [vendor], [bank], [account]], {
    regionProps: [{ span: 6 }, { span: 6 }, { span: 6 }, { span: 6 }, { span: 6 }, { span: 6 }, { span: 6 }, { span: 6 }, { span: 6 }, { span: 6 }, { span: 6 }],
  })
  const basicCard = container('card', [[basics, reason, attachments]], { basic: { title: '基本信息' } })

  const details = container('subform', [[
    container('grid', [[field('text', 'item', '名目', { validation: [rule({ kind: 'required' })] })], [field('number', 'cost', '金额', { data: { precision: 2 }, appearance: { suffix: '元' } })]], { regionProps: [{ span: 6 }, { span: 6 }] }),
  ]], { key: 'details', basic: { title: '费用明细' }, data: { initialRows: 1 }, validation: [rule({ kind: 'required', message: '至少填写一条明细' })] })
  const companions = container('subtable', [[field('text', 'name', '姓名'), field('text', 'phone', '手机号')]], { key: 'companions', basic: { title: '同行人员' }, data: { movable: false } })

  const satisfaction = field('rating', 'satisfaction', '对流程的满意度')
  const share = field('slider', 'share', '计入项目预算的比例（%）', { basic: { initialValue: 100 } })
  const channels = field('checkbox-group', 'channels', '审批结果通知', { data: { options: [{ value: 'mail', label: '邮件' }, { value: 'sms', label: '短信' }, { value: 'im', label: '即时消息' }] } })
  const tags = field('toggle-group', 'tags', '标签', { data: { multiple: true, options: [{ value: 'project', label: '项目' }, { value: 'client', label: '客户' }, { value: 'internal', label: '内部' }] } })
  const keywords = field('tags', 'keywords', '关键词', { basic: { placeholder: '输入后回车' }, data: { max: 5 } })
  const extra = container('collapse', [[satisfaction, share], [channels, tags, keywords]], {
    regionProps: [{ title: '反馈', expanded: true }, { title: '通知与标签', expanded: false }],
  })

  const approver = field('text', 'approver', '审批人', { basic: { initialValue: '财务部', readOnly: true } })
  const pin = field('pin', 'pin', '审批口令', { data: { length: 4 } })
  const tabs = container('tabs', [[approver], [pin]], { regionProps: [{ title: '审批信息' }, { title: '安全校验' }] })

  const agree = field('checkbox', 'agree', '我确认以上费用真实发生', { validation: [rule({ kind: 'accepted', message: '提交前请先确认' })] })
  const confirm = container('fieldset', [[agree]], { basic: { legend: '确认' } })

  return {
    ...createDocument(),
    children: [
      element('heading', { content: '费用报销单' }, { level: 2 }),
      element('alert', { title: '提交前请核对', content: '发票须在开票后 90 天内提交，超过 5000 元需填写事由。' }),
      basicCard,
      details,
      companions,
      container('grid', [[urgent], [urgentNote]], { regionProps: [{ span: 4 }, { span: 8 }] }),
      divider('附加信息'),
      paragraph('以下内容选填，可帮助财务更快处理。'),
      extra,
      tabs,
      confirm,
      container('grid', [
        [element('barcode', { value: 'BX-2026-0001' })],
        [element('qrcode', { value: 'https://www.xihanfun.com' })],
        [element('image', { src: LOGO, alt: '公司标志' }, { width: 160 })],
      ], { regionProps: [{ span: 4 }, { span: 4 }, { span: 4 }] }),
    ],
  }
}

const DEPARTMENTS: readonly OptionItem[] = [
  { value: 'rd', label: '研发部' },
  { value: 'sales', label: '销售部' },
  { value: 'finance', label: '财务部' },
]

const VENDORS: readonly OptionItem[] = [
  { value: 'v1', label: '上海曦寒科技有限公司' },
  { value: 'v2', label: '上海云帆商贸有限公司' },
  { value: 'v3', label: '北京启明文具有限公司' },
  { value: 'v4', label: '杭州西湖餐饮管理有限公司' },
  { value: 'v5', label: '深圳南山差旅服务有限公司' },
]

const BANKS: readonly OptionItem[] = [
  { value: 'icbc', label: '工商银行' },
  { value: 'ccb', label: '建设银行' },
  { value: 'cmb', label: '招商银行' },
]

const ACCOUNTS: Readonly<Record<string, readonly OptionItem[]>> = {
  '': [{ value: 'travel', label: '差旅费', hasChildren: true }, { value: 'office', label: '办公费', hasChildren: true }, { value: 'other', label: '其他' }],
  'travel': [{ value: 'travel-transport', label: '交通' }, { value: 'travel-hotel', label: '住宿' }, { value: 'travel-meal', label: '伙食补助' }],
  'office': [{ value: 'office-supply', label: '办公用品' }, { value: 'office-print', label: '打印复印' }],
}

const CITIES: Readonly<Record<string, readonly OptionItem[]>> = {
  zj: [{ value: 'hz', label: '杭州' }, { value: 'nb', label: '宁波' }],
  js: [{ value: 'nj', label: '南京' }, { value: 'sz', label: '苏州' }],
  gd: [{ value: 'gz', label: '广州' }, { value: 'sz2', label: '深圳' }],
}

let bankAttempts = 0

/** 模拟的异步选项加载：部门延迟返回，开票单位按搜索串筛，银行首次失败、重试后返回，费用科目按父节点逐级返回，城市按省份返回。 */
export const loadOptions: OptionLoader = request => new Promise((resolve, reject) => {
  setTimeout(() => {
    if (request.source === 'departments')
      resolve(DEPARTMENTS)
    else if (request.source === 'banks' && bankAttempts++ === 0)
      reject(new Error('网络不可用'))
    else if (request.source === 'banks')
      resolve(BANKS)
    else if (request.source === 'accounts')
      resolve(ACCOUNTS[request.parent ?? ''] ?? [])
    else if (request.source === 'vendors')
      resolve(VENDORS.filter(vendor => vendor.label.includes(request.query?.trim() ?? '')))
    else
      resolve(CITIES[String(request.values.province)] ?? [])
  }, 400)
})

/** 模拟的上传：一秒内分五步汇报进度，完成后返回附件 id；文件名带「坏」字的在半路失败。 */
export const uploadFile: FileUploader = request => new Promise((resolve, reject) => {
  let progress = 0
  const timer = setInterval(() => {
    progress += 20
    request.onProgress(progress)
    if (progress >= 60 && request.file.name.includes('坏')) {
      clearInterval(timer)
      reject(new Error('上传失败'))
    }
    else if (progress >= 100) {
      clearInterval(timer)
      resolve({ id: `${request.target ?? 'file'}-${crypto.randomUUID()}` })
    }
  }, 200)
  request.signal.addEventListener('abort', () => {
    clearInterval(timer)
    reject(request.signal.reason)
  })
})
