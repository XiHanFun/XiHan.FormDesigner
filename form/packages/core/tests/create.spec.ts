import type { ContainerNode } from '../src'
import { describe, expect, it } from 'vitest'
import {
  createDocument,
  createNode,
  deriveKey,
  descendantsOf,
  findNode,
  findRegion,
  FORM_SCHEMA_VERSION,
  isValidKey,
  tableCells,
  walkNodes,
} from '../src'
import { containerOf, documentOf, fieldOf, setup, withChildren } from './helpers'

describe('新建文档与节点', () => {
  it('空文档带结构版本与表单设置的缺省值，可以覆盖', () => {
    expect(createDocument()).toEqual({
      schemaVersion: FORM_SCHEMA_VERSION,
      settings: { labelPlacement: 'top', size: 'md', disabled: false, readOnly: false },
      children: [],
    })
    expect(createDocument({ size: 'lg' }).settings.size).toBe('lg')
    expect(Object.isFrozen(createDocument().settings)).toBe(true)
  })

  it('字段按原型取缺省属性，键缺省由种类名与 id 派生', () => {
    const { registry, ids } = setup()
    const node = createNode(registry, 'date-range', ids)
    expect(node).toEqual({
      type: 'field',
      id: 'n1',
      kind: 'date-range',
      key: 'dateRange_n1',
      basic: { label: '', hidden: false, disabled: false, readOnly: false },
      data: { withTime: false },
      appearance: { labelHidden: false, size: 'md' },
      validation: [],
      linkage: [],
    })
    expect(Object.isFrozen(node)).toBe(true)
    expect(Object.isFrozen(node.basic)).toBe(true)
  })

  it('可以指定键', () => {
    const { registry, ids } = setup()
    expect(fieldOf(registry, ids, 'text', 'name').key).toBe('name')
  })

  it('容器按原型新建区域，区域 id 同样来自注入的 id 来源', () => {
    const { registry, ids } = setup()
    const grid = containerOf(registry, ids, 'grid')
    expect(grid.id).toBe('n1')
    expect(grid.key).toBeUndefined()
    expect(grid.regions).toEqual([
      { id: 'n2', props: { span: 6 }, children: [] },
      { id: 'n3', props: { span: 6 }, children: [] },
    ])
  })

  it('列表容器带数据键', () => {
    const { registry, ids } = setup()
    expect(containerOf(registry, ids, 'subform').key).toBe('subform_n1')
    expect(containerOf(registry, ids, 'subtable', 'items').key).toBe('items')
  })

  it('表格布局新建为 2 × 2 的单元格', () => {
    const { registry, ids } = setup()
    const table = containerOf(registry, ids, 'table')
    expect(table.appearance).toMatchObject({ rows: 2, columns: 2 })
    expect(tableCells(table).map(cell => [cell.row, cell.column, cell.rowSpan, cell.columnSpan])).toEqual([[0, 0, 1, 1], [0, 1, 1, 1], [1, 0, 1, 1], [1, 1, 1, 1]])
  })

  it('静态元素没有键、没有校验规则', () => {
    const { registry, ids } = setup()
    expect(createNode(registry, 'paragraph', ids)).toEqual({
      type: 'static',
      id: 'n1',
      kind: 'paragraph',
      basic: { content: '', hidden: false },
      data: {},
      appearance: { size: 'md' },
      linkage: [],
    })
  })

  it('种类没有登记时抛 TypeError', () => {
    const { registry, ids } = setup()
    expect(() => createNode(registry, 'nope', ids)).toThrow(TypeError)
  })
})

describe('字段键', () => {
  it.each(['name', 'a1', '_x', 'orderAmount', 'A_B'])('%s 合法', (key) => {
    expect(isValidKey(key)).toBe(true)
  })

  it.each(['', '1a', 'a-b', 'a b', '$row', '订单', 'null', 'true', 'constructor', '__proto__', 'prototype'])('%s 不合法', (key) => {
    expect(isValidKey(key)).toBe(false)
  })

  it('派生的键总是合法', () => {
    expect(deriveKey('tree-select', 'f-3a9c')).toBe('treeSelect_f_3a9c')
    expect(isValidKey(deriveKey('date-range', '0f8e-11'))).toBe(true)
  })
})

describe('遍历', () => {
  function sample() {
    const { registry, ids } = setup()
    const name = fieldOf(registry, ids, 'text', 'name')
    const price = fieldOf(registry, ids, 'number', 'price')
    const items = withChildren(containerOf(registry, ids, 'subtable', 'items'), 0, [price])
    const age = fieldOf(registry, ids, 'number', 'age')
    const grid = withChildren(withChildren(containerOf(registry, ids, 'grid'), 0, [items]), 1, [age])
    return { document: documentOf([name, grid]), name, price, items, age, grid }
  }

  it('按文档顺序深度优先，带上容器链与所在区域', () => {
    const { document, grid, items, name, price, age } = sample()
    const seen: string[] = []
    walkNodes(document, (node, context) => {
      seen.push(`${node.id}@${context.region?.id ?? 'root'}:${context.index}/${context.ancestors.map(a => a.id).join('>')}`)
    })
    expect(seen).toEqual([
      `${name.id}@root:0/`,
      `${grid.id}@root:1/`,
      `${items.id}@${grid.regions[0]!.id}:0/${grid.id}`,
      `${price.id}@${items.regions[0]!.id}:0/${grid.id}>${items.id}`,
      `${age.id}@${grid.regions[1]!.id}:0/${grid.id}`,
    ])
  })

  it('访问函数返回 false 时不进入子节点', () => {
    const { document, name, grid } = sample()
    const seen: string[] = []
    walkNodes(document, (node) => {
      seen.push(node.id)
      return node.type !== 'container'
    })
    expect(seen).toEqual([name.id, grid.id])
  })

  it('按 id 查节点与区域', () => {
    const { document, price, items, grid } = sample()
    const found = findNode(document, price.id)!
    expect(found.node).toBe(price)
    expect(found.region?.id).toBe(items.regions[0]!.id)
    expect(found.ancestors.map(node => node.id)).toEqual([grid.id, items.id])
    expect(findNode(document, 'missing')).toBeUndefined()
    const region = findRegion(document, grid.regions[1]!.id)!
    expect(region.container).toBe(grid)
    expect(region.index).toBe(1)
    expect(findRegion(document, 'missing')).toBeUndefined()
  })

  it('descendantsOf 含自身与全部后代', () => {
    const { grid, items, price, age } = sample()
    expect(descendantsOf(grid).map(node => node.id)).toEqual([grid.id, items.id, price.id, age.id])
  })
})

describe('节点的 JSON 往返', () => {
  it('容器节点同样可以 JSON 往返', () => {
    const { registry, ids } = setup()
    const node: ContainerNode = containerOf(registry, ids, 'tabs')
    expect(JSON.parse(JSON.stringify(node))).toEqual(node)
  })
})
