import type { JsonValue } from '@xihan-ui/core/json'
import type { ContainerNode, FieldNode, FormDocument, FormNode, LinkageRule, ValidationRule } from '../src'
import { describe, expect, it } from 'vitest'
import { createNode, validateDocument } from '../src'
import { createFakeEngine } from './fake-engine'
import { containerOf, documentOf, fieldOf, setup, withChildren } from './helpers'

function sample() {
  const { registry, ids } = setup()
  const name = fieldOf(registry, ids, 'text', 'name')
  const price = fieldOf(registry, ids, 'number', 'price')
  const lines = withChildren(containerOf(registry, ids, 'subtable', 'lines'), 0, [price])
  const table = containerOf(registry, ids, 'table')
  const divider = createNode(registry, 'divider', ids)
  const document = documentOf([name, lines, table, divider])
  return { registry, ids, document, name, price, lines, table }
}

function codes(document: unknown, ...rest: Parameters<typeof validateDocument> extends [unknown, ...infer R] ? R : never): string[] {
  return validateDocument(document, ...rest).map(issue => issue.code)
}

function replaceNode(document: FormDocument, index: number, node: unknown): FormDocument {
  return { ...document, children: document.children.map((child, at) => (at === index ? node : child)) as FormNode[] }
}

interface Target { kind: 'node' | 'region' | 'rule', id: string }
const node = (id: string): Target => ({ kind: 'node', id })
const region = (id: string): Target => ({ kind: 'region', id })
const rule = (id: string): Target => ({ kind: 'rule', id })

/** 期望的一条问题：缺省严重程度为 error，没有 target、params 时不带这两个键。 */
function issue(code: string, path: (string | number)[], target?: Target, params?: Record<string, unknown>): Record<string, unknown> {
  return { code, path, ...(target ? { target } : {}), severity: 'error', ...(params ? { params } : {}) }
}

describe('schema 自校验：文档与节点结构', () => {
  it('新建出来的文档没有问题', () => {
    const { document } = sample()
    expect(validateDocument(document)).toEqual([])
  })

  it('文档不是对象、版本不对、缺字段、有多余字段', () => {
    expect(validateDocument(null)).toEqual([issue('invalid-type', [], undefined, { expected: 'object' })])
    expect(validateDocument(undefined)).toEqual([issue('invalid-type', [], undefined, { expected: 'object' })])
    expect(validateDocument({ schemaVersion: 2, settings: {}, children: [] })).toEqual([issue('document.unsupportedVersion', ['schemaVersion'], undefined, { version: '2' })])
    expect(validateDocument({ schemaVersion: 1, settings: {} })).toEqual([issue('required', ['children'])])
    expect(validateDocument({ schemaVersion: 1, settings: { size: 'xl', foo: 1 }, children: [], extra: true })).toEqual([
      issue('unknown-key', ['extra']),
      issue('invalid-option', ['settings', 'size']),
      issue('unknown-key', ['settings', 'foo']),
    ])
  })

  it('节点不是对象、缺 id、类型不对、分组或规则表的类型不对', () => {
    const { document, name } = sample()
    expect(validateDocument(replaceNode(document, 0, 'x'))).toEqual([issue('invalid-type', ['children', 0], undefined, { expected: 'object' })])
    expect(validateDocument(replaceNode(document, 0, { ...name, id: '' }))).toEqual([issue('empty', ['children', 0, 'id'])])
    expect(validateDocument(replaceNode(document, 0, { ...name, type: 'script' }))).toEqual([
      issue('invalid-option', ['children', 0, 'type'], node(name.id), { choices: ['field', 'container', 'static'] }),
    ])
    expect(codes(replaceNode(document, 0, { ...name, basic: [] }))).toEqual(['invalid-type'])
    expect(validateDocument(replaceNode(document, 0, { ...name, validation: {} }))).toEqual([
      issue('invalid-type', ['children', 0, 'validation'], node(name.id), { expected: 'array' }),
    ])
    const { kind: _kind, ...withoutKind } = name
    expect(validateDocument(replaceNode(document, 0, withoutKind))).toEqual([issue('required', ['children', 0, 'kind'], node(name.id))])
  })

  it('节点上未定义的字段一律报出，模板里不能夹带别的东西', () => {
    const { document, name } = sample()
    expect(validateDocument(replaceNode(document, 0, { ...name, onClick: 'alert(1)' }))).toEqual([
      issue('unknown-key', ['children', 0, 'onClick'], node(name.id)),
    ])
  })

  it('id 在节点、区域与规则之间都不能重复', () => {
    const { document, name, lines } = sample()
    const twin = { ...name, key: 'other' }
    expect(validateDocument(documentOf([...document.children, twin]))).toEqual([
      issue('duplicate-id', ['children', 4, 'id'], node(name.id), { id: name.id }),
    ])
    const regionId = lines.regions[0]!.id
    const clash: FieldNode = { ...name, validation: [{ id: regionId, kind: 'required' }] }
    expect(validateDocument(replaceNode(document, 0, clash))).toEqual([
      issue('duplicate-id', ['children', 1, 'regions', 0, 'id'], region(regionId), { id: regionId }),
    ])
  })

  it('种类没有登记、类型与登记不符', () => {
    const { document, name } = sample()
    expect(validateDocument(replaceNode(document, 0, { ...name, kind: 'nope' }))).toEqual([
      issue('node.unknownKind', ['children', 0, 'kind'], node(name.id), { kind: 'nope' }),
    ])
    expect(validateDocument(replaceNode(document, 0, { ...name, kind: 'grid' }))).toEqual([
      issue('node.kindTypeMismatch', ['children', 0, 'type'], node(name.id), { kind: 'grid', type: 'field' }),
    ])
  })

  it('嵌套层数上限', () => {
    const { registry, ids } = setup()
    let deep: FormNode = fieldOf(registry, ids, 'text', 'deep')
    for (let index = 0; index < 40; index += 1)
      deep = withChildren(containerOf(registry, ids, 'card'), 0, [deep])
    const issues = validateDocument(documentOf([deep]))
    expect(issues.map(item => [item.code, item.params])).toEqual([['document.tooDeep', { max: 32 }]])
    expect(issues[0]!.path).toHaveLength(2 + 32 * 4)
    expect(codes(documentOf([deep]), { maxDepth: 50 })).toEqual([])
    expect(() => validateDocument(documentOf([]), { maxDepth: 0 })).toThrow(TypeError)
  })

  it('严重程度可以按问题码改，off 去掉该码', () => {
    const { document, name } = sample()
    const broken = replaceNode(document, 0, { ...name, onClick: 'x', kind: 'nope' })
    expect(validateDocument(broken, { severity: { 'unknown-key': 'warning', 'node.unknownKind': 'off' } })).toEqual([
      { ...issue('unknown-key', ['children', 0, 'onClick'], node(name.id)), severity: 'warning' },
    ])
  })
})

describe('schema 自校验：属性与数据键', () => {
  it('属性名没有描述、取值不符合描述', () => {
    const { document, name } = sample()
    const changed = { ...name, basic: { ...name.basic, label: 1, colour: 'red' }, appearance: { size: 'huge' } }
    expect(validateDocument(replaceNode(document, 0, changed))).toEqual([
      issue('invalid-type', ['children', 0, 'basic', 'label'], node(name.id)),
      issue('unknown-key', ['children', 0, 'basic', 'colour'], node(name.id)),
      issue('invalid-option', ['children', 0, 'appearance', 'size'], node(name.id)),
    ])
  })

  it('选项列表的问题落在那一项的那个键上：第 3 项的值为空、第 2 项缺文字、值重复', () => {
    const { registry, ids } = setup()
    const select = fieldOf(registry, ids, 'select', 'city')
    const at = (options: JsonValue): FormDocument => documentOf([{ ...select, data: { ...select.data, options } }])
    const path = ['children', 0, 'data', 'options']
    expect(validateDocument(at([{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }, { value: '', label: '丙' }]))).toEqual([
      issue('required', [...path, 2, 'value'], node(select.id)),
    ])
    expect(validateDocument(at([{ value: 'a', label: '甲' }, { value: 'b' }]))).toEqual([issue('required', [...path, 1, 'label'], node(select.id))])
    expect(validateDocument(at([{ value: 'a', label: '甲' }, { value: 'a', label: '乙' }]))).toEqual([issue('duplicate-value', [...path, 1, 'value'], node(select.id))])
  })

  it('初始值要符合字段的值形状，形状随多选开关变化', () => {
    const { registry, ids } = setup()
    const single = { ...fieldOf(registry, ids, 'select', 'a'), basic: { label: '', initialValue: ['x'] } }
    const multiple = { ...fieldOf(registry, ids, 'select', 'b'), basic: { label: '', initialValue: ['x'] }, data: { options: [], multiple: true } }
    expect(validateDocument(documentOf([single, multiple]))).toEqual([
      issue('invalid-value', ['children', 0, 'basic', 'initialValue'], node(single.id), { valueKind: 'string' }),
    ])
  })

  it('数据键缺失、不合法、在同一作用域重复；不同作用域可以同名', () => {
    const { registry, ids, document, name, lines } = sample()
    expect(validateDocument(replaceNode(document, 0, { ...name, key: undefined }))).toEqual([issue('required', ['children', 0, 'key'], node(name.id))])
    expect(validateDocument(replaceNode(document, 0, { ...name, key: '1st' }))).toEqual([
      issue('invalid-value', ['children', 0, 'key'], node(name.id), { key: '1st' }),
    ])
    expect(validateDocument(replaceNode(document, 0, { ...name, key: 'lines' }))).toEqual([
      issue('duplicate-key', ['children', 1, 'key'], node(lines.id), { key: 'lines' }),
    ])
    const inner = fieldOf(registry, ids, 'text', 'name')
    const nested = withChildren(lines, 0, [...lines.regions[0]!.children, inner])
    expect(codes(replaceNode(document, 1, nested))).toEqual([])
  })

  it('列表容器必须带键，布局容器不能带键', () => {
    const { document, lines, table } = sample()
    const { key: _key, ...withoutKey } = lines
    expect(validateDocument(replaceNode(document, 1, withoutKey))).toEqual([issue('required', ['children', 1, 'key'], node(lines.id))])
    expect(validateDocument(replaceNode(document, 2, { ...table, key: 'x' }))).toEqual([issue('unknown-key', ['children', 2, 'key'], node(table.id))])
  })
})

describe('schema 自校验：区域', () => {
  it('区域个数超出种类的上下限', () => {
    const { registry, ids } = setup()
    const card = containerOf(registry, ids, 'card')
    const twoRegions: ContainerNode = { ...card, regions: [card.regions[0]!, { id: 'r2', props: {}, children: [] }] }
    expect(validateDocument(documentOf([twoRegions]))).toEqual([
      issue('out-of-range', ['children', 0, 'regions'], node(card.id), { min: 1, max: 1, actual: 2 }),
    ])
    const tabs = containerOf(registry, ids, 'tabs')
    expect(validateDocument(documentOf([{ ...tabs, regions: [] }]))).toEqual([
      issue('out-of-range', ['children', 0, 'regions'], node(tabs.id), { min: 1, actual: 0 }),
    ])
  })

  it('区域结构不对、区域属性不符合描述', () => {
    const { registry, ids } = setup()
    const grid = containerOf(registry, ids, 'grid')
    const first = grid.regions[0]!
    const broken: ContainerNode = { ...grid, regions: [{ ...first, props: { span: 13, width: 1 } }, { id: 'x' } as never] }
    expect(validateDocument(documentOf([broken]))).toEqual([
      issue('out-of-range', ['children', 0, 'regions', 0, 'props', 'span'], region(first.id)),
      issue('unknown-key', ['children', 0, 'regions', 0, 'props', 'width'], region(first.id)),
      issue('required', ['children', 0, 'regions', 1, 'props'], node(grid.id)),
      issue('required', ['children', 0, 'regions', 1, 'children'], node(grid.id)),
    ])
  })

  it('子表只收字段', () => {
    const { registry, ids, document, lines } = sample()
    const card = containerOf(registry, ids, 'card')
    const nested = withChildren(lines, 0, [card])
    expect(validateDocument(replaceNode(document, 1, nested))).toEqual([
      issue('region.childNotAllowed', ['children', 1, 'regions', 0, 'children', 0], node(card.id), { kind: 'card' }),
    ])
  })

  it('表格布局的单元格铺排问题：越界与重叠落在区域上，留空落在表格上', () => {
    const { document, table } = sample()
    const [a, b, c, d] = table.regions
    const merged: ContainerNode = { ...table, regions: [{ ...a!, props: { ...a!.props, columnSpan: 2 } }, b!, c!, d!] }
    expect(validateDocument(replaceNode(document, 2, merged))).toEqual([
      issue('table.cellOverlap', ['children', 2, 'regions', 1], region(b!.id)),
    ])
    const holes: ContainerNode = { ...table, regions: [a!, d!] }
    expect(validateDocument(replaceNode(document, 2, holes))).toEqual([
      issue('table.cellGap', ['children', 2, 'regions'], node(table.id), { row: 0, column: 1 }),
      issue('table.cellGap', ['children', 2, 'regions'], node(table.id), { row: 1, column: 0 }),
    ])
  })
})

describe('schema 自校验：校验规则', () => {
  function withRules(target: FieldNode | ContainerNode, validation: unknown[]): FieldNode | ContainerNode {
    return { ...target, validation: validation as ValidationRule[] }
  }

  it('合法的规则没有问题', () => {
    const { document, name, lines } = sample()
    const rules = [
      { id: 'v1', kind: 'required', message: '必填' },
      { id: 'v2', kind: 'length', min: 2, max: 20 },
      { id: 'v3', kind: 'pattern', pattern: '^[a-z]+$', flags: 'iu' },
      { id: 'v4', kind: 'expression', expression: 'LEN($value) > 1' },
    ]
    const next = replaceNode(replaceNode(document, 0, withRules(name, rules)), 1, withRules(lines, [{ id: 'v5', kind: 'length', max: 10 }]))
    expect(validateDocument(next)).toEqual([])
  })

  it('规则结构不对、种类未知、有多余字段、提示不是字符串', () => {
    const { document, name } = sample()
    const rules = ['x', { id: 'a', kind: 'regex' }, { id: 'b', kind: 'required', when: 'x' }, { id: 'c', kind: 'required', message: 1 }]
    expect(validateDocument(replaceNode(document, 0, withRules(name, rules)))).toEqual([
      issue('invalid-type', ['children', 0, 'validation', 0], node(name.id), { expected: 'object' }),
      issue('invalid-option', ['children', 0, 'validation', 1, 'kind'], rule('a'), { choices: ['required', 'accepted', 'length', 'range', 'pattern', 'expression'] }),
      issue('unknown-key', ['children', 0, 'validation', 2, 'when'], rule('b')),
      issue('invalid-type', ['children', 0, 'validation', 3, 'message'], rule('c'), { expected: 'string' }),
    ])
  })

  it('规则不适用于字段的值形状或种类', () => {
    const { registry, ids, document, name, lines, table } = sample()
    const age = fieldOf(registry, ids, 'number', 'age')
    expect(validateDocument(replaceNode(document, 0, withRules(name, [{ id: 'r', kind: 'range', min: 1 }])))).toEqual([
      issue('rule.notApplicable', ['children', 0, 'validation', 0, 'kind'], rule('r'), { kind: 'range' }),
    ])
    expect(codes(documentOf([withRules(age, [{ id: 'p', kind: 'pattern', pattern: 'x' }])]))).toEqual(['rule.notApplicable'])
    expect(codes(replaceNode(document, 1, withRules(lines, [{ id: 'p', kind: 'pattern', pattern: 'x' }])))).toEqual(['rule.notApplicable'])
    expect(codes(replaceNode(document, 2, withRules(table, [{ id: 'q', kind: 'required' }])))).toEqual(['rule.notApplicable'])
  })

  it('必须为 true 只适用于勾选框与开关，规则只带 id、kind、message', () => {
    const { registry, ids, document, name, lines } = sample()
    const agree = fieldOf(registry, ids, 'checkbox', 'agree')
    const on = fieldOf(registry, ids, 'switch', 'on')
    expect(codes(documentOf([withRules(agree, [{ id: 'a', kind: 'accepted', message: '请先同意' }]), withRules(on, [{ id: 'b', kind: 'accepted' }])]))).toEqual([])
    expect(codes(replaceNode(document, 0, withRules(name, [{ id: 'a', kind: 'accepted' }])))).toEqual(['rule.notApplicable'])
    expect(codes(replaceNode(document, 1, withRules(lines, [{ id: 'a', kind: 'accepted' }])))).toEqual(['rule.notApplicable'])
    expect(codes(documentOf([withRules(agree, [{ id: 'a', kind: 'accepted', min: 1 }])]))).toEqual(['unknown-key'])
  })

  it('长度与范围的上下限', () => {
    const { registry, ids, document, name } = sample()
    const age = fieldOf(registry, ids, 'number', 'age')
    const lengthIssues = (bounds: Record<string, unknown>): string[] => codes(replaceNode(document, 0, withRules(name, [{ id: 'a', kind: 'length', ...bounds }])))
    expect(lengthIssues({})).toEqual(['rule.boundsMissing'])
    expect(lengthIssues({ min: -1 })).toEqual(['out-of-range'])
    expect(lengthIssues({ min: 1.5 })).toEqual(['not-integer'])
    expect(validateDocument(replaceNode(document, 0, withRules(name, [{ id: 'a', kind: 'length', min: 5, max: 2 }])))).toEqual([
      issue('rule.invalidRange', ['children', 0, 'validation', 0, 'min'], rule('a'), { min: 5, max: 2 }),
    ])
    expect(codes(documentOf([withRules(age, [{ id: 'b', kind: 'range', min: -1.5, max: 0 }])]))).toEqual([])
    expect(codes(documentOf([withRules(age, [{ id: 'b', kind: 'range', min: 'x' }])]))).toEqual(['invalid-type'])
  })

  it.each([
    [{ pattern: '(' }, 'rule.invalidPattern', 'pattern', 'invalid-pattern'],
    [{ pattern: 'a'.repeat(1001) }, 'rule.invalidPattern', 'pattern', 'too-long'],
    [{ pattern: 'a', flags: 'g' }, 'rule.invalidPattern', 'flags', 'invalid-flags'],
    [{ pattern: 'a', flags: 'y' }, 'rule.invalidPattern', 'flags', 'invalid-flags'],
    [{ pattern: 'a', flags: 'ii' }, 'rule.invalidPattern', 'flags', 'invalid-flags'],
    [{ pattern: '' }, 'empty', 'pattern', undefined],
    [{ pattern: 'a', flags: 1 }, 'invalid-type', 'flags', undefined],
    [{ pattern: 1 }, 'invalid-type', 'pattern', undefined],
    [{}, 'required', 'pattern', undefined],
  ])('正则 %j 报 %s', (fields, code, key, reason) => {
    const { document, name } = sample()
    const [found] = validateDocument(replaceNode(document, 0, withRules(name, [{ id: 'p', kind: 'pattern', ...fields }])))
    expect([found!.code, found!.path, found!.target]).toEqual([code, ['children', 0, 'validation', 0, key], rule('p')])
    expect(found!.params?.reason).toBe(reason)
  })

  it('表达式为空或不是字符串', () => {
    const { document, name } = sample()
    expect(validateDocument(replaceNode(document, 0, withRules(name, [{ id: 'e', kind: 'expression', expression: '  ' }])))).toEqual([
      issue('empty', ['children', 0, 'validation', 0, 'expression'], rule('e')),
    ])
    expect(codes(replaceNode(document, 0, withRules(name, [{ id: 'e', kind: 'expression', expression: 1 }])))).toEqual(['invalid-type'])
    expect(codes(replaceNode(document, 0, withRules(name, [{ id: 'e', kind: 'expression' }])))).toEqual(['required'])
  })
})

describe('schema 自校验：联动规则', () => {
  function withLinkage(target: FormNode, linkage: unknown[]): FormNode {
    return { ...target, linkage: linkage as LinkageRule[] }
  }

  it('合法的联动规则没有问题', () => {
    const { document, name } = sample()
    const linkage = [
      { id: 'l1', action: 'hide', when: 'name == \'\'' },
      { id: 'l2', action: 'assign', value: 'UPPER(name)' },
      { id: 'l3', action: 'require' },
    ]
    expect(validateDocument(replaceNode(document, 0, withLinkage(name, linkage)))).toEqual([])
  })

  it('动作未知、动作不适用于节点类型', () => {
    const { document, name, table } = sample()
    expect(codes(replaceNode(document, 0, withLinkage(name, [{ id: 'l', action: 'explode' }])))).toEqual(['invalid-option'])
    expect(validateDocument(replaceNode(document, 2, withLinkage(table, [{ id: 'l', action: 'assign', value: '1' }])))).toEqual([
      issue('linkage.actionNotApplicable', ['children', 2, 'linkage', 0, 'action'], rule('l'), { action: 'assign' }),
    ])
    const divider = document.children[3]!
    expect(codes(replaceNode(document, 3, withLinkage(divider, [{ id: 'l', action: 'disable' }])))).toEqual(['linkage.actionNotApplicable'])
  })

  it('赋值必须带 value，其它动作不能带 value，条件不能为空', () => {
    const { document, name } = sample()
    expect(validateDocument(replaceNode(document, 0, withLinkage(name, [{ id: 'l', action: 'assign' }])))).toEqual([
      issue('required', ['children', 0, 'linkage', 0, 'value'], rule('l')),
    ])
    expect(validateDocument(replaceNode(document, 0, withLinkage(name, [{ id: 'l', action: 'hide', value: '1' }])))).toEqual([
      issue('unknown-key', ['children', 0, 'linkage', 0, 'value'], rule('l')),
    ])
    expect(codes(replaceNode(document, 0, withLinkage(name, [{ id: 'l', action: 'hide', when: '' }])))).toEqual(['empty'])
    expect(codes(replaceNode(document, 0, withLinkage(name, [{ id: 'l', action: 'hide', extra: 1 }])))).toEqual(['unknown-key'])
  })
})

describe('schema 自校验：选项依赖', () => {
  function cascade() {
    const { registry, ids } = setup()
    const province = fieldOf(registry, ids, 'select', 'province')
    const withDeps = (key: string, dependencies: string[], source: string | null = 'cities') => ({
      ...fieldOf(registry, ids, 'select', key),
      data: { options: [], multiple: false, ...(source === null ? {} : { optionSource: source }), optionDependencies: dependencies },
    })
    return { registry, ids, province, withDeps }
  }

  it('依赖同一作用域或外层作用域的键都合法，内层同名遮住外层', () => {
    const { registry, ids, province, withDeps } = cascade()
    const city = withDeps('city', ['province'])
    const rowProvince = fieldOf(registry, ids, 'select', 'province')
    const rowCity = withDeps('rowCity', ['province', 'city'])
    const lines = withChildren(containerOf(registry, ids, 'subtable', 'lines'), 0, [rowProvince, rowCity])
    expect(validateDocument(documentOf([city, province, lines]))).toEqual([])
  })

  it('找不到、指向自己、重复都报在那一项上', () => {
    const { province, withDeps } = cascade()
    const city = withDeps('city', ['nope', 'city', 'province', 'province'])
    const at = (index: number): (string | number)[] => ['children', 1, 'data', 'optionDependencies', index]
    expect(validateDocument(documentOf([province, city]))).toEqual([
      issue('field.unknownDependency', at(0), node(city.id), { key: 'nope' }),
      issue('field.selfDependency', at(1), node(city.id), { key: 'city' }),
      issue('duplicate-key', at(3), node(city.id), { key: 'province' }),
    ])
  })

  it('外层不能依赖列表行里的键；声明了依赖却没有选项来源时报出', () => {
    const { registry, ids, withDeps } = cascade()
    const rowProvince = fieldOf(registry, ids, 'select', 'rowProvince')
    const lines = withChildren(containerOf(registry, ids, 'subtable', 'lines'), 0, [rowProvince])
    const city = withDeps('city', ['rowProvince'])
    const orphan = withDeps('orphan', ['city'], null)
    expect(validateDocument(documentOf([lines, city, orphan]))).toEqual([
      issue('field.dependencyWithoutSource', ['children', 2, 'data', 'optionSource'], node(orphan.id)),
      issue('field.unknownDependency', ['children', 1, 'data', 'optionDependencies', 0], node(city.id), { key: 'rowProvince' }),
    ])
  })

  it('依赖必须是字符串数组，只给选项类字段', () => {
    const { registry, ids, withDeps } = cascade()
    const bad = { ...withDeps('a', []), data: { options: [], multiple: false, optionSource: 's', optionDependencies: 'province' } }
    const text = { ...fieldOf(registry, ids, 'text', 'b'), data: { inputType: 'text', optionDependencies: [] } }
    expect(validateDocument(documentOf([bad, text]))).toEqual([
      issue('invalid-type', ['children', 0, 'data', 'optionDependencies'], node(bad.id)),
      issue('unknown-key', ['children', 1, 'data', 'optionDependencies'], node(text.id)),
    ])
  })
})

describe('schema 自校验：表达式交给注入的引擎检查', () => {
  it('按规则所在位置传入可引用的名字', () => {
    const { document, name, price, lines } = sample()
    const engine = createFakeEngine()
    const next = replaceNode(
      replaceNode(document, 0, { ...name, linkage: [{ id: 'l1', action: 'hide', when: 'lines == null' }] }),
      1,
      withChildren(lines, 0, [{ ...price, validation: [{ id: 'v1', kind: 'expression', expression: '$value <= $row.price' }] }]),
    )
    expect(validateDocument(next, { expressionEngine: engine, identifiers: ['$user'] })).toEqual([])
    expect(engine.checks).toEqual([
      { source: 'lines == null', identifiers: ['name', 'lines', '$user', '$value'] },
      { source: '$value <= $row.price', identifiers: ['name', 'lines', '$user', '$value', '$row', '$index'] },
    ])
  })

  it('引擎报出的问题转成 expression.invalid，路径指到表达式所在的键，参数带上引擎的问题码与区间', () => {
    const { document, name } = sample()
    const next = replaceNode(document, 0, { ...name, linkage: [{ id: 'l1', action: 'assign', when: 'ok @@', value: 'missing + 1' }] })
    const when = ['children', 0, 'linkage', 0, 'when']
    const value = ['children', 0, 'linkage', 0, 'value']
    expect(validateDocument(next, { expressionEngine: createFakeEngine() })).toEqual([
      issue('expression.invalid', when, rule('l1'), { expressionCode: 'XH_EXPR_UNEXPECTED_TOKEN', start: 3, end: 5 }),
      issue('expression.invalid', when, rule('l1'), { expressionCode: 'XH_EXPR_UNKNOWN_IDENTIFIER', start: 0, end: 2 }),
      issue('expression.invalid', value, rule('l1'), { expressionCode: 'XH_EXPR_UNKNOWN_IDENTIFIER', start: 0, end: 7 }),
    ])
  })

  it('不提供引擎时不检查表达式内容', () => {
    const { document, name } = sample()
    const next = replaceNode(document, 0, { ...name, linkage: [{ id: 'l1', action: 'hide', when: '@@' }] })
    expect(validateDocument(next)).toEqual([])
  })
})
