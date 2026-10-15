import type { ExpressionEngine } from '@xihan-ui/expression'
import type { FieldNode, FormNode, LinkageRule } from '../src'
import { describe, expect, it } from 'vitest'
import { createInitialValues, instanceKey, resolveLinkage } from '../src'
import { createFakeEngine } from './fake-engine'
import { containerOf, documentOf, fieldOf, setup, withChildren } from './helpers'

function linked<T extends FormNode>(node: T, linkage: LinkageRule[]): T {
  return { ...node, linkage }
}

describe('联动：状态', () => {
  it('没有规则时取静态设定，必填取决于有没有必填规则', () => {
    const { registry, ids } = setup()
    const a = { ...fieldOf(registry, ids, 'text', 'a'), basic: { label: '', hidden: true } }
    const b: FieldNode = { ...fieldOf(registry, ids, 'text', 'b'), validation: [{ id: 'r', kind: 'required' }] }
    const result = resolveLinkage(documentOf([a, b]), { a: '', b: '' }, { expressionEngine: createFakeEngine() })
    expect(result.states.get(a.id)).toEqual({ hidden: true, disabled: false, readOnly: false, required: false })
    expect(result.states.get(b.id)).toEqual({ hidden: false, disabled: false, readOnly: false, required: true })
    expect(result.issues).toEqual([])
  })

  it('条件成立时执行动作，不成立时回到静态设定；后面的规则覆盖前面的', () => {
    const { registry, ids } = setup()
    const kind = fieldOf(registry, ids, 'radio-group', 'kind')
    const company = linked(fieldOf(registry, ids, 'text', 'company'), [
      { id: 'l1', action: 'hide' },
      { id: 'l2', action: 'show', when: 'kind == \'org\'' },
      { id: 'l3', action: 'require', when: 'kind == \'org\'' },
      { id: 'l4', action: 'disable', when: 'locked' },
    ])
    const engine = createFakeEngine({
      'kind == \'org\'': scope => scope.kind === 'org',
      'locked': scope => scope.$locked ?? null,
    })
    const document = documentOf([kind, company])
    const personal = resolveLinkage(document, { kind: 'person', company: '' }, { expressionEngine: engine })
    expect(personal.states.get(company.id)).toEqual({ hidden: true, disabled: false, readOnly: false, required: false })
    const org = resolveLinkage(document, { kind: 'org', company: '' }, { expressionEngine: engine, variables: { $locked: true } })
    expect(org.states.get(company.id)).toEqual({ hidden: false, disabled: true, readOnly: false, required: true })
  })

  it('容器的隐藏与禁用向下叠加，表单设置的禁用与只读作用于全部节点', () => {
    const { registry, ids } = setup()
    const inner = fieldOf(registry, ids, 'text', 'inner')
    const card = linked(withChildren(containerOf(registry, ids, 'card'), 0, [inner]), [{ id: 'l', action: 'hide', when: 'flag' }])
    const engine = createFakeEngine({ flag: true })
    const document = documentOf([card])
    expect(resolveLinkage(document, { inner: '' }, { expressionEngine: engine }).states.get(inner.id)).toMatchObject({ hidden: true })
    const locked = { ...documentOf([inner]), settings: { disabled: true, readOnly: true } }
    expect(resolveLinkage(locked, { inner: '' }, { expressionEngine: engine }).states.get(inner.id)).toEqual({ hidden: false, disabled: true, readOnly: true, required: false })
  })

  it('列表里的节点按行各有一份状态，表达式能读到 $row、$index 与 $value', () => {
    const { registry, ids } = setup()
    const qty = linked(fieldOf(registry, ids, 'number', 'qty'), [{ id: 'l', action: 'disable', when: 'row-locked' }])
    const lines = withChildren(containerOf(registry, ids, 'subtable', 'lines'), 0, [qty])
    const engine = createFakeEngine({ 'row-locked': scope => (scope.$row as { locked?: boolean }).locked === true && scope.$index === 1 && scope.$value === 2 })
    const result = resolveLinkage(documentOf([lines]), { lines: [{ qty: 1 }, { qty: 2, locked: true }] }, { expressionEngine: engine })
    expect(result.states.get(instanceKey(qty.id, [0]))?.disabled).toBe(false)
    expect(result.states.get(instanceKey(qty.id, [1]))?.disabled).toBe(true)
    expect(instanceKey(qty.id, [1])).toBe(`${qty.id}#1`)
    expect(instanceKey('n', [0, 3])).toBe('n#0.3')
  })
})

describe('联动：宿主强制设定与引擎', () => {
  it('强制设定覆盖联动结果，并向后代叠加；实例键的设定叠在节点 id 的设定之上', () => {
    const { registry, ids } = setup()
    const qty = linked(fieldOf(registry, ids, 'number', 'qty'), [{ id: 'l', action: 'disable', when: 'always' }])
    const lines = withChildren(containerOf(registry, ids, 'subtable', 'lines'), 0, [qty])
    const card = withChildren(containerOf(registry, ids, 'card'), 0, [lines])
    const engine = createFakeEngine({ always: true })
    const values = { lines: [{ qty: 1 }, { qty: 2 }] }
    const overrides = new Map([
      [qty.id, { disabled: false, readOnly: true }],
      [instanceKey(qty.id, [1]), { disabled: true }],
      [card.id, { hidden: true }],
    ])
    const result = resolveLinkage(documentOf([card]), values, { expressionEngine: engine, overrides })
    expect(result.states.get(card.id)).toEqual({ hidden: true, disabled: false, readOnly: false, required: false })
    expect(result.states.get(instanceKey(qty.id, [0]))).toEqual({ hidden: true, disabled: false, readOnly: true, required: false })
    expect(result.states.get(instanceKey(qty.id, [1]))).toEqual({ hidden: true, disabled: true, readOnly: true, required: false })
  })

  it('强制取消隐藏挡不住祖先的隐藏', () => {
    const { registry, ids } = setup()
    const inner = { ...fieldOf(registry, ids, 'text', 'inner'), basic: { label: '', hidden: true } }
    const card = { ...withChildren(containerOf(registry, ids, 'card'), 0, [inner]), basic: { title: '', hidden: true } }
    const result = resolveLinkage(documentOf([card]), { inner: '' }, { overrides: new Map([[inner.id, { hidden: false }]]) })
    expect(result.states.get(inner.id)?.hidden).toBe(true)
  })

  it('没有带表达式的规则时可以不传引擎，有则抛 TypeError', () => {
    const { registry, ids } = setup()
    const plain = linked(fieldOf(registry, ids, 'text', 'a'), [{ id: 'l1', action: 'hide' }])
    expect(resolveLinkage(documentOf([plain]), { a: '' }).states.get(plain.id)?.hidden).toBe(true)
    const conditional = linked(fieldOf(registry, ids, 'text', 'b'), [{ id: 'l2', action: 'hide', when: 'x' }])
    expect(() => resolveLinkage(documentOf([conditional]), { b: '' })).toThrow(TypeError)
  })
})

describe('联动：经引擎编译', () => {
  it('同一次联动里同一源码只编译一次，编译失败按求值失败报出', () => {
    const { registry, ids } = setup()
    const qty = linked(fieldOf(registry, ids, 'number', 'qty'), [{ id: 'a', action: 'disable', when: 'locked' }, { id: 'b', action: 'hide', when: 'bad @@' }])
    const lines = withChildren(containerOf(registry, ids, 'subtable', 'lines'), 0, [qty])
    const engine = createFakeEngine({ locked: false })
    let compiles = 0
    const counting = { compile: (source: string) => {
      compiles += 1
      return engine.compile(source)
    } }
    const result = resolveLinkage(documentOf([lines]), { lines: [{ qty: 1 }, { qty: 2 }, { qty: 3 }] }, { expressionEngine: counting })
    expect(compiles).toBe(2)
    expect(result.issues.map(issue => [issue.code, issue.data?.expressionCode, issue.data?.instance])).toEqual([
      ['XH_FORM_EXPRESSION_FAILED', 'XH_EXPR_UNEXPECTED_TOKEN', `${qty.id}#0`],
      ['XH_FORM_EXPRESSION_FAILED', 'XH_EXPR_UNEXPECTED_TOKEN', `${qty.id}#1`],
      ['XH_FORM_EXPRESSION_FAILED', 'XH_EXPR_UNEXPECTED_TOKEN', `${qty.id}#2`],
    ])
  })
})

describe('联动：赋值', () => {
  it('赋值写进工作副本，后面的表达式读到新值，输入不被修改', () => {
    const { registry, ids } = setup()
    const price = fieldOf(registry, ids, 'number', 'price')
    const qty = fieldOf(registry, ids, 'number', 'qty')
    const total = linked(fieldOf(registry, ids, 'number', 'total'), [{ id: 'l1', action: 'assign', value: 'price * qty' }])
    const label = linked(fieldOf(registry, ids, 'text', 'label'), [{ id: 'l2', action: 'assign', when: 'total > 100', value: '\'big\'' }])
    const engine = createFakeEngine({
      'price * qty': scope => (scope.price as number) * (scope.qty as number),
      'total > 100': scope => (scope.total as number) > 100,
      '\'big\'': 'big',
    })
    const input = { price: 30, qty: 4, total: null, label: '' }
    const result = resolveLinkage(documentOf([price, qty, total, label]), input, { expressionEngine: engine })
    expect(result.values).toEqual({ price: 30, qty: 4, total: 120, label: 'big' })
    expect(result.assignments).toEqual([
      { nodeId: total.id, path: ['total'], value: 120 },
      { nodeId: label.id, path: ['label'], value: 'big' },
    ])
    expect(input.total).toBeNull()
  })

  it('列表行里的赋值落在对应的行上', () => {
    const { registry, ids } = setup()
    const price = fieldOf(registry, ids, 'number', 'price')
    const amount = linked(fieldOf(registry, ids, 'number', 'amount'), [{ id: 'l', action: 'assign', value: 'double' }])
    const lines = withChildren(containerOf(registry, ids, 'subtable', 'lines'), 0, [price, amount])
    const engine = createFakeEngine({ double: scope => ((scope.$row as { price: number }).price) * 2 })
    const result = resolveLinkage(documentOf([lines]), { lines: [{ price: 1, amount: null }, { price: 5, amount: null }] }, { expressionEngine: engine })
    expect(result.values).toEqual({ lines: [{ price: 1, amount: 2 }, { price: 5, amount: 10 }] })
    expect(result.assignments.map(item => item.path)).toEqual([['lines', 0, 'amount'], ['lines', 1, 'amount']])
  })

  it('赋值结果不是 JSON 值时报问题、不写入', () => {
    const { registry, ids } = setup()
    const node = linked(fieldOf(registry, ids, 'text', 'x'), [{ id: 'l', action: 'assign', value: 'bad' }])
    const result = resolveLinkage(documentOf([node]), { x: 'keep' }, { expressionEngine: createFakeEngine({ bad: Number.NaN }) })
    expect(result.values).toEqual({ x: 'keep' })
    expect(result.issues).toEqual([{ code: 'XH_FORM_VALUE_TYPE_MISMATCH', nodeId: node.id, ruleId: 'l', data: { instance: node.id } }])
  })
})

describe('联动：表达式的问题', () => {
  it('求值失败与条件不是布尔都报出，规则视为不成立', () => {
    const { registry, ids } = setup()
    const node = linked(fieldOf(registry, ids, 'text', 'x'), [
      { id: 'a', action: 'hide', when: 'missing' },
      { id: 'b', action: 'hide', when: 'number' },
      { id: 'c', action: 'assign', value: 'missing' },
    ])
    const result = resolveLinkage(documentOf([node]), { x: '' }, { expressionEngine: createFakeEngine({ number: 1 }) })
    expect(result.states.get(node.id)?.hidden).toBe(false)
    expect(result.issues).toEqual([
      { code: 'XH_FORM_EXPRESSION_FAILED', nodeId: node.id, ruleId: 'a', data: { part: 'when', instance: node.id, expressionCode: 'XH_EXPR_FUNCTION_FAILED', start: 0, end: 7 } },
      { code: 'XH_FORM_CONDITION_NOT_BOOLEAN', nodeId: node.id, ruleId: 'b', data: { part: 'when', instance: node.id } },
      { code: 'XH_FORM_EXPRESSION_FAILED', nodeId: node.id, ruleId: 'c', data: { part: 'value', instance: node.id, expressionCode: 'XH_EXPR_FUNCTION_FAILED', start: 0, end: 7 } },
    ])
  })

  it('引擎编译失败却没给出问题时抛 TypeError', () => {
    const { registry, ids } = setup()
    const node = linked(fieldOf(registry, ids, 'text', 'x'), [{ id: 'a', action: 'hide', when: 'broken' }])
    const engine: ExpressionEngine = { compile: () => ({ ok: false, issues: [] }) }
    expect(() => resolveLinkage(documentOf([node]), { x: '' }, { expressionEngine: engine })).toThrow(TypeError)
  })

  it('与初始值配合：同一份文档与值多次求值结果相同', () => {
    const { registry, ids } = setup()
    const a = linked(fieldOf(registry, ids, 'number', 'a'), [{ id: 'l', action: 'assign', value: 'one' }])
    const document = documentOf([a])
    const values = createInitialValues(document, registry)
    const engine = createFakeEngine({ one: 1 })
    const first = resolveLinkage(document, values, { expressionEngine: engine })
    const second = resolveLinkage(document, values, { expressionEngine: engine })
    expect(second.values).toEqual(first.values)
    expect([...second.states]).toEqual([...first.states])
  })
})
