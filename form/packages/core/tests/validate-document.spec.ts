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

describe('schema 自校验：文档与节点结构', () => {
  it('新建出来的文档没有问题', () => {
    const { registry, document } = sample()
    expect(validateDocument(document, registry)).toEqual([])
  })

  it('文档不是对象、版本不对、缺字段', () => {
    const { registry } = setup()
    expect(codes(null, registry)).toEqual(['XH_FORM_INVALID_DOCUMENT'])
    expect(validateDocument({ schemaVersion: 2, settings: {}, children: [] }, registry)).toEqual([{ code: 'XH_FORM_SCHEMA_VERSION', data: { version: '2' } }])
    expect(codes({ schemaVersion: 1, settings: {} }, registry)).toEqual(['XH_FORM_INVALID_DOCUMENT'])
    expect(codes({ schemaVersion: 1, settings: { size: 'xl', foo: 1 }, children: [], extra: true }, registry))
      .toEqual(['XH_FORM_UNKNOWN_NODE_FIELD', 'XH_FORM_INVALID_PROPERTY', 'XH_FORM_UNKNOWN_PROPERTY'])
  })

  it('节点缺 id、类型不对、分组不是对象', () => {
    const { registry, document, name } = sample()
    expect(codes(replaceNode(document, 0, 'x'), registry)).toEqual(['XH_FORM_INVALID_NODE'])
    expect(codes(replaceNode(document, 0, { ...name, id: '' }), registry)).toEqual(['XH_FORM_INVALID_NODE'])
    expect(codes(replaceNode(document, 0, { ...name, type: 'script' }), registry)).toEqual(['XH_FORM_INVALID_NODE'])
    expect(codes(replaceNode(document, 0, { ...name, basic: [] }), registry)).toEqual(['XH_FORM_INVALID_NODE'])
    expect(codes(replaceNode(document, 0, { ...name, validation: {} }), registry)).toEqual(['XH_FORM_INVALID_NODE'])
  })

  it('节点上未定义的字段一律报出，模板里不能夹带别的东西', () => {
    const { registry, document, name } = sample()
    expect(validateDocument(replaceNode(document, 0, { ...name, onClick: 'alert(1)' }), registry)).toEqual([
      { code: 'XH_FORM_UNKNOWN_NODE_FIELD', nodeId: name.id, data: { name: 'onClick' } },
    ])
  })

  it('id 在节点、区域与规则之间都不能重复', () => {
    const { registry, document, name, lines } = sample()
    const twin = { ...name, key: 'other' }
    expect(validateDocument(documentOf([...document.children, twin]), registry)).toEqual([
      { code: 'XH_FORM_DUPLICATE_ID', nodeId: name.id, data: { id: name.id } },
    ])
    const clash: FieldNode = { ...name, validation: [{ id: lines.regions[0]!.id, kind: 'required' }] }
    expect(codes(replaceNode(document, 0, clash), registry)).toEqual(['XH_FORM_DUPLICATE_ID'])
  })

  it('种类没有登记、类型与登记不符', () => {
    const { registry, document, name } = sample()
    expect(validateDocument(replaceNode(document, 0, { ...name, kind: 'nope' }), registry)).toEqual([
      { code: 'XH_FORM_UNKNOWN_KIND', nodeId: name.id, data: { kind: 'nope' } },
    ])
    expect(codes(replaceNode(document, 0, { ...name, kind: 'grid' }), registry)).toEqual(['XH_FORM_KIND_TYPE_MISMATCH'])
  })

  it('嵌套层数上限', () => {
    const { registry, ids } = setup()
    let node: FormNode = fieldOf(registry, ids, 'text', 'deep')
    for (let index = 0; index < 40; index += 1)
      node = withChildren(containerOf(registry, ids, 'card'), 0, [node])
    expect(codes(documentOf([node]), registry)).toEqual(['XH_FORM_TOO_DEEP'])
    expect(codes(documentOf([node]), registry, { maxDepth: 50 })).toEqual([])
    expect(() => validateDocument(documentOf([]), registry, { maxDepth: 0 })).toThrow(TypeError)
  })
})

describe('schema 自校验：属性与数据键', () => {
  it('属性名没有描述、取值不符合描述', () => {
    const { registry, document, name } = sample()
    const node = { ...name, basic: { ...name.basic, label: 1, colour: 'red' }, appearance: { size: 'huge' } }
    expect(validateDocument(replaceNode(document, 0, node), registry)).toEqual([
      { code: 'XH_FORM_INVALID_PROPERTY', nodeId: name.id, data: { group: 'basic', name: 'label' } },
      { code: 'XH_FORM_UNKNOWN_PROPERTY', nodeId: name.id, data: { group: 'basic', name: 'colour' } },
      { code: 'XH_FORM_INVALID_PROPERTY', nodeId: name.id, data: { group: 'appearance', name: 'size' } },
    ])
  })

  it('初始值要符合字段的值形状，形状随多选开关变化', () => {
    const { registry, ids } = setup()
    const single = { ...fieldOf(registry, ids, 'select', 'a'), basic: { label: '', initialValue: ['x'] } }
    const multiple = { ...fieldOf(registry, ids, 'select', 'b'), basic: { label: '', initialValue: ['x'] }, data: { options: [], multiple: true } }
    expect(validateDocument(documentOf([single, multiple]), registry)).toEqual([{ code: 'XH_FORM_INVALID_INITIAL_VALUE', nodeId: single.id }])
  })

  it('数据键缺失、不合法、在同一作用域重复；不同作用域可以同名', () => {
    const { registry, ids, document, name, lines } = sample()
    expect(codes(replaceNode(document, 0, { ...name, key: undefined }), registry)).toEqual(['XH_FORM_MISSING_KEY'])
    expect(validateDocument(replaceNode(document, 0, { ...name, key: '1st' }), registry)).toEqual([
      { code: 'XH_FORM_INVALID_KEY', nodeId: name.id, data: { key: '1st' } },
    ])
    expect(codes(replaceNode(document, 0, { ...name, key: 'lines' }), registry)).toEqual(['XH_FORM_DUPLICATE_KEY'])
    const inner = fieldOf(registry, ids, 'text', 'name')
    const nested = withChildren(lines, 0, [...lines.regions[0]!.children, inner])
    expect(codes(replaceNode(document, 1, nested), registry)).toEqual([])
  })

  it('列表容器必须带键，布局容器不能带键', () => {
    const { registry, document, lines, table } = sample()
    const { key: _key, ...withoutKey } = lines
    expect(codes(replaceNode(document, 1, withoutKey), registry)).toEqual(['XH_FORM_MISSING_KEY'])
    expect(codes(replaceNode(document, 2, { ...table, key: 'x' }), registry)).toEqual(['XH_FORM_UNEXPECTED_KEY'])
  })
})

describe('schema 自校验：区域', () => {
  it('区域个数超出种类的上下限', () => {
    const { registry, ids } = setup()
    const card = containerOf(registry, ids, 'card')
    const twoRegions: ContainerNode = { ...card, regions: [card.regions[0]!, { id: 'r2', props: {}, children: [] }] }
    expect(validateDocument(documentOf([twoRegions]), registry)).toEqual([
      { code: 'XH_FORM_REGION_COUNT', nodeId: card.id, data: { min: 1, actual: 2, max: 1 } },
    ])
    const tabs = containerOf(registry, ids, 'tabs')
    expect(validateDocument(documentOf([{ ...tabs, regions: [] }]), registry)).toEqual([
      { code: 'XH_FORM_REGION_COUNT', nodeId: tabs.id, data: { min: 1, actual: 0 } },
    ])
  })

  it('区域结构不对、区域属性不符合描述', () => {
    const { registry, ids } = setup()
    const grid = containerOf(registry, ids, 'grid')
    const broken: ContainerNode = { ...grid, regions: [{ ...grid.regions[0]!, props: { span: 13, width: 1 } }, { id: 'x' } as never] }
    expect(validateDocument(documentOf([broken]), registry)).toEqual([
      { code: 'XH_FORM_INVALID_PROPERTY', nodeId: grid.id, regionId: grid.regions[0]!.id, data: { group: 'region', name: 'span' } },
      { code: 'XH_FORM_UNKNOWN_PROPERTY', nodeId: grid.id, regionId: grid.regions[0]!.id, data: { group: 'region', name: 'width' } },
      { code: 'XH_FORM_INVALID_REGION', nodeId: grid.id },
    ])
  })

  it('子表只收字段', () => {
    const { registry, ids, document, lines } = sample()
    const card = containerOf(registry, ids, 'card')
    const nested = withChildren(lines, 0, [card])
    expect(validateDocument(replaceNode(document, 1, nested), registry)).toEqual([
      { code: 'XH_FORM_CHILD_NOT_ALLOWED', nodeId: card.id, data: { kind: 'card' } },
    ])
  })

  it('表格布局的单元格铺排问题带着区域 id', () => {
    const { registry, document, table } = sample()
    const [a, b, c, d] = table.regions
    const merged: ContainerNode = { ...table, regions: [{ ...a!, props: { ...a!.props, columnSpan: 2 } }, b!, c!, d!] }
    expect(validateDocument(replaceNode(document, 2, merged), registry)).toEqual([
      { code: 'XH_FORM_TABLE_CELL_OVERLAP', nodeId: table.id, regionId: b!.id },
    ])
    const holes: ContainerNode = { ...table, regions: [a!, d!] }
    expect(codes(replaceNode(document, 2, holes), registry)).toEqual(['XH_FORM_TABLE_CELL_GAP', 'XH_FORM_TABLE_CELL_GAP'])
  })
})

describe('schema 自校验：校验规则', () => {
  function withRules(node: FieldNode | ContainerNode, validation: unknown[]): FieldNode | ContainerNode {
    return { ...node, validation: validation as ValidationRule[] }
  }

  it('合法的规则没有问题', () => {
    const { registry, document, name, lines } = sample()
    const rules = [
      { id: 'v1', kind: 'required', message: '必填' },
      { id: 'v2', kind: 'length', min: 2, max: 20 },
      { id: 'v3', kind: 'pattern', pattern: '^[a-z]+$', flags: 'iu' },
      { id: 'v4', kind: 'expression', expression: 'LEN($value) > 1' },
    ]
    const next = replaceNode(replaceNode(document, 0, withRules(name, rules)), 1, withRules(lines, [{ id: 'v5', kind: 'length', max: 10 }]))
    expect(validateDocument(next, registry)).toEqual([])
  })

  it('规则结构不对、种类未知、有多余字段', () => {
    const { registry, document, name } = sample()
    expect(codes(replaceNode(document, 0, withRules(name, ['x', { id: 'a', kind: 'regex' }, { id: 'b', kind: 'required', when: 'x' }, { id: 'c', kind: 'required', message: 1 }])), registry))
      .toEqual(['XH_FORM_INVALID_RULE', 'XH_FORM_INVALID_RULE', 'XH_FORM_UNKNOWN_NODE_FIELD', 'XH_FORM_INVALID_RULE'])
  })

  it('规则不适用于字段的值形状或种类', () => {
    const { registry, ids, document, name, lines, table } = sample()
    const age = fieldOf(registry, ids, 'number', 'age')
    expect(validateDocument(replaceNode(document, 0, withRules(name, [{ id: 'r', kind: 'range', min: 1 }])), registry)).toEqual([
      { code: 'XH_FORM_RULE_NOT_APPLICABLE', nodeId: name.id, ruleId: 'r', data: { kind: 'range' } },
    ])
    expect(codes(documentOf([withRules(age, [{ id: 'p', kind: 'pattern', pattern: 'x' }])]), registry)).toEqual(['XH_FORM_RULE_NOT_APPLICABLE'])
    expect(codes(replaceNode(document, 1, withRules(lines, [{ id: 'p', kind: 'pattern', pattern: 'x' }])), registry)).toEqual(['XH_FORM_RULE_NOT_APPLICABLE'])
    expect(codes(replaceNode(document, 2, withRules(table, [{ id: 'q', kind: 'required' }])), registry)).toEqual(['XH_FORM_RULE_NOT_APPLICABLE'])
  })

  it('必须为 true 只适用于勾选框与开关，规则只带 id、kind、message', () => {
    const { registry, ids, document, name, lines } = sample()
    const agree = fieldOf(registry, ids, 'checkbox', 'agree')
    const on = fieldOf(registry, ids, 'switch', 'on')
    expect(codes(documentOf([withRules(agree, [{ id: 'a', kind: 'accepted', message: '请先同意' }]), withRules(on, [{ id: 'b', kind: 'accepted' }])]), registry)).toEqual([])
    expect(codes(replaceNode(document, 0, withRules(name, [{ id: 'a', kind: 'accepted' }])), registry)).toEqual(['XH_FORM_RULE_NOT_APPLICABLE'])
    expect(codes(replaceNode(document, 1, withRules(lines, [{ id: 'a', kind: 'accepted' }])), registry)).toEqual(['XH_FORM_RULE_NOT_APPLICABLE'])
    expect(codes(documentOf([withRules(agree, [{ id: 'a', kind: 'accepted', min: 1 }])]), registry)).toEqual(['XH_FORM_UNKNOWN_NODE_FIELD'])
  })

  it('长度与范围的上下限', () => {
    const { registry, ids, document, name } = sample()
    const age = fieldOf(registry, ids, 'number', 'age')
    expect(codes(replaceNode(document, 0, withRules(name, [{ id: 'a', kind: 'length' }])), registry)).toEqual(['XH_FORM_INVALID_RANGE'])
    expect(codes(replaceNode(document, 0, withRules(name, [{ id: 'a', kind: 'length', min: -1 }])), registry)).toEqual(['XH_FORM_INVALID_RANGE'])
    expect(codes(replaceNode(document, 0, withRules(name, [{ id: 'a', kind: 'length', min: 1.5 }])), registry)).toEqual(['XH_FORM_INVALID_RANGE'])
    expect(codes(replaceNode(document, 0, withRules(name, [{ id: 'a', kind: 'length', min: 5, max: 2 }])), registry)).toEqual(['XH_FORM_INVALID_RANGE'])
    expect(codes(documentOf([withRules(age, [{ id: 'b', kind: 'range', min: -1.5, max: 0 }])]), registry)).toEqual([])
    expect(codes(documentOf([withRules(age, [{ id: 'b', kind: 'range', min: 'x' }])]), registry)).toEqual(['XH_FORM_INVALID_RANGE'])
  })

  it.each([
    [{ pattern: '(' }],
    [{ pattern: '' }],
    [{ pattern: 'a', flags: 'g' }],
    [{ pattern: 'a', flags: 'y' }],
    [{ pattern: 'a', flags: 'ii' }],
    [{ pattern: 'a', flags: 1 }],
    [{ pattern: 'a'.repeat(1001) }],
    [{ pattern: 1 }],
  ])('正则 %j 不合法', (fields) => {
    const { registry, document, name } = sample()
    expect(codes(replaceNode(document, 0, withRules(name, [{ id: 'p', kind: 'pattern', ...fields }])), registry)).toEqual(['XH_FORM_INVALID_PATTERN'])
  })

  it('表达式为空或不是字符串', () => {
    const { registry, document, name } = sample()
    expect(validateDocument(replaceNode(document, 0, withRules(name, [{ id: 'e', kind: 'expression', expression: '  ' }])), registry)).toEqual([
      { code: 'XH_FORM_EMPTY_EXPRESSION', nodeId: name.id, ruleId: 'e', data: { part: 'expression' } },
    ])
    expect(codes(replaceNode(document, 0, withRules(name, [{ id: 'e', kind: 'expression', expression: 1 }])), registry)).toEqual(['XH_FORM_INVALID_RULE'])
  })
})

describe('schema 自校验：联动规则', () => {
  function withLinkage(node: FormNode, linkage: unknown[]): FormNode {
    return { ...node, linkage: linkage as LinkageRule[] }
  }

  it('合法的联动规则没有问题', () => {
    const { registry, document, name } = sample()
    const linkage = [
      { id: 'l1', action: 'hide', when: 'name == \'\'' },
      { id: 'l2', action: 'assign', value: 'UPPER(name)' },
      { id: 'l3', action: 'require' },
    ]
    expect(validateDocument(replaceNode(document, 0, withLinkage(name, linkage)), registry)).toEqual([])
  })

  it('动作未知、动作不适用于节点类型', () => {
    const { registry, document, name, table } = sample()
    expect(codes(replaceNode(document, 0, withLinkage(name, [{ id: 'l', action: 'explode' }])), registry)).toEqual(['XH_FORM_INVALID_RULE'])
    expect(validateDocument(replaceNode(document, 2, withLinkage(table, [{ id: 'l', action: 'assign', value: '1' }])), registry)).toEqual([
      { code: 'XH_FORM_ACTION_NOT_APPLICABLE', nodeId: table.id, ruleId: 'l', data: { action: 'assign' } },
    ])
    const divider = document.children[3]!
    expect(codes(replaceNode(document, 3, withLinkage(divider, [{ id: 'l', action: 'disable' }])), registry)).toEqual(['XH_FORM_ACTION_NOT_APPLICABLE'])
  })

  it('赋值必须带 value，其它动作不能带 value，条件不能为空', () => {
    const { registry, document, name } = sample()
    expect(validateDocument(replaceNode(document, 0, withLinkage(name, [{ id: 'l', action: 'assign' }])), registry)).toEqual([
      { code: 'XH_FORM_EMPTY_EXPRESSION', nodeId: name.id, ruleId: 'l', data: { part: 'value' } },
    ])
    expect(codes(replaceNode(document, 0, withLinkage(name, [{ id: 'l', action: 'hide', value: '1' }])), registry)).toEqual(['XH_FORM_INVALID_RULE'])
    expect(codes(replaceNode(document, 0, withLinkage(name, [{ id: 'l', action: 'hide', when: '' }])), registry)).toEqual(['XH_FORM_EMPTY_EXPRESSION'])
    expect(codes(replaceNode(document, 0, withLinkage(name, [{ id: 'l', action: 'hide', extra: 1 }])), registry)).toEqual(['XH_FORM_UNKNOWN_NODE_FIELD'])
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
    expect(validateDocument(documentOf([city, province, lines]), registry)).toEqual([])
  })

  it('找不到、指向自己、重复都报出', () => {
    const { registry, province, withDeps } = cascade()
    const city = withDeps('city', ['nope', 'city', 'province', 'province'])
    expect(validateDocument(documentOf([province, city]), registry)).toEqual([
      { code: 'XH_FORM_UNKNOWN_DEPENDENCY', nodeId: city.id, data: { key: 'nope' } },
      { code: 'XH_FORM_SELF_DEPENDENCY', nodeId: city.id, data: { key: 'city' } },
      { code: 'XH_FORM_DUPLICATE_DEPENDENCY', nodeId: city.id, data: { key: 'province' } },
    ])
  })

  it('外层不能依赖列表行里的键；声明了依赖却没有选项来源时报出', () => {
    const { registry, ids, withDeps } = cascade()
    const rowProvince = fieldOf(registry, ids, 'select', 'rowProvince')
    const lines = withChildren(containerOf(registry, ids, 'subtable', 'lines'), 0, [rowProvince])
    const city = withDeps('city', ['rowProvince'])
    const orphan = withDeps('orphan', ['city'], null)
    expect(validateDocument(documentOf([lines, city, orphan]), registry)).toEqual([
      { code: 'XH_FORM_DEPENDENCY_WITHOUT_SOURCE', nodeId: orphan.id },
      { code: 'XH_FORM_UNKNOWN_DEPENDENCY', nodeId: city.id, data: { key: 'rowProvince' } },
    ])
  })

  it('依赖必须是字符串数组，只给选项类字段', () => {
    const { registry, ids, withDeps } = cascade()
    const bad = { ...withDeps('a', []), data: { options: [], multiple: false, optionSource: 's', optionDependencies: 'province' } }
    const text = { ...fieldOf(registry, ids, 'text', 'b'), data: { inputType: 'text', optionDependencies: [] } }
    expect(codes(documentOf([bad, text]), registry)).toEqual(['XH_FORM_INVALID_PROPERTY', 'XH_FORM_UNKNOWN_PROPERTY'])
  })
})

describe('schema 自校验：表达式交给注入的引擎检查', () => {
  it('按规则所在位置传入可引用的名字', () => {
    const { registry, document, name, price, lines } = sample()
    const engine = createFakeEngine()
    const next = replaceNode(
      replaceNode(document, 0, { ...name, linkage: [{ id: 'l1', action: 'hide', when: 'lines == null' }] }),
      1,
      withChildren(lines, 0, [{ ...price, validation: [{ id: 'v1', kind: 'expression', expression: '$value <= $row.price' }] }]),
    )
    expect(validateDocument(next, registry, { expressionEngine: engine, identifiers: ['$user'] })).toEqual([])
    expect(engine.checks).toEqual([
      { source: 'lines == null', identifiers: ['name', 'lines', '$user', '$value'] },
      { source: '$value <= $row.price', identifiers: ['name', 'lines', '$user', '$value', '$row', '$index'] },
    ])
  })

  it('引擎报出的问题转成 XH_FORM_EXPRESSION_ERROR，带上引擎的问题码与区间', () => {
    const { registry, document, name } = sample()
    const next = replaceNode(document, 0, { ...name, linkage: [{ id: 'l1', action: 'assign', when: 'ok @@', value: 'missing + 1' }] })
    expect(validateDocument(next, registry, { expressionEngine: createFakeEngine() })).toEqual([
      { code: 'XH_FORM_EXPRESSION_ERROR', nodeId: name.id, ruleId: 'l1', data: { part: 'when', expressionCode: 'XH_EXPR_UNEXPECTED_TOKEN', start: 3, end: 5 } },
      { code: 'XH_FORM_EXPRESSION_ERROR', nodeId: name.id, ruleId: 'l1', data: { part: 'when', expressionCode: 'XH_EXPR_UNKNOWN_IDENTIFIER', start: 0, end: 2 } },
      { code: 'XH_FORM_EXPRESSION_ERROR', nodeId: name.id, ruleId: 'l1', data: { part: 'value', expressionCode: 'XH_EXPR_UNKNOWN_IDENTIFIER', start: 0, end: 7 } },
    ])
  })

  it('不提供引擎时不检查表达式内容', () => {
    const { registry, document, name } = sample()
    const next = replaceNode(document, 0, { ...name, linkage: [{ id: 'l1', action: 'hide', when: '@@' }] })
    expect(validateDocument(next, registry)).toEqual([])
  })
})
