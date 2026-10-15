import type { FieldNode, FormNode, ValidationRule } from '../src'
import { describe, expect, it } from 'vitest'
import { isEmptyValue, resolveLinkage, validateValues } from '../src'
import { createFakeEngine } from './fake-engine'
import { containerOf, documentOf, fieldOf, setup, withChildren } from './helpers'

function ruled<T extends FieldNode>(node: T, validation: ValidationRule[]): T {
  return { ...node, validation }
}

function codes(document: ReturnType<typeof documentOf>, values: Record<string, never> | Record<string, unknown>, options?: Parameters<typeof validateValues>[2]): string[] {
  return validateValues(document, values as never, options).map(issue => issue.code)
}

describe('空值', () => {
  it.each([null, undefined, '', '  \n', false, [], ['', ''], [null]])('%j 为空', (value) => {
    expect(isEmptyValue(value)).toBe(true)
  })

  it.each([0, 'a', true, ['a', ''], [0], { strokes: [] }])('%j 不为空', (value) => {
    expect(isEmptyValue(value)).toBe(false)
  })
})

describe('值校验：内置规则', () => {
  it('必填：空值报出，带上规则 id、路径与作者写的提示', () => {
    const { registry, ids } = setup()
    const name = ruled(fieldOf(registry, ids, 'text', 'name'), [{ id: 'r', kind: 'required', message: '请填写姓名' }])
    expect(validateValues(documentOf([name]), { name: ' ' })).toEqual([
      { code: 'XH_FORM_VALUE_REQUIRED', nodeId: name.id, ruleId: 'r', path: ['name'], message: '请填写姓名' },
    ])
    expect(validateValues(documentOf([name]), { name: 'x' })).toEqual([])
  })

  it('勾选框必填即必须勾上', () => {
    const { registry, ids } = setup()
    const agree = ruled(fieldOf(registry, ids, 'checkbox', 'agree'), [{ id: 'r', kind: 'required' }])
    expect(codes(documentOf([agree]), { agree: false })).toEqual(['XH_FORM_VALUE_REQUIRED'])
    expect(codes(documentOf([agree]), { agree: true })).toEqual([])
  })

  it('值为空且不必填时跳过其余规则', () => {
    const { registry, ids } = setup()
    const name = ruled(fieldOf(registry, ids, 'text', 'name'), [{ id: 'l', kind: 'length', min: 2 }, { id: 'p', kind: 'pattern', pattern: '\\d+' }])
    expect(codes(documentOf([name]), { name: '' })).toEqual([])
  })

  it('长度按码点数文本、按元素数列表', () => {
    const { registry, ids } = setup()
    const name = ruled(fieldOf(registry, ids, 'text', 'name'), [{ id: 'l', kind: 'length', min: 2, max: 3 }])
    expect(validateValues(documentOf([name]), { name: '😀' })).toEqual([
      { code: 'XH_FORM_VALUE_TOO_SHORT', nodeId: name.id, ruleId: 'l', path: ['name'], data: { min: 2, actual: 1 } },
    ])
    expect(codes(documentOf([name]), { name: '😀😀😀' })).toEqual([])
    expect(codes(documentOf([name]), { name: 'abcd' })).toEqual(['XH_FORM_VALUE_TOO_LONG'])
    const tags = ruled(fieldOf(registry, ids, 'tags', 'tags'), [{ id: 'l', kind: 'length', max: 1 }])
    expect(codes(documentOf([tags]), { tags: ['a', 'b'] })).toEqual(['XH_FORM_VALUE_TOO_LONG'])
  })

  it('范围是闭区间', () => {
    const { registry, ids } = setup()
    const age = ruled(fieldOf(registry, ids, 'number', 'age'), [{ id: 'r', kind: 'range', min: 18, max: 60 }])
    expect(codes(documentOf([age]), { age: 18 })).toEqual([])
    expect(codes(documentOf([age]), { age: 60 })).toEqual([])
    expect(validateValues(documentOf([age]), { age: 17.5 })).toEqual([
      { code: 'XH_FORM_VALUE_TOO_SMALL', nodeId: age.id, ruleId: 'r', path: ['age'], data: { min: 18 } },
    ])
    expect(codes(documentOf([age]), { age: 61 })).toEqual(['XH_FORM_VALUE_TOO_LARGE'])
  })

  it('正则整串匹配，标志生效，非法正则报 XH_FORM_INVALID_PATTERN', () => {
    const { registry, ids } = setup()
    const code = ruled(fieldOf(registry, ids, 'text', 'code'), [{ id: 'p', kind: 'pattern', pattern: '[a-z]+\\d', flags: 'i' }])
    expect(codes(documentOf([code]), { code: 'ABC1' })).toEqual([])
    expect(codes(documentOf([code]), { code: 'ABC1x' })).toEqual(['XH_FORM_VALUE_PATTERN_MISMATCH'])
    const broken = ruled(fieldOf(registry, ids, 'text', 'b'), [{ id: 'p', kind: 'pattern', pattern: '(' }])
    expect(codes(documentOf([broken]), { b: 'x' })).toEqual(['XH_FORM_INVALID_PATTERN'])
  })

  it('同一个正则在一次校验里只编译一次，跨行重复使用不带状态', () => {
    const { registry, ids } = setup()
    const code = ruled(fieldOf(registry, ids, 'text', 'code'), [{ id: 'p', kind: 'pattern', pattern: 'a' }])
    const lines = withChildren(containerOf(registry, ids, 'subtable', 'lines'), 0, [code])
    expect(codes(documentOf([lines]), { lines: [{ code: 'a' }, { code: 'a' }, { code: 'b' }] })).toEqual(['XH_FORM_VALUE_PATTERN_MISMATCH'])
  })

  it('值的形状与规则不符', () => {
    const { registry, ids } = setup()
    const name = ruled(fieldOf(registry, ids, 'text', 'name'), [{ id: 'l', kind: 'length', min: 1 }, { id: 'p', kind: 'pattern', pattern: 'x' }])
    expect(codes(documentOf([name]), { name: 5 })).toEqual(['XH_FORM_VALUE_TYPE_MISMATCH', 'XH_FORM_VALUE_TYPE_MISMATCH'])
    const age = ruled(fieldOf(registry, ids, 'number', 'age'), [{ id: 'r', kind: 'range', min: 1 }])
    expect(codes(documentOf([age]), { age: '5' })).toEqual(['XH_FORM_VALUE_TYPE_MISMATCH'])
  })
})

describe('值校验：表达式规则', () => {
  it('结果为 false 不通过，true 与 null 通过，其余报问题', () => {
    const { registry, ids } = setup()
    const start = fieldOf(registry, ids, 'date', 'start')
    const end = ruled(fieldOf(registry, ids, 'date', 'end'), [{ id: 'e', kind: 'expression', expression: 'end-after-start', message: '结束不能早于开始' }])
    const engine = createFakeEngine({ 'end-after-start': scope => (scope.$value as string) >= (scope.start as string) })
    const document = documentOf([start, end])
    expect(validateValues(document, { start: '2026-10-16', end: '2026-10-01' }, { engine })).toEqual([
      { code: 'XH_FORM_VALUE_EXPRESSION_FALSE', nodeId: end.id, ruleId: 'e', path: ['end'], message: '结束不能早于开始' },
    ])
    expect(validateValues(document, { start: '2026-10-01', end: '2026-10-16' }, { engine })).toEqual([])
    const odd = ruled(fieldOf(registry, ids, 'text', 'x'), [{ id: 'a', kind: 'expression', expression: 'null' }, { id: 'b', kind: 'expression', expression: 'number' }, { id: 'c', kind: 'expression', expression: 'missing' }])
    expect(validateValues(documentOf([odd]), { x: 'v' }, { engine: createFakeEngine({ null: null, number: 1 }) })).toEqual([
      { code: 'XH_FORM_CONDITION_NOT_BOOLEAN', nodeId: odd.id, ruleId: 'b', path: ['x'] },
      { code: 'XH_FORM_EXPRESSION_FAILED', nodeId: odd.id, ruleId: 'c', path: ['x'], data: { expressionCode: 'MISSING', start: 0, end: 7 } },
    ])
  })

  it('有表达式规则却没有引擎时抛 TypeError', () => {
    const { registry, ids } = setup()
    const node = ruled(fieldOf(registry, ids, 'text', 'x'), [{ id: 'e', kind: 'expression', expression: 'true' }])
    expect(() => validateValues(documentOf([node]), { x: 'v' })).toThrow(TypeError)
  })

  it('列表行里的表达式读得到 $row 与 $index，宿主变量一并传入', () => {
    const { registry, ids } = setup()
    const qty = ruled(fieldOf(registry, ids, 'number', 'qty'), [{ id: 'e', kind: 'expression', expression: 'within-stock' }])
    const lines = withChildren(containerOf(registry, ids, 'subtable', 'lines'), 0, [qty])
    const engine = createFakeEngine({ 'within-stock': scope => (scope.$value as number) <= (scope.$stock as number[])[scope.$index as number]! })
    expect(validateValues(documentOf([lines]), { lines: [{ qty: 1 }, { qty: 9 }] }, { engine, variables: { $stock: [5, 5] } })).toEqual([
      { code: 'XH_FORM_VALUE_EXPRESSION_FALSE', nodeId: qty.id, ruleId: 'e', path: ['lines', 1, 'qty'] },
    ])
  })
})

describe('值校验：状态与列表', () => {
  it('隐藏或禁用的实例连同后代都不校验', () => {
    const { registry, ids } = setup()
    const inner = ruled(fieldOf(registry, ids, 'text', 'inner'), [{ id: 'r', kind: 'required' }])
    const hiddenCard: FormNode = { ...withChildren(containerOf(registry, ids, 'card'), 0, [inner]), basic: { title: '', hidden: true } }
    expect(codes(documentOf([hiddenCard]), { inner: '' })).toEqual([])
    const disabled = { ...inner, basic: { label: '', disabled: true } }
    expect(codes(documentOf([disabled]), { inner: '' })).toEqual([])
  })

  it('联动求出的状态决定必填与跳过', () => {
    const { registry, ids } = setup()
    const kind = fieldOf(registry, ids, 'radio-group', 'kind')
    const company: FieldNode = {
      ...fieldOf(registry, ids, 'text', 'company'),
      linkage: [{ id: 'l1', action: 'require', when: 'is-org' }, { id: 'l2', action: 'hide', when: 'is-person' }],
    }
    const engine = createFakeEngine({ 'is-org': scope => scope.kind === 'org', 'is-person': scope => scope.kind === 'person' })
    const document = documentOf([kind, company])
    const org = { kind: 'org', company: '' }
    expect(validateValues(document, org, { states: resolveLinkage(document, org, { engine }).states })).toEqual([
      { code: 'XH_FORM_VALUE_REQUIRED', nodeId: company.id, path: ['company'] },
    ])
    const person = { kind: 'person', company: '' }
    expect(codes(document, person, { states: resolveLinkage(document, person, { engine }).states })).toEqual([])
  })

  it('列表容器的必填与行数，行内字段按行报出路径', () => {
    const { registry, ids } = setup()
    const price = ruled(fieldOf(registry, ids, 'number', 'price'), [{ id: 'p', kind: 'required' }])
    const lines = { ...withChildren(containerOf(registry, ids, 'subtable', 'lines'), 0, [price]), validation: [{ id: 'r', kind: 'required' }, { id: 'n', kind: 'length', max: 2 }] as ValidationRule[] }
    const document = documentOf([lines])
    expect(validateValues(document, { lines: [] })).toEqual([{ code: 'XH_FORM_VALUE_REQUIRED', nodeId: lines.id, ruleId: 'r', path: ['lines'] }])
    expect(validateValues(document, { lines: [{ price: 1 }, { price: null }, { price: 3 }] })).toEqual([
      { code: 'XH_FORM_VALUE_TOO_LONG', nodeId: lines.id, ruleId: 'n', path: ['lines'], data: { max: 2, actual: 3 } },
      { code: 'XH_FORM_VALUE_REQUIRED', nodeId: price.id, ruleId: 'p', path: ['lines', 1, 'price'] },
    ])
  })

  it('嵌套列表逐层带上行号', () => {
    const { registry, ids } = setup()
    const qty = ruled(fieldOf(registry, ids, 'number', 'qty'), [{ id: 'q', kind: 'range', min: 1 }])
    const lines = withChildren(containerOf(registry, ids, 'subtable', 'lines'), 0, [qty])
    const orders = withChildren(containerOf(registry, ids, 'subform', 'orders'), 0, [lines])
    expect(validateValues(documentOf([orders]), { orders: [{ lines: [{ qty: 1 }] }, { lines: [{ qty: 2 }, { qty: 0 }] }] }).map(issue => issue.path))
      .toEqual([['orders', 1, 'lines', 1, 'qty']])
  })
})
