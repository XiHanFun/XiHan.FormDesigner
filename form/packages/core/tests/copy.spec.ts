import type { FieldNode, FormNode } from '../src'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { describe, expect, it } from 'vitest'
import { applyOperation, cloneNodesForInsert, collectDocumentIds, collectIds, formDataFields, regionScope, validateDocument } from '../src'
import { containerOf, documentOf, fieldOf, setup, withChildren } from './helpers'

function sample() {
  const { registry, ids } = setup()
  const name = { ...fieldOf(registry, ids, 'text', 'name'), validation: [{ id: 'r1', kind: 'required' }] } as FieldNode
  const price = fieldOf(registry, ids, 'number', 'price')
  const lines = withChildren(containerOf(registry, ids, 'subtable', 'lines'), 0, [price])
  const card = withChildren(containerOf(registry, ids, 'card'), 0, [fieldOf(registry, ids, 'text', 'note')])
  return { registry, ids, document: documentOf([name, lines, card]), name, price, lines, card }
}

describe('文档里的 id', () => {
  it('节点、区域与规则的 id 都收进来，按出现顺序', () => {
    const { document, name, lines, card } = sample()
    const all = collectDocumentIds(document)
    expect(all.has(name.id)).toBe(true)
    expect(all.has('r1')).toBe(true)
    expect(all.has(lines.regions[0]!.id)).toBe(true)
    expect(all.has(card.regions[0]!.children[0]!.id)).toBe(true)
    const out: string[] = []
    collectIds(name, out)
    expect(out).toEqual([name.id, 'r1'])
  })
})

describe('区域的数据作用域', () => {
  it('列表容器里的区域属于该列表，布局容器里的区域属于外层；找不到区域时为 undefined', () => {
    const { document, lines, card } = sample()
    expect(regionScope(document, null)).toBeNull()
    expect(regionScope(document, lines.regions[0]!.id)).toBe(lines.id)
    expect(regionScope(document, card.regions[0]!.id)).toBeNull()
    expect(regionScope(document, 'nope')).toBeUndefined()
  })
})

describe('复制节点以便插入', () => {
  it('id 全部换新，插回原文档不冲突，结构校验通过', () => {
    const { registry, document, name, card } = sample()
    const ids = createIdAllocator('c', collectDocumentIds(document))
    const [copy, copyCard] = cloneNodesForInsert(document, null, [name, card], ids) as [FieldNode, FormNode]
    expect(copy.id).not.toBe(name.id)
    expect(copy.validation[0]!.id).not.toBe('r1')
    const fresh: string[] = []
    collectIds(copyCard, fresh)
    expect(fresh.some(id => collectDocumentIds(document).has(id))).toBe(false)
    let next = applyOperation(document, { type: 'insertNode', parent: null, index: 3, node: copy }).document
    next = applyOperation(next, { type: 'insertNode', parent: null, index: 4, node: copyCard }).document
    expect(validateDocument(next, registry)).toEqual([])
  })

  it('与目标作用域已有的键冲突时改为派生键，列表容器内部的键原样保留', () => {
    const { document, name, lines } = sample()
    const ids = createIdAllocator('c', collectDocumentIds(document))
    const [copyName, copyLines] = cloneNodesForInsert(document, null, [name, lines], ids) as [FieldNode, FormNode & { key: string, regions: { children: FieldNode[] }[] }]
    expect(copyName.key).toBe(`text_${copyName.id}`)
    expect(copyLines.key).toBe(`subtable_${copyLines.id}`)
    expect(copyLines.regions[0]!.children[0]!.key).toBe('price')
  })

  it('放进列表行里时只看行内的键；被复制的节点彼此重名也会改开', () => {
    const { registry, document, name, price, lines } = sample()
    const ids = createIdAllocator('c', collectDocumentIds(document))
    const twin = fieldOf(registry, setup().ids, 'text', 'name')
    const pasted = cloneNodesForInsert(document, lines.regions[0]!.id, [name, twin, price], ids) as FieldNode[]
    expect(pasted.map(node => node.key)).toEqual(['name', `text_${pasted[1]!.id}`, `number_${pasted[2]!.id}`])
  })

  it('目标区域不存在时抛错', () => {
    const { document, name } = sample()
    expect(() => cloneNodesForInsert(document, 'nope', [name], createIdAllocator('c'))).toThrow(RangeError)
  })
})

describe('表单数据的字段树', () => {
  it('字段是 value，列表容器是 list 并带一行里的字段，布局容器不占层级', () => {
    const { document } = sample()
    const fields = formDataFields(document)
    expect(fields.map(field => [field.name, field.kind])).toEqual([['name', 'value'], ['lines', 'list'], ['note', 'value']])
    expect(fields[1]!.children!.map(field => field.name)).toEqual(['price'])
  })

  it('标签取字段的 label 与列表容器的 title，空的不带', () => {
    const { registry, ids } = setup()
    const name = fieldOf(registry, ids, 'text', 'name')
    const labelled = { ...name, basic: { ...name.basic, label: '姓名' } }
    const lines = containerOf(registry, ids, 'subform', 'rows')
    const titled = { ...lines, basic: { ...lines.basic, title: '明细' } }
    expect(formDataFields(documentOf([labelled, titled]))).toEqual([
      { name: 'name', label: '姓名', kind: 'value' },
      { name: 'rows', label: '明细', kind: 'list', children: [] },
    ])
  })
})
