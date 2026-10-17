import type { FieldNode, FormDocument, LinkageRule, StaticNode, ValidationRule } from '@xihan-form/core'
import { applyOperations, createDocument, createFormModel, createNode, validateDocument } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { createExpressionEngine } from '@xihan-ui/expression'
import { describe, expect, it } from 'vitest'
import { hasRuleList, newRule, nextRule, ruleChoices, ruleDescriptors, ruleErrors } from '../src/rules'

const registry = createFormModel().registry

function sample(): { document: FormDocument, text: FieldNode, divider: StaticNode } {
  const ids = createIdAllocator('r')
  const text = createNode(registry, 'text', ids, { key: 'name' }) as FieldNode
  const divider = createNode(registry, 'divider', ids) as StaticNode
  return { document: { ...createDocument(), children: [text, divider] }, text, divider }
}

describe('规则列表', () => {
  it('校验规则只给登记了校验种类的节点；必填只能有一条；联动动作按节点类型', () => {
    const { text, divider } = sample()
    expect(hasRuleList(text, 'validation', registry)).toBe(true)
    expect(hasRuleList(divider, 'validation', registry)).toBe(false)
    expect(ruleChoices(text, 'validation', registry)).toContain('required')
    const required: FieldNode = { ...text, validation: [{ id: 'v1', kind: 'required' }] }
    expect(ruleChoices(required, 'validation', registry)).not.toContain('required')
    expect(ruleChoices(divider, 'linkage', registry)).toEqual(['show', 'hide'])
  })

  it('新规则按种类给出必需的参数；赋值表达式只在 assign 时显示', () => {
    expect(newRule('validation', 'pattern')).toEqual({ kind: 'pattern', pattern: '' })
    expect(newRule('validation', 'length')).toEqual({ kind: 'length' })
    expect(newRule('linkage', 'hide')).toEqual({ action: 'hide' })
    const { text } = sample()
    const value = ruleDescriptors(text, 'linkage', { id: 'l1', action: 'assign' }).find(descriptor => descriptor.path[0] === 'value')!
    expect(value.visibleWhen).toEqual({ path: ['action'], equals: 'assign' })
  })

  it('改参数换成整条规则：清空即去掉参数，动作不再是 assign 时去掉赋值', () => {
    const rule: ValidationRule = { id: 'v', kind: 'length', min: 1, max: 5 }
    expect(nextRule('validation', rule, 'max', undefined)).toEqual({ id: 'v', kind: 'length', min: 1 })
    const linkage: LinkageRule = { id: 'l', action: 'assign', when: 'a > 1', value: '1' }
    expect(nextRule('linkage', linkage, 'action', 'hide')).toEqual({ id: 'l', action: 'hide', when: 'a > 1' })
  })

  it('规则上的问题落到对应参数上，落在整条规则上时落到第一个参数；表达式的编译问题留给表达式输入框', () => {
    const { document, text } = sample()
    const next = applyOperations(document, [
      { type: 'insertRule', nodeId: text.id, list: 'validation', index: 0, rule: { id: 'v1', kind: 'length' } },
      { type: 'insertRule', nodeId: text.id, list: 'validation', index: 1, rule: { id: 'v2', kind: 'pattern', pattern: '(' } },
      { type: 'insertRule', nodeId: text.id, list: 'linkage', index: 0, rule: { id: 'l1', action: 'hide', when: 'name +' } },
    ]).document
    const node = next.children[0]!
    const issues = validateDocument(next, { expressionEngine: createExpressionEngine() })
    const validation = ruleErrors(next, node, 'validation', issues, issue => issue.code)
    expect(validation.get('v1')).toEqual([{ target: { kind: 'rule', id: 'v1' }, path: ['min'], message: 'rule.boundsMissing' }])
    expect(validation.get('v2')).toEqual([{ target: { kind: 'rule', id: 'v2' }, path: ['pattern'], message: 'rule.invalidPattern' }])
    expect(issues.some(issue => issue.code === 'expression.invalid' && issue.target?.id === 'l1')).toBe(true)
    expect(ruleErrors(next, node, 'linkage', issues, issue => issue.code).get('l1')).toBeUndefined()
  })
})
