import { describe, expect, it } from 'vitest'
import { createInitialValues, createRowValues, identifiersAt, isValueOfKind, listBindings, scopeKeys } from '../src'
import { containerOf, documentOf, fieldOf, setup, withChildren } from './helpers'

function sample() {
  const { registry, ids } = setup()
  const name = fieldOf(registry, ids, 'text', 'name')
  const tags = { ...fieldOf(registry, ids, 'select', 'tags'), data: { options: [], multiple: true } }
  const price = fieldOf(registry, ids, 'number', 'price')
  const qty = { ...fieldOf(registry, ids, 'number', 'qty'), basic: { label: '', initialValue: 1 } }
  const note = fieldOf(registry, ids, 'text', 'note')
  const lines = withChildren(containerOf(registry, ids, 'subtable', 'lines'), 0, [price, qty])
  const orders = { ...withChildren(containerOf(registry, ids, 'subform', 'orders'), 0, [note, lines]), data: { initialRows: 2, movable: true } }
  const card = withChildren(containerOf(registry, ids, 'card'), 0, [tags, orders])
  const grid = containerOf(registry, ids, 'grid')
  return { registry, document: documentOf([name, card, grid]), name, tags, price, qty, note, lines, orders }
}

describe('数据绑定', () => {
  it('按文档顺序列出字段与列表容器，布局容器对数据透明', () => {
    const { document, orders, lines } = sample()
    expect(listBindings(document).map(binding => [binding.node.key, binding.scope, binding.path.join('.')])).toEqual([
      ['name', null, 'name'],
      ['tags', null, 'tags'],
      ['orders', null, 'orders'],
      ['note', orders.id, 'orders.note'],
      ['lines', orders.id, 'orders.lines'],
      ['price', lines.id, 'orders.lines.price'],
      ['qty', lines.id, 'orders.lines.qty'],
    ])
  })

  it('scopeKeys 列出某个作用域里直接绑定的键', () => {
    const { document, orders } = sample()
    expect(scopeKeys(document, null)).toEqual(['name', 'tags', 'orders'])
    expect(scopeKeys(document, orders.id)).toEqual(['note', 'lines'])
  })

  it('identifiersAt：顶层键、$value，列表里另有 $row 与 $index', () => {
    const { document, name, price, orders } = sample()
    expect(identifiersAt(document, name.id)).toEqual(['name', 'tags', 'orders', '$value'])
    expect(identifiersAt(document, price.id, ['$user'])).toEqual(['name', 'tags', 'orders', '$user', '$value', '$row', '$index'])
    expect(identifiersAt(document, orders.id)).toEqual(['name', 'tags', 'orders', '$value'])
    expect(identifiersAt(document, 'missing')).toBeUndefined()
  })
})

describe('初始值', () => {
  it('字段取初始值或空值，列表容器取初始行数，嵌套列表各自取初始行', () => {
    const { registry, document } = sample()
    expect(createInitialValues(document, registry)).toEqual({
      name: '',
      tags: [],
      orders: [
        { note: '', lines: [] },
        { note: '', lines: [] },
      ],
    })
  })

  it('新增一行时的行对象', () => {
    const { registry, lines, orders } = sample()
    expect(createRowValues(lines, registry)).toEqual({ price: null, qty: 1 })
    expect(createRowValues(orders, registry)).toEqual({ note: '', lines: [] })
  })

  it('每次得到新的对象，改动互不影响', () => {
    const { registry, document } = sample()
    const a = createInitialValues(document, registry)
    const b = createInitialValues(document, registry)
    expect(a.tags).not.toBe(b.tags)
    expect(Object.isFrozen(a)).toBe(false)
  })

  it('种类没有登记时抛 TypeError', () => {
    const { registry, ids } = setup()
    const node = { ...fieldOf(registry, ids, 'text', 'x'), kind: 'nope' }
    expect(() => createInitialValues(documentOf([node]), registry)).toThrow(TypeError)
  })
})

describe('值形状', () => {
  it.each([
    ['string', 'a', 1],
    ['string', null, undefined],
    ['number', 1.5, Number.NaN],
    ['number', null, '1'],
    ['boolean', false, null],
    ['string-list', ['a'], [1]],
    ['number-list', [1, 2], ['1']],
    ['list', [['a'], { id: 'f' }], 'x'],
    ['object', { strokes: [] }, []],
    ['object', null, new Date()],
  ] as const)('%s 接受 %j、拒绝 %j', (kind, good, bad) => {
    expect(isValueOfKind(kind, good)).toBe(true)
    expect(isValueOfKind(kind, bad)).toBe(false)
  })
})
