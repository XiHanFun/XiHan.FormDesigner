import type { ContainerNode, FieldNode, FormDocument, FormNode } from '@xihan-form/core'
import type { FormEditorChange } from '../src'
import { createDocument, createFormModel, createNode, findNode, findRegion, validateDocument } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { describe, expect, it } from 'vitest'
import { createFormEditor } from '../src'

const registry = createFormModel().registry

function sample() {
  const ids = createIdAllocator('s')
  const name = createNode(registry, 'text', ids, { key: 'name' }) as FieldNode
  const age = createNode(registry, 'number', ids, { key: 'age' }) as FieldNode
  const card = createNode(registry, 'card', ids) as ContainerNode
  const lines = createNode(registry, 'subtable', ids, { key: 'lines' }) as ContainerNode
  const document: FormDocument = { ...createDocument(), children: [name, age, card, lines] }
  return { document, name, age, card, lines }
}

function editorOf(document: FormDocument, now?: () => number) {
  return createFormEditor({ document, ...(now === undefined ? {} : { now }) })
}

function ids(nodes: readonly FormNode[]): string[] {
  return nodes.map(node => node.id)
}

describe('新建节点', () => {
  it('缺省放到顶层末尾并选中；有选中时放在选中节点之后', () => {
    const { document, name } = sample()
    const editor = editorOf(document)
    const first = editor.addNode('switch')!
    expect(editor.document.children.at(-1)!.id).toBe(first.id)
    expect(editor.selection.nodes).toEqual([first.id])
    editor.select({ nodes: [name.id] })
    const second = editor.addNode('checkbox')!
    expect(editor.document.children[1]!.id).toBe(second.id)
    expect(validateDocument(editor.document)).toEqual([])
  })

  it('可以放进容器的区域；子表只收字段；种类未登记时抛错', () => {
    const { document, card, lines } = sample()
    const editor = editorOf(document)
    const inner = editor.addNode('text', { parent: card.regions[0]!.id })!
    expect(findNode(editor.document, inner.id)!.region!.id).toBe(card.regions[0]!.id)
    expect(editor.canAdd('card', { parent: lines.regions[0]!.id })).toBe(false)
    expect(editor.addNode('card', { parent: lines.regions[0]!.id })).toBeUndefined()
    expect(editor.addNode('text', { parent: 'nope' })).toBeUndefined()
    expect(() => editor.addNode('nope')).toThrow(RangeError)
  })

  it('撤销后选择里不再含已不存在的节点', () => {
    const { document } = sample()
    const editor = editorOf(document)
    editor.addNode('text')
    editor.undo()
    expect(editor.selection.nodes).toEqual([])
    expect(editor.document).toEqual(document)
  })
})

describe('移动与嵌套', () => {
  it('在同一层里调整先后，放置点按移动前的子节点计', () => {
    const { document, name, age, card, lines } = sample()
    const editor = editorOf(document)
    expect(editor.moveNodes([name.id], { parent: null, index: 3 })).toBe(true)
    expect(ids(editor.document.children)).toEqual([age.id, card.id, name.id, lines.id])
    expect(editor.moveNodes([lines.id, age.id], { parent: null, index: 0 })).toBe(true)
    expect(ids(editor.document.children)).toEqual([age.id, lines.id, card.id, name.id])
    editor.undo()
    editor.undo()
    expect(editor.document).toEqual(document)
  })

  it('移进容器的区域，一组节点按文档顺序接在一起，合为一步撤销', () => {
    const { document, name, age, card } = sample()
    const editor = editorOf(document)
    expect(editor.moveNodes([age.id, name.id], { parent: card.regions[0]!.id })).toBe(true)
    expect(ids(findRegion(editor.document, card.regions[0]!.id)!.region.children)).toEqual([name.id, age.id])
    expect(editor.history.undoCount).toBe(1)
  })

  it('不能放进自己的区域、子表不收容器；位置没变时不记撤销', () => {
    const { document, name, card, lines } = sample()
    const editor = editorOf(document)
    expect(editor.moveNodes([card.id], { parent: card.regions[0]!.id })).toBe(false)
    expect(editor.moveNodes([card.id], { parent: lines.regions[0]!.id })).toBe(false)
    expect(editor.moveNodes([name.id], { parent: null, index: 0 })).toBe(true)
    expect(editor.history.canUndo).toBe(false)
  })
})

describe('删除', () => {
  it('删除选中的节点；祖先也选中时只删祖先', () => {
    const { document, card } = sample()
    const editor = editorOf(document)
    const inner = editor.addNode('text', { parent: card.regions[0]!.id })!
    editor.select({ nodes: [inner.id, card.id] })
    expect(editor.deleteSelection()).toBe(true)
    expect(findNode(editor.document, card.id)).toBeUndefined()
    expect(editor.selection.nodes).toEqual([])
    expect(editor.deleteSelection()).toBe(false)
  })
})

describe('属性与合并', () => {
  it('连续写同一属性在合并时限内合为一步，seal 之后另起一步', () => {
    const { document, name } = sample()
    let time = 0
    const editor = editorOf(document, () => time)
    editor.setProperty(name.id, 'basic', 'label', '姓')
    time = 100
    editor.setProperty(name.id, 'basic', 'label', '姓名')
    expect(editor.history.undoCount).toBe(1)
    editor.seal()
    editor.setProperty(name.id, 'basic', 'label', '姓名（必填）')
    expect(editor.history.undoCount).toBe(2)
    editor.undo()
    expect((findNode(editor.document, name.id)!.node as FieldNode).basic.label).toBe('姓名')
    editor.undo()
    expect(editor.document).toEqual(document)
  })

  it('改键、改设置、写区域属性；value 为 undefined 时删除', () => {
    const { document, name, card } = sample()
    const editor = editorOf(document)
    editor.setKey(name.id, 'fullName')
    editor.setSetting('size', 'lg')
    editor.setRegionProperty(card.regions[0]!.id, 'note', 'x')
    editor.setRegionProperty(card.regions[0]!.id, 'note', undefined)
    expect((findNode(editor.document, name.id)!.node as FieldNode).key).toBe('fullName')
    expect(editor.document.settings.size).toBe('lg')
    expect(findRegion(editor.document, card.regions[0]!.id)!.region.props).toEqual(card.regions[0]!.props)
  })

  it('栅格跨度取整并夹在属性描述的上下限里', () => {
    const editor = editorOf(createDocument())
    const grid = editor.addNode('grid') as ContainerNode
    const region = grid.regions[0]!.id
    editor.setGridSpan(region, 7.6)
    expect(findRegion(editor.document, region)!.region.props.span).toBe(8)
    editor.setGridSpan(region, 99)
    expect(findRegion(editor.document, region)!.region.props.span).toBe(12)
    editor.setGridSpan(region, 0)
    expect(findRegion(editor.document, region)!.region.props.span).toBe(1)
  })
})

describe('规则与区域', () => {
  it('新增规则时分配 id，可整条替换、移动与删除', () => {
    const { document, name } = sample()
    const editor = editorOf(document)
    const required = editor.addRule(name.id, 'validation', { kind: 'required' })
    const length = editor.addRule(name.id, 'validation', { kind: 'length', max: 10 })
    expect(required.id).not.toBe(length.id)
    editor.updateRule(name.id, 'validation', { ...length, kind: 'length', max: 20 } as never)
    editor.moveRule(name.id, 'validation', length.id, 0)
    const rules = () => (findNode(editor.document, name.id)!.node as FieldNode).validation
    expect(rules().map(rule => rule.id)).toEqual([length.id, required.id])
    editor.removeRule(name.id, 'validation', required.id)
    expect(rules()).toEqual([{ id: length.id, kind: 'length', max: 20 }])
    expect(validateDocument(editor.document)).toEqual([])
  })

  it('标签页新增、移动与删除区域', () => {
    const editor = editorOf(createDocument())
    const tabs = editor.addNode('tabs') as ContainerNode
    const added = editor.addRegion(tabs.id, undefined, { title: '第二页' })
    editor.moveRegion(added.id, 0)
    const regions = () => (findNode(editor.document, tabs.id)!.node as ContainerNode).regions
    expect(regions().map(region => region.id)).toEqual([added.id, ...tabs.regions.map(region => region.id)])
    editor.removeRegion(added.id)
    expect(regions().map(region => region.id)).toEqual(tabs.regions.map(region => region.id))
    expect(() => editor.addRegion('nope')).toThrow(RangeError)
  })

  it('表格布局合并、拆分单元格，插入与删除行列', () => {
    const editor = editorOf(createDocument())
    const table = editor.addNode('table') as ContainerNode
    const [a, b] = table.regions
    editor.mergeCells(table.id, [a!.id, b!.id])
    expect(findRegion(editor.document, a!.id)!.region.props.columnSpan).toBe(2)
    editor.splitCell(table.id, a!.id)
    expect((findNode(editor.document, table.id)!.node as ContainerNode).regions).toHaveLength(4)
    editor.insertTableLine(table.id, 'row', 2)
    expect((findNode(editor.document, table.id)!.node as ContainerNode).regions).toHaveLength(6)
    editor.removeTableLine(table.id, 'row', 2)
    expect(validateDocument(editor.document)).toEqual([])
  })
})

describe('剪贴板', () => {
  it('复制粘贴：id 全部换新，冲突的键改为派生键，选中粘贴出的节点', () => {
    const { document, name, age } = sample()
    const editor = editorOf(document)
    editor.select({ nodes: [age.id, name.id] })
    const copied = editor.copy()!
    expect(ids(copied.nodes)).toEqual([name.id, age.id])
    const pasted = editor.paste()
    expect(pasted.nodes).toHaveLength(2)
    expect(pasted.nodes.some(id => id === name.id || id === age.id)).toBe(false)
    const keys = pasted.nodes.map(id => (findNode(editor.document, id)!.node as FieldNode).key)
    expect(keys.every(key => key !== 'name' && key !== 'age')).toBe(true)
    expect(validateDocument(editor.document)).toEqual([])
  })

  it('剪切后粘贴回原处；再制紧跟在原节点之后且不改动剪贴板', () => {
    const { document, name, card } = sample()
    const editor = editorOf(document)
    editor.select({ nodes: [name.id] })
    editor.cut()
    expect(findNode(editor.document, name.id)).toBeUndefined()
    const pasted = editor.paste(undefined, { parent: null, index: 0 })
    expect((findNode(editor.document, pasted.nodes[0]!)!.node as FieldNode).key).toBe('name')
    editor.select({ nodes: [card.id] })
    const duplicated = editor.duplicate()
    const position = findNode(editor.document, duplicated.nodes[0]!)!
    expect(position.index).toBe(findNode(editor.document, card.id)!.index + 1)
    const again = editor.paste(undefined, { parent: null })
    expect(findNode(editor.document, again.nodes[0]!)!.node.kind).toBe('text')
  })

  it('目标区域不收时什么都不做', () => {
    const { document, card, lines } = sample()
    const editor = editorOf(document)
    editor.select({ nodes: [card.id] })
    editor.copy()
    expect(editor.paste(undefined, { parent: lines.regions[0]!.id })).toEqual({ nodes: [] })
    expect(editor.document).toBe(document)
  })
})

describe('装载与通知', () => {
  it('文档变化与选择变化各发一次通知；装载清空历史与选择', () => {
    const { document, name } = sample()
    const editor = editorOf(document)
    const changes: FormEditorChange['kind'][] = []
    editor.subscribe(change => changes.push(change.kind))
    editor.select({ nodes: [name.id] })
    editor.setProperty(name.id, 'basic', 'label', 'x')
    expect(changes).toEqual(['selection', 'document'])
    editor.load(createDocument())
    expect(editor.history.canUndo).toBe(false)
    expect(editor.selection.nodes).toEqual([])
    expect(editor.validate()).toEqual([])
  })
})

describe('区域选择', () => {
  it('选中同一容器里的区域，与节点互斥；别的容器的区域不留', () => {
    const { document, name, card } = sample()
    const editor = editorOf(document)
    const tabs = editor.addNode('tabs') as ContainerNode
    editor.select({ nodes: [name.id] })
    editor.select({ regions: [tabs.regions[0]!.id, card.regions[0]!.id] })
    expect(editor.selection).toEqual({ nodes: [], regions: [tabs.regions[0]!.id] })
    editor.select({ regions: [tabs.regions[1]!.id] }, 'add')
    expect(editor.selection.regions).toEqual(tabs.regions.map(region => region.id))
    editor.select({ regions: [tabs.regions[0]!.id] }, 'toggle')
    expect(editor.selection.regions).toEqual([tabs.regions[1]!.id])
    editor.select({ nodes: [name.id] })
    expect(editor.selection).toEqual({ nodes: [name.id] })
  })

  it('选中区域时新建的节点放进该区域末尾', () => {
    const { document, card } = sample()
    const editor = editorOf(document)
    editor.select({ regions: [card.regions[0]!.id] })
    const added = editor.addNode('text')!
    expect(findNode(editor.document, added.id)!.region!.id).toBe(card.regions[0]!.id)
  })

  it('删除选中的区域：不能少于区域下限，表格布局的单元格不删；删掉后选择清空', () => {
    const editor = editorOf(createDocument())
    const tabs = editor.addNode('tabs') as ContainerNode
    editor.select({ regions: [tabs.regions[0]!.id] })
    expect(editor.deleteSelection()).toBe(true)
    expect(editor.selection).toEqual({ nodes: [] })
    const left = (findNode(editor.document, tabs.id)!.node as ContainerNode).regions
    editor.select({ regions: [left[0]!.id] })
    expect(editor.deleteSelection()).toBe(false)
    const table = editor.addNode('table') as ContainerNode
    editor.select({ regions: [table.regions[0]!.id] })
    expect(editor.deleteSelection()).toBe(false)
    expect(editor.copy()).toBeUndefined()
  })
})
