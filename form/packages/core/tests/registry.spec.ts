import type { ContainerKindDefinition, PropertyDescriptor } from '../src'
import { describe, expect, it } from 'vitest'
import {
  BUILTIN_CONTAINERS,
  BUILTIN_FIELDS,
  BUILTIN_KINDS,
  createBuiltinKindRegistry,
  createEditorRegistry,
  createKindRegistry,
  createSequentialIds,
  DEFAULT_EDITORS,
  defaultProperties,
  EMPTY_PROPERTY_SCHEMA,
  isValidPropertyValue,
  LINKAGE_ACTIONS,
} from '../src'

describe('种类登记表', () => {
  it('内置种类按登记顺序列出，名字唯一', () => {
    const registry = createBuiltinKindRegistry()
    const names = registry.list().map(definition => definition.kind)
    expect(names).toEqual(BUILTIN_KINDS.map(definition => definition.kind))
    expect(new Set(names).size).toBe(names.length)
    expect(registry.get('text')?.type).toBe('field')
    expect(registry.get('grid')?.type).toBe('container')
    expect(registry.get('divider')?.type).toBe('static')
    expect(registry.get('nope')).toBeUndefined()
  })

  it('每个内置字段都对应一个 XiHan.UI 元素，并声明值形状与空值', () => {
    for (const definition of BUILTIN_FIELDS) {
      expect(definition.element).toMatch(/^xh-[a-z-]+$/)
      const data = defaultProperties(definition.properties.data)
      expect(['string', 'number', 'boolean', 'string-list', 'number-list', 'list', 'object']).toContain(definition.valueKind(data))
      expect(definition.validations).toContain('required')
      expect(definition.validations).toContain('expression')
      expect(definition.properties.basic.map(property => property.name)).toEqual(expect.arrayContaining(['label', 'initialValue', 'hidden', 'disabled']))
    }
  })

  it('多选开关改变值形状与空值', () => {
    const select = createBuiltinKindRegistry().get('select')
    if (select?.type !== 'field')
      throw new Error('select 应是字段')
    expect(select.valueKind({ multiple: false })).toBe('string')
    expect(select.emptyValue({ multiple: false })).toBeNull()
    expect(select.valueKind({ multiple: true })).toBe('string-list')
    expect(select.emptyValue({ multiple: true })).toEqual([])
  })

  it('种类名必须是小写短横线形式且不重复', () => {
    const base = { type: 'static', category: 'static', element: 'xh-x', properties: EMPTY_PROPERTY_SCHEMA } as const
    expect(() => createKindRegistry([{ ...base, kind: 'Bad' }])).toThrow(TypeError)
    expect(() => createKindRegistry([{ ...base, kind: 'a--b' }])).toThrow(TypeError)
    expect(() => createKindRegistry([{ ...base, kind: 'a' }, { ...base, kind: 'a' }])).toThrow(TypeError)
    expect(() => createBuiltinKindRegistry([{ ...base, kind: 'text' }])).toThrow(TypeError)
    expect(createBuiltinKindRegistry([{ ...base, kind: 'qr-code' }]).get('qr-code')?.kind).toBe('qr-code')
  })

  it('容器的区域上下限与初始区域个数要自洽', () => {
    const grid = BUILTIN_CONTAINERS.find(definition => definition.kind === 'grid')!
    const tooMany: ContainerKindDefinition = { ...grid, kind: 'x', regions: { min: 1, max: 1, initial: [{}, {}] } }
    const inverted: ContainerKindDefinition = { ...grid, kind: 'y', regions: { min: 2, max: 1, initial: [{}, {}] } }
    expect(() => createKindRegistry([tooMany])).toThrow(TypeError)
    expect(() => createKindRegistry([inverted])).toThrow(TypeError)
  })

  it('表格布局的单元格必须落在表内、互不重叠且铺满', () => {
    const registry = createBuiltinKindRegistry()
    const table = registry.get('table')
    if (table?.type !== 'container' || table.check === undefined)
      throw new Error('table 应是带结构检查的容器')
    const cell = (id: string, row: number, column: number, rowSpan = 1, columnSpan = 1) => ({ id, props: { row, column, rowSpan, columnSpan }, children: [] })
    const node = (regions: ReturnType<typeof cell>[]) => ({
      type: 'container' as const,
      id: 't',
      kind: 'table',
      basic: {},
      data: {},
      appearance: { rows: 2, columns: 2 },
      validation: [],
      linkage: [],
      regions,
    })
    expect(table.check(node([cell('a', 0, 0, 1, 2), cell('b', 1, 0), cell('c', 1, 1)]))).toEqual([])
    expect(table.check(node([cell('a', 0, 0, 2, 2)]))).toEqual([])
    expect(table.check(node([cell('a', 0, 0, 1, 2), cell('b', 0, 1), cell('c', 1, 0, 1, 2)]))).toEqual([{ code: 'XH_FORM_TABLE_CELL_OVERLAP', regionId: 'b' }])
    expect(table.check(node([cell('a', 0, 0, 2, 2), cell('b', 1, 1, 1, 2)]))).toEqual([{ code: 'XH_FORM_TABLE_CELL_OUT_OF_BOUNDS', regionId: 'b' }])
    expect(table.check(node([cell('a', 0, 0), cell('b', 1, 1)]))).toEqual([
      { code: 'XH_FORM_TABLE_CELL_GAP', data: { row: 0, column: 1 } },
      { code: 'XH_FORM_TABLE_CELL_GAP', data: { row: 1, column: 0 } },
    ])
  })

  it('各类节点可用的联动动作', () => {
    expect(LINKAGE_ACTIONS.field).toContain('assign')
    expect(LINKAGE_ACTIONS.container).not.toContain('assign')
    expect(LINKAGE_ACTIONS.static).toEqual(['show', 'hide'])
  })
})

describe('属性取值校验', () => {
  const of = (descriptor: Omit<PropertyDescriptor, 'name'>): PropertyDescriptor => ({ name: 'p', ...descriptor })

  it.each([
    [of({ type: 'string' }), 'a', 1],
    [of({ type: 'text' }), 'a\nb', null],
    [of({ type: 'number', min: 0, max: 10 }), 2.5, 11],
    [of({ type: 'number' }), -1, Number.NaN],
    [of({ type: 'integer', min: 1 }), 3, 1.5],
    [of({ type: 'integer', min: 1 }), 1, 0],
    [of({ type: 'boolean' }), false, 'false'],
    [of({ type: 'enum', choices: ['a', 'b'] }), 'b', 'c'],
    [of({ type: 'string-list' }), ['a'], ['a', 1]],
    [of({ type: 'json' }), { a: [1, null] }, { a: Number.POSITIVE_INFINITY }],
    [of({ type: 'value' }), 'x', undefined],
  ])('%j 接受 %j、拒绝 %j', (descriptor, good, bad) => {
    expect(isValidPropertyValue(descriptor, good)).toBe(true)
    expect(isValidPropertyValue(descriptor, bad)).toBe(false)
  })

  it('选项：value 与 label 是字符串，同层 value 不重复，平铺选项不带 children', () => {
    const options = of({ type: 'options' })
    expect(isValidPropertyValue(options, [{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }])).toBe(true)
    expect(isValidPropertyValue(options, [{ value: 'a', label: 'A' }, { value: 'a', label: 'B' }])).toBe(false)
    expect(isValidPropertyValue(options, [{ value: 1, label: 'A' }])).toBe(false)
    expect(isValidPropertyValue(options, [{ value: 'a', label: 'A', extra: 1 }])).toBe(false)
    expect(isValidPropertyValue(options, [{ value: 'a', label: 'A', children: [] }])).toBe(false)
  })

  it('树形选项可以嵌套，各层 value 各自不重复', () => {
    const tree = of({ type: 'tree-options' })
    const value = [{ value: 'zj', label: '浙江', children: [{ value: 'hz', label: '杭州' }, { value: 'nb', label: '宁波' }] }]
    expect(isValidPropertyValue(tree, value)).toBe(true)
    expect(isValidPropertyValue(tree, [{ value: 'zj', label: '浙江', children: [{ value: 'hz', label: 'A' }, { value: 'hz', label: 'B' }] }])).toBe(false)
    let deep: unknown = []
    for (let index = 0; index < 40; index += 1)
      deep = [{ value: 'x', label: 'x', children: deep }]
    expect(isValidPropertyValue(tree, deep)).toBe(false)
  })

  it('defaultProperties 只取带缺省值的属性', () => {
    expect(defaultProperties([{ name: 'a', type: 'string', default: '' }, { name: 'b', type: 'string' }])).toEqual({ a: '' })
  })
})

describe('属性编辑器登记表', () => {
  const label: PropertyDescriptor = { name: 'label', type: 'string' }
  const options: PropertyDescriptor = { name: 'options', type: 'options' }

  it('缺省按取值类型取编辑器', () => {
    const editors = createEditorRegistry()
    expect(editors.resolve('text', label)).toBe(DEFAULT_EDITORS.string)
    expect(editors.resolve('select', options)).toBe('options')
  })

  it('种类 + 属性名优先于属性名，属性名优先于取值类型', () => {
    const editors = createEditorRegistry({
      byType: { string: 'plain' },
      byName: { label: 'rich-label' },
      byKind: { select: { label: 'select-label' } },
    })
    expect(editors.resolve('select', label)).toBe('select-label')
    expect(editors.resolve('text', label)).toBe('rich-label')
    expect(editors.resolve('text', { name: 'hint', type: 'string' })).toBe('plain')
  })

  it('不同的登记表互不影响', () => {
    createEditorRegistry({ byName: { label: 'x' } })
    expect(createEditorRegistry().resolve('text', label)).toBe('text')
  })
})

describe('id 来源', () => {
  it('按序号递增，实例之间互不影响', () => {
    const a = createSequentialIds('a')
    const b = createSequentialIds('b', 10)
    expect([a.nextId(), a.nextId(), b.nextId(), a.nextId()]).toEqual(['a1', 'a2', 'b10', 'a3'])
    expect(() => createSequentialIds('x', -1)).toThrow(TypeError)
  })
})
