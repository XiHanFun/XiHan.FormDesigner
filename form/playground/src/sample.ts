/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 演示用的费用报销单：栅格、卡片、折叠、标签页与分组排布，带联动、校验、异步选项与级联选项。

import type { ContainerNode, FieldNode, FormDocument, FormNode, LinkageRule, PropertyBag, StaticNode, ValidationRule } from '@xihan-form/core'
import type { OptionItem, OptionLoader } from '@xihan-form/runtime'
import { createBuiltinKindRegistry, createDocument, createNode } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'

const registry = createBuiltinKindRegistry()
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

function container(kind: string, regions: readonly (readonly FormNode[])[], extra: { basic?: PropertyBag, appearance?: PropertyBag, regionProps?: readonly PropertyBag[] } = {}): ContainerNode {
  const node = createNode(registry, kind, ids) as ContainerNode
  const template = node.regions[0]!
  return {
    ...node,
    basic: { ...node.basic, ...extra.basic },
    appearance: { ...node.appearance, ...extra.appearance },
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
    basic: { placeholder: '11 位手机号' },
    data: { inputType: 'tel' },
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
  const amount = field('number', 'amount', '金额（元）', { data: { precision: 2, step: 100 }, validation: [rule({ kind: 'required' }), rule({ kind: 'range', min: 0.01, max: 100000 })] })
  const invoices = field('number', 'invoices', '发票张数', { data: { precision: 0 }, validation: [rule({ kind: 'expression', expression: '$value == null || $value <= 20', message: '一次最多报销 20 张发票' })] })
  const reason = field('textarea', 'reason', '事由', {
    basic: { placeholder: '金额超过 5000 元时必填' },
    appearance: { minRows: 2, maxRows: 6 },
    linkage: [linkage('require', 'amount > 5000')],
    validation: [rule({ kind: 'length', max: 200 })],
  })
  const urgent = field('switch', 'urgent', '加急处理')
  const urgentNote = field('text', 'urgentNote', '加急原因', { linkage: [linkage('hide', 'urgent != true'), linkage('require', 'urgent == true')] })

  const basics = container('grid', [[applicant], [phone], [department], [type], [province], [city], [amount], [invoices]], {
    regionProps: [{ span: 6 }, { span: 6 }, { span: 6 }, { span: 6 }, { span: 6 }, { span: 6 }, { span: 6 }, { span: 6 }],
  })
  const basicCard = container('card', [[basics, reason]], { basic: { title: '基本信息' } })

  const satisfaction = field('rating', 'satisfaction', '对流程的满意度')
  const share = field('slider', 'share', '计入项目预算的比例（%）', { basic: { initialValue: 100 } })
  const channels = field('checkbox-group', 'channels', '审批结果通知', { data: { options: [{ value: 'mail', label: '邮件' }, { value: 'sms', label: '短信' }, { value: 'im', label: '即时消息' }] } })
  const tags = field('toggle-group', 'tags', '标签', { data: { multiple: true, options: [{ value: 'project', label: '项目' }, { value: 'client', label: '客户' }, { value: 'internal', label: '内部' }] } })
  const extra = container('collapse', [[satisfaction, share], [channels, tags]], {
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
      basicCard,
      container('grid', [[urgent], [urgentNote]], { regionProps: [{ span: 4 }, { span: 8 }] }),
      divider('附加信息'),
      paragraph('以下内容选填，可帮助财务更快处理。'),
      extra,
      tabs,
      confirm,
    ],
  }
}

const DEPARTMENTS: readonly OptionItem[] = [
  { value: 'rd', label: '研发部' },
  { value: 'sales', label: '销售部' },
  { value: 'finance', label: '财务部' },
]

const CITIES: Readonly<Record<string, readonly OptionItem[]>> = {
  zj: [{ value: 'hz', label: '杭州' }, { value: 'nb', label: '宁波' }],
  js: [{ value: 'nj', label: '南京' }, { value: 'sz', label: '苏州' }],
  gd: [{ value: 'gz', label: '广州' }, { value: 'sz2', label: '深圳' }],
}

/** 模拟的异步选项加载：部门延迟返回，城市按省份返回。 */
export const loadOptions: OptionLoader = request => new Promise((resolve) => {
  setTimeout(() => {
    if (request.source === 'departments')
      resolve(DEPARTMENTS)
    else
      resolve(CITIES[String(request.values.province)] ?? [])
  }, 400)
})
