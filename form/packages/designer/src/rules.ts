/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 校验规则与联动规则页签的数据：每条规则在属性面板里是一个编辑对象，按规则种类或联动动作列出参数；
// 面板的写入换成整条规则；规则上的结构问题落到对应参数上。

import type { FormDocument, FormNode, FormSchemaIssue, KindRegistry, LinkageAction, LinkageRule, RuleList, ValidationKind, ValidationRule } from '@xihan-form/core'
import type { FormDesignerTranslations } from '@xihan-form/runtime'
import type { JsonValue } from '@xihan-ui/core/json'
import type { DesignerPropertyDescriptor, DesignerPropertyError, DesignerPropertyTarget } from '@xihan-ui/designer-shell'
import type { FormRuleInit } from './editor'
import { LINKAGE_ACTIONS } from '@xihan-form/core'
import { locations } from './properties'

/** 规则作为编辑对象时的种类。 */
export const RULE_TARGET_KIND = 'rule'

export type FormRule = ValidationRule | LinkageRule

const MESSAGE: DesignerPropertyDescriptor = { path: ['message'], control: { kind: 'text' } }
const BOUND: DesignerPropertyDescriptor['control'] = { kind: 'number' }
const LENGTH: DesignerPropertyDescriptor['control'] = { kind: 'number', integer: true, min: 0 }

const VALIDATION_PARAMS: Readonly<Record<ValidationKind, readonly DesignerPropertyDescriptor[]>> = {
  required: [MESSAGE],
  accepted: [MESSAGE],
  length: [{ path: ['min'], control: LENGTH }, { path: ['max'], control: LENGTH }, MESSAGE],
  range: [{ path: ['min'], control: BOUND }, { path: ['max'], control: BOUND }, MESSAGE],
  pattern: [{ path: ['pattern'], control: { kind: 'text' }, required: true }, { path: ['flags'], control: { kind: 'text' } }, MESSAGE],
  expression: [{ path: ['expression'], control: { kind: 'text' }, required: true }, MESSAGE],
}

const LABELS: Readonly<Record<string, keyof FormDesignerTranslations>> = {
  message: 'ruleMessage',
  min: 'ruleMin',
  max: 'ruleMax',
  pattern: 'rulePattern',
  flags: 'ruleFlags',
  expression: 'ruleExpression',
  when: 'ruleWhen',
  value: 'ruleValue',
  action: 'ruleAction',
}

/** 节点有没有这个规则列表：校验规则只给登记了校验种类的字段与容器，联动规则所有节点都有。 */
export function hasRuleList(node: FormNode, list: RuleList, registry: KindRegistry): boolean {
  if (list === 'linkage')
    return true
  const definition = registry.get(node.kind)
  return node.type !== 'static' && definition !== undefined && definition.type !== 'static' && definition.validations.length > 0
}

/** 可以新加的规则：校验规则是种类登记的校验种类，必填与勾选各只一条；联动规则是节点类型可用的动作。 */
export function ruleChoices(node: FormNode, list: RuleList, registry: KindRegistry): readonly string[] {
  if (list === 'linkage')
    return LINKAGE_ACTIONS[node.type]
  const definition = registry.get(node.kind)
  if (node.type === 'static' || definition === undefined || definition.type === 'static')
    return []
  const present = new Set(node.validation.map(rule => rule.kind))
  return definition.validations.filter(kind => (kind !== 'required' && kind !== 'accepted') || !present.has(kind))
}

/** 节点上的这个规则列表。 */
export function rulesOf(node: FormNode, list: RuleList): readonly FormRule[] {
  return list === 'linkage' ? node.linkage : node.type === 'static' ? [] : node.validation
}

/** 一条新规则：校验规则按种类，联动规则按动作，参数留空由校验提示补齐。 */
export function newRule(list: RuleList, choice: string): FormRuleInit | Omit<LinkageRule, 'id'> {
  if (list === 'linkage')
    return { action: choice as LinkageAction }
  switch (choice as ValidationKind) {
    case 'pattern':
      return { kind: 'pattern', pattern: '' }
    case 'expression':
      return { kind: 'expression', expression: '' }
    default:
      return { kind: choice as 'required' | 'accepted' | 'length' | 'range' }
  }
}

/** 规则的参数描述；联动规则的赋值表达式只在动作是 assign 时显示。 */
export function ruleDescriptors(node: FormNode, list: RuleList, rule: FormRule): readonly DesignerPropertyDescriptor[] {
  if (list === 'validation')
    return VALIDATION_PARAMS[(rule as ValidationRule).kind] ?? [MESSAGE]
  return [
    { path: ['action'], control: { kind: 'select', options: LINKAGE_ACTIONS[node.type].map(value => ({ value })) }, required: true },
    { path: ['when'], control: { kind: 'text' } },
    { path: ['value'], control: { kind: 'text' }, required: true, visibleWhen: { path: ['action'], equals: 'assign' } },
  ]
}

/** 规则在属性面板里的编辑对象。 */
export function ruleTarget(node: FormNode, list: RuleList, rule: FormRule): DesignerPropertyTarget {
  return { kind: RULE_TARGET_KIND, id: rule.id, value: rule as unknown as JsonValue, descriptors: ruleDescriptors(node, list, rule) }
}

/** 规则卡片的标题：校验规则的种类名，或联动动作名。 */
export function ruleTitle(list: RuleList, rule: FormRule, t: FormDesignerTranslations): string {
  return list === 'validation' ? t.ruleKind((rule as ValidationRule).kind) : t.linkageAction((rule as LinkageRule).action)
}

/** 参数名的文案。 */
export function ruleFieldLabel(descriptor: DesignerPropertyDescriptor, t: FormDesignerTranslations): string {
  const name = String(descriptor.path[0])
  const key = LABELS[name]
  return key === undefined ? name : t[key] as string
}

/** 改一个参数后的整条规则：值为 undefined 时去掉该参数；联动动作不再是 assign 时去掉赋值表达式。 */
export function nextRule<R extends FormRule>(list: RuleList, rule: R, name: string, value: JsonValue | undefined): R {
  const next: Record<string, unknown> = { ...rule }
  if (value === undefined)
    delete next[name]
  else
    next[name] = value
  if (list === 'linkage' && name === 'action' && value !== 'assign')
    delete next.value
  return next as R
}

/** 规则上的结构问题换成面板字段上的错误：问题落在某个参数上就用它，落在整条规则上时落到第一个参数上。 */
export function ruleErrors(
  document: FormDocument,
  node: FormNode,
  list: RuleList,
  issues: readonly FormSchemaIssue[],
  message: (issue: FormSchemaIssue) => string,
): ReadonlyMap<string, DesignerPropertyError[]> {
  const out = new Map<string, DesignerPropertyError[]>()
  const base = locations(document).get(node.id)
  if (base === undefined)
    return out
  const rules = rulesOf(node, list)
  for (const issue of issues) {
    if (issue.target?.kind !== RULE_TARGET_KIND)
      continue
    const index = rules.findIndex(rule => rule.id === issue.target!.id)
    if (index === -1)
      continue
    const rule = rules[index]!
    const prefix = [...base, list, index]
    const rest = prefix.every((segment, at) => issue.path[at] === segment) ? issue.path.slice(prefix.length) : []
    const descriptors = ruleDescriptors(node, list, rule)
    const field = descriptors.find(descriptor => descriptor.path[0] === rest[0]) ?? descriptors[0]
    if (field === undefined)
      continue
    const errors = out.get(rule.id) ?? []
    errors.push({ target: { kind: RULE_TARGET_KIND, id: rule.id }, path: field.path, message: message(issue) })
    out.set(rule.id, errors)
  }
  return out
}
