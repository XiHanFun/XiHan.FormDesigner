import type { ContainerKindDefinition, FormPropertyControl, FormPropertyDescriptor } from '../src'
import { applyDefaults, resolvePropertyEditor } from '@xihan-ui/designer-kit/properties'
import { describe, expect, it } from 'vitest'
import {
  BUILTIN_CONTAINERS,
  BUILTIN_FIELDS,
  BUILTIN_KINDS,
  checkFormPropertyValue,
  createFormModel,
  createKindRegistry,
  EMPTY_PROPERTY_SCHEMA,
  FORM_PROPERTY_EDITORS,
  isValidPropertyValue,
  kindLabel,
  LINKAGE_ACTIONS,
  propertyName,
} from '../src'

describe('种类登记表', () => {
  it('kindLabel 按语言取种类自带的名字：同一标记、同一语种、en-US，都没有或没写 label 时为 undefined', () => {
    const definition = { label: { 'en-US': 'ID card', 'zh-CN': '身份证号', 'pt-BR': 'Documento' } }
    expect([kindLabel(definition, 'zh-CN'), kindLabel(definition, 'zh-TW'), kindLabel(definition, 'pt-PT'), kindLabel(definition, 'ja-JP'), kindLabel(definition, undefined)])
      .toEqual(['身份证号', '身份证号', 'Documento', 'ID card', 'ID card'])
    expect([kindLabel({ label: { 'zh-CN': '身份证号' } }, 'ja-JP'), kindLabel({}, 'zh-CN'), kindLabel(undefined, 'zh-CN')]).toEqual([undefined, undefined, undefined])
  })

  it('内置种类按登记顺序列出，名字唯一', () => {
    const registry = createFormModel().registry
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
      const data = applyDefaults({}, definition.properties.data)
      expect(['string', 'number', 'boolean', 'string-list', 'number-list', 'list', 'object']).toContain(definition.valueKind(data))
      expect(definition.validations).toContain('required')
      expect(definition.validations).toContain('expression')
      expect(definition.properties.basic.map(propertyName)).toEqual(expect.arrayContaining(['label', 'initialValue', 'hidden', 'disabled']))
    }
  })

  it('多选开关改变值形状与空值', () => {
    const select = createFormModel().registry.get('select')
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
    expect(() => createFormModel([{ id: 'bad', kinds: [{ ...base, kind: 'Bad' }] }])).toThrow(TypeError)
    expect(createFormModel([{ id: 'qr', kinds: [{ ...base, kind: 'qr-code' }] }]).registry.get('qr-code')?.kind).toBe('qr-code')
  })

  it('容器的区域上下限与初始区域个数要自洽', () => {
    const grid = BUILTIN_CONTAINERS.find(definition => definition.kind === 'grid')!
    const tooMany: ContainerKindDefinition = { ...grid, kind: 'x', regions: { min: 1, max: 1, initial: [{}, {}] } }
    const inverted: ContainerKindDefinition = { ...grid, kind: 'y', regions: { min: 2, max: 1, initial: [{}, {}] } }
    expect(() => createKindRegistry([tooMany])).toThrow(TypeError)
    expect(() => createKindRegistry([inverted])).toThrow(TypeError)
  })

  it('表格布局的单元格必须落在表内、互不重叠且铺满', () => {
    const registry = createFormModel().registry
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
    expect(table.check(node([cell('a', 0, 0, 1, 2), cell('b', 0, 1), cell('c', 1, 0, 1, 2)]))).toEqual([{ code: 'table.cellOverlap', regionId: 'b' }])
    expect(table.check(node([cell('a', 0, 0, 2, 2), cell('b', 1, 1, 1, 2)]))).toEqual([{ code: 'table.cellOutOfBounds', regionId: 'b' }])
    expect(table.check(node([cell('a', 0, 0), cell('b', 1, 1)]))).toEqual([
      { code: 'table.cellGap', params: { row: 0, column: 1 } },
      { code: 'table.cellGap', params: { row: 1, column: 0 } },
    ])
  })

  it('各类节点可用的联动动作', () => {
    expect(LINKAGE_ACTIONS.field).toContain('assign')
    expect(LINKAGE_ACTIONS.container).not.toContain('assign')
    expect(LINKAGE_ACTIONS.static).toEqual(['show', 'hide'])
  })
})

describe('属性取值校验', () => {
  const of = (control: FormPropertyControl): FormPropertyDescriptor => ({ path: ['p'], control })

  it.each([
    [of({ kind: 'text' }), 'a', 1],
    [of({ kind: 'text', multiline: true }), 'a\nb', null],
    [of({ kind: 'number', min: 0, max: 10 }), 2.5, 11],
    [of({ kind: 'number' }), -1, Number.NaN],
    [of({ kind: 'number', integer: true, min: 1 }), 3, 1.5],
    [of({ kind: 'number', integer: true, min: 1 }), 1, 0],
    [of({ kind: 'boolean' }), false, 'false'],
    [of({ kind: 'select', options: [{ value: 'a' }, { value: 'b' }] }), 'b', 'c'],
    [of({ kind: 'tags' }), ['a'], ['a', 1]],
    [of({ kind: 'json' }), { a: [1, null] }, { a: Number.POSITIVE_INFINITY }],
    [of({ kind: 'json' }), 'x', undefined],
  ])('%j 接受 %j、拒绝 %j', (descriptor, good, bad) => {
    expect(isValidPropertyValue(descriptor, good)).toBe(true)
    expect(isValidPropertyValue(descriptor, bad)).toBe(false)
  })

  it('问题码：内建编辑方式取 designer-kit 的码，选项结构不符为 invalid-value，不是 JSON 值为 invalid-type', () => {
    expect(checkFormPropertyValue({ kind: 'number', integer: true }, 1.5)).toBe('not-integer')
    expect(checkFormPropertyValue({ kind: 'number', max: 1 }, 2)).toBe('out-of-range')
    expect(checkFormPropertyValue({ kind: 'select', options: [{ value: 'a' }] }, 'b')).toBe('invalid-option')
    expect(checkFormPropertyValue({ kind: 'options' }, [{ value: 'a' }])).toBe('invalid-value')
    expect(checkFormPropertyValue({ kind: 'json' }, () => 1)).toBe('invalid-type')
    expect(checkFormPropertyValue({ kind: 'text' }, 'a')).toBeUndefined()
  })

  it('选项：value 与 label 是字符串，同层 value 不重复，平铺选项不带 children', () => {
    const options = of({ kind: 'options' })
    expect(isValidPropertyValue(options, [{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }])).toBe(true)
    expect(isValidPropertyValue(options, [{ value: 'a', label: 'A' }, { value: 'a', label: 'B' }])).toBe(false)
    expect(isValidPropertyValue(options, [{ value: 1, label: 'A' }])).toBe(false)
    expect(isValidPropertyValue(options, [{ value: 'a', label: 'A', extra: 1 }])).toBe(false)
    expect(isValidPropertyValue(options, [{ value: 'a', label: 'A', children: [] }])).toBe(false)
    expect(isValidPropertyValue(options, [{ value: 'a' }])).toBe(false)
  })

  it('选项可带 UI 选择类组件认的语气与副文本，树形选项另可带 hasChildren', () => {
    const options = of({ kind: 'options' })
    expect(isValidPropertyValue(options, [{ value: 'a', label: 'A', tone: 'danger', description: '已停用' }])).toBe(true)
    expect(isValidPropertyValue(options, [{ value: 'a', label: 'A', tone: 'red' }])).toBe(false)
    expect(isValidPropertyValue(options, [{ value: 'a', label: 'A', hasChildren: true }])).toBe(false)
    expect(isValidPropertyValue(of({ kind: 'tree-options' }), [{ value: 'a', label: 'A', hasChildren: false }])).toBe(true)
  })

  it('树形选项可以嵌套，各层 value 各自不重复', () => {
    const tree = of({ kind: 'tree-options' })
    const value = [{ value: 'zj', label: '浙江', children: [{ value: 'hz', label: '杭州' }, { value: 'nb', label: '宁波' }] }]
    expect(isValidPropertyValue(tree, value)).toBe(true)
    expect(isValidPropertyValue(tree, [{ value: 'zj', label: '浙江', children: [{ value: 'hz', label: 'A' }, { value: 'hz', label: 'B' }] }])).toBe(false)
    let deep: unknown = []
    for (let index = 0; index < 40; index += 1)
      deep = [{ value: 'x', label: 'x', children: deep }]
    expect(isValidPropertyValue(tree, deep)).toBe(false)
  })
})

describe('属性编辑器查找表', () => {
  const label: FormPropertyDescriptor = { path: ['label'], control: { kind: 'text' } }
  const options: FormPropertyDescriptor = { path: ['options'], control: { kind: 'options' } }
  const initialValue: FormPropertyDescriptor = { path: ['initialValue'], control: { kind: 'json' } }
  const precision: FormPropertyDescriptor = { path: ['precision'], control: { kind: 'number', integer: true } }
  const hint: FormPropertyDescriptor = { path: ['hint'], control: { kind: 'text', multiline: true } }

  it('缺省按编辑方式取编辑器，字段初始值按路径用 value 编辑器', () => {
    expect(resolvePropertyEditor(FORM_PROPERTY_EDITORS, 'text', label)).toBe('text')
    expect(resolvePropertyEditor(FORM_PROPERTY_EDITORS, 'select', options)).toBe('options')
    expect(resolvePropertyEditor(FORM_PROPERTY_EDITORS, 'number', precision)).toBe('number')
    expect(resolvePropertyEditor(FORM_PROPERTY_EDITORS, 'text', initialValue)).toBe('value')
  })

  it('宿主在表单的表上覆盖：种类 + 路径优先于路径，路径优先于编辑方式', () => {
    const table = { ...FORM_PROPERTY_EDITORS, byPath: { ...FORM_PROPERTY_EDITORS.byPath, label: 'rich-label' }, byTarget: { select: { label: 'select-label' } } }
    expect(resolvePropertyEditor(table, 'select', label)).toBe('select-label')
    expect(resolvePropertyEditor(table, 'text', label)).toBe('rich-label')
    expect(resolvePropertyEditor(table, 'text', hint)).toBe('text')
  })
})
