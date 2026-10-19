// @vitest-environment jsdom

import type { ContainerNode, FieldNode, FormDocument } from '@xihan-form/core'
import type { FormDesignerTranslations } from '@xihan-form/runtime'
import type { XhDesignerOutlineElement } from '@xihan-ui/designer-shell'
import type { XhFormDesigner } from '../src'
import { createDocument, createFormModel, createNode, findNode, findRegion } from '@xihan-form/core'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS } from '@xihan-form/runtime'
import { formZhCN } from '@xihan-form/runtime/locale'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { setXhConfig } from '@xihan-ui/web-components'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { afterEach, describe, expect, it } from 'vitest'
import { defineFormDesigner, FORM_DESIGNER_TAG } from '../src'
import { formOutlineNodes, formOutlineTarget } from '../src/outline'

defineXhElements()
defineFormDesigner()

Element.prototype.scrollIntoView ??= function scrollIntoView() {}

const registry = createFormModel().registry
const T = DEFAULT_FORM_DESIGNER_TRANSLATIONS
const ZH = formZhCN.translations!['xh-form-designer'] as FormDesignerTranslations
const mounted: Element[] = []

afterEach(() => {
  for (const element of mounted.splice(0))
    element.remove()
  setXhConfig({})
})

/** 一份各种容器都有的模板：顶层字段、两列栅格（第一列放一个字段）、卡片、只填了一格的表格布局、两页标签页。 */
function sample() {
  const ids = createIdAllocator('o')
  const field = (kind: string, key: string, label?: string): FieldNode => {
    const node = createNode(registry, kind, ids, { key }) as FieldNode
    return label === undefined ? node : { ...node, basic: { ...node.basic, label } }
  }
  const name = field('text', 'name', '姓名')
  const age = field('number', 'age')
  const phone = field('text', 'phone')
  const note = field('textarea', 'note')
  const grid = createNode(registry, 'grid', ids) as ContainerNode
  const card = createNode(registry, 'card', ids) as ContainerNode
  const table = createNode(registry, 'table', ids) as ContainerNode
  const tabs = createNode(registry, 'tabs', ids) as ContainerNode
  const filledGrid: ContainerNode = { ...grid, regions: [{ ...grid.regions[0]!, children: [age] }, grid.regions[1]!] }
  const filledCard: ContainerNode = { ...card, basic: { ...card.basic, title: '联系方式' }, regions: [{ ...card.regions[0]!, children: [phone] }] }
  const lastCell = table.regions.at(-1)!
  const filledTable: ContainerNode = { ...table, regions: table.regions.map(region => (region === lastCell ? { ...region, children: [note] } : region)) }
  const titledTabs: ContainerNode = { ...tabs, regions: [{ ...tabs.regions[0]!, props: { ...tabs.regions[0]!.props, title: '基本信息' } }, tabs.regions[1]!] }
  const document: FormDocument = { ...createDocument(), children: [name, filledGrid, filledCard, filledTable, titledTabs] }
  return { document, name, age, phone, note, grid: filledGrid, card: filledCard, table: filledTable, tabs: titledTabs, lastCell }
}

async function mount(document: FormDocument, setup: (designer: XhFormDesigner) => void = () => {}): Promise<XhFormDesigner> {
  const designer = window.document.createElement(FORM_DESIGNER_TAG)
  designer.schema = document
  setup(designer)
  window.document.body.append(designer)
  mounted.push(designer)
  await settle(designer)
  return designer
}

async function settle(designer: XhFormDesigner): Promise<void> {
  await designer.updateComplete
  await designer.querySelector('xh-designer-frame')!.updateComplete
  await designer.querySelector<XhDesignerOutlineElement>('xh-designer-outline')?.updateComplete
}

function outlineOf(designer: XhFormDesigner): XhDesignerOutlineElement {
  return designer.querySelector<XhDesignerOutlineElement>('xh-designer-outline')!
}

function send(outline: Element, type: string, detail: unknown): void {
  outline.dispatchEvent(new CustomEvent(type, { detail }))
}

describe('页面结构：树', () => {
  it('节点写「种类 · 数据键」、副文本是标签或标题；只有一个区域的容器省掉区域层，表格布局只列有内容的格，区域行按列、格或标题命名', () => {
    const { document, name, age, phone, note, grid, card, table, tabs, lastCell } = sample()
    const tree = formOutlineNodes(document, registry, T)
    const cell = `Row ${(lastCell.props.row as number) + 1}, column ${(lastCell.props.column as number) + 1}`
    expect(tree).toEqual([
      { id: name.id, label: 'Single-line text · name', description: '姓名' },
      { id: grid.id, label: 'Grid', children: [
        { id: grid.regions[0]!.id, label: 'Column 1', movable: false, deletable: true, children: [{ id: age.id, label: 'Number · age' }] },
        { id: grid.regions[1]!.id, label: 'Column 2', movable: false, deletable: true, children: [] },
      ] },
      { id: card.id, label: 'Card', description: '联系方式', children: [{ id: phone.id, label: 'Single-line text · phone' }] },
      { id: table.id, label: 'Table layout', children: [{ id: lastCell.id, label: cell, movable: false, deletable: false, children: [{ id: note.id, label: 'Multi-line text · note' }] }] },
      { id: tabs.id, label: 'Tabs', children: [
        { id: tabs.regions[0]!.id, label: '基本信息', movable: false, deletable: true, children: [] },
        { id: tabs.regions[1]!.id, label: 'Region 2', movable: false, deletable: true, children: [] },
      ] },
    ])
  })

  it('跟着设计器的文案：种类名与区域行的说法换语言就变', () => {
    const { document, grid } = sample()
    const tree = formOutlineNodes(document, registry, ZH)
    expect(tree[1]!.label).toBe('栅格')
    expect(tree[1]!.children![0]!.label).toBe('第 1 列')
    expect(grid.regions).toHaveLength(2)
  })

  it('挪动换成放置位置：位次按挪动前的子节点计，省掉区域层的容器换成它唯一的区域，有几个区域的容器与叶子不能当父级', () => {
    const { document, name, age, card, grid } = sample()
    expect(formOutlineTarget(document, registry, { id: name.id, parent: null, index: 1 })).toEqual({ parent: null, index: 2 })
    expect(formOutlineTarget(document, registry, { id: card.id, parent: null, index: 0 })).toEqual({ parent: null, index: 0 })
    expect(formOutlineTarget(document, registry, { id: name.id, parent: null, index: 4 })).toEqual({ parent: null, index: 5 })
    expect(formOutlineTarget(document, registry, { id: name.id, parent: card.id, index: 1 })).toEqual({ parent: card.regions[0]!.id, index: 1 })
    expect(formOutlineTarget(document, registry, { id: name.id, parent: grid.regions[1]!.id, index: 0 })).toEqual({ parent: grid.regions[1]!.id, index: 0 })
    expect(formOutlineTarget(document, registry, { id: name.id, parent: grid.id, index: 0 })).toBeUndefined()
    expect(formOutlineTarget(document, registry, { id: name.id, parent: age.id, index: 0 })).toBeUndefined()
  })
})

describe('页面结构：面板', () => {
  it('放在左栏物料下面，带搜索框；交上树与画布的选择，选择变了跟着变', async () => {
    const { document, name, grid } = sample()
    const designer = await mount(document)
    const outline = outlineOf(designer)
    expect([outline.slot, outline.headless, outline.searchable]).toEqual(['outline', true, true])
    expect(outline.nodes!.map(node => node.id)).toEqual(document.children.map(node => node.id))
    expect(outline.selection).toEqual([])
    designer.select({ nodes: [name.id] })
    await settle(designer)
    expect(outline.selection).toEqual([name.id])
    designer.select({ regions: [grid.regions[1]!.id] })
    await settle(designer)
    expect(outline.selection).toEqual([grid.regions[1]!.id])
  })

  it('点一行选中节点或区域并亮出来：区域在标签页里时切到那一页', async () => {
    const { document, phone, tabs } = sample()
    const designer = await mount(document)
    const outline = outlineOf(designer)
    send(outline, 'node-select', { ids: [phone.id] })
    expect(designer.getSelection()).toEqual({ nodes: [phone.id] })
    send(outline, 'node-select', { ids: [tabs.regions[1]!.id] })
    expect(designer.getSelection()).toEqual({ nodes: [], regions: [tabs.regions[1]!.id] })
    await settle(designer)
    const host = designer.querySelector<HTMLElement & { value?: unknown }>(`[data-node-id="${tabs.id}"] xh-tabs`)!
    expect(host.value).toBe(tabs.regions[1]!.id)
  })

  it('悬停或焦点所在的行在画布上标出，换一行换标，离开时撤掉；重排画布后照样标着', async () => {
    const { document, name, grid } = sample()
    const designer = await mount(document)
    const outline = outlineOf(designer)
    const marked = (): string[] => [...designer.querySelectorAll<HTMLElement>('[data-highlighted]')].map(element => element.dataset.nodeId ?? element.dataset.regionId!)
    send(outline, 'node-highlight', { id: name.id })
    expect(marked()).toEqual([name.id])
    send(outline, 'node-highlight', { id: grid.regions[0]!.id })
    expect(marked()).toEqual([grid.regions[0]!.id])
    designer.execute([{ type: 'setProperty', nodeId: name.id, group: 'basic', name: 'label', value: '全名' }])
    await settle(designer)
    expect(marked()).toEqual([grid.regions[0]!.id])
    send(outline, 'node-highlight', { id: null })
    expect(marked()).toEqual([])
  })

  it('删除走设计器的删除：节点删掉，区域按工具栏的规矩删；挪动是一步撤销，判定与位次照编辑模型', async () => {
    const { document, name, age, card, grid } = sample()
    const designer = await mount(document)
    const outline = outlineOf(designer)
    send(outline, 'node-delete', { ids: [grid.regions[1]!.id] })
    expect(findRegion(designer.schema, grid.regions[1]!.id)).toBeUndefined()
    send(outline, 'node-delete', { ids: [age.id] })
    expect(findNode(designer.schema, age.id)).toBeUndefined()
    designer.undo()
    designer.undo()
    await settle(designer)
    expect(outline.allowMove!({ id: name.id, parent: card.id, index: 0 })).toBe(true)
    expect(outline.allowMove!({ id: card.id, parent: card.id, index: 0 })).toBe(false)
    send(outline, 'node-move', { id: name.id, parent: null, index: 2 })
    expect(designer.schema.children.map(node => node.id)).toEqual([grid.id, card.id, name.id, ...document.children.slice(3).map(node => node.id)])
    send(outline, 'node-move', { id: name.id, parent: card.id, index: 0 })
    expect(findNode(designer.schema, name.id)!.region!.id).toBe(card.regions[0]!.id)
    designer.undo()
    designer.undo()
    expect(designer.schema).toEqual(document)
  })

  it('只读时能选、能标出，不能删、不能挪；预览态不登记这块面板', async () => {
    const { document, name } = sample()
    const designer = await mount(document, (element) => {
      element.readonly = true
    })
    const outline = outlineOf(designer)
    expect([outline.readonly, outline.allowMove]).toEqual([true, undefined])
    send(outline, 'node-delete', { ids: [name.id] })
    expect(findNode(designer.schema, name.id)).toBeDefined()
    designer.mode = 'preview'
    await settle(designer)
    expect(designer.querySelector('xh-designer-frame')!.showsPanel('outline')).toBe(false)
  })

  it('面板标题跟着语言变', async () => {
    const designer = await mount(sample().document)
    const frame = designer.querySelector('xh-designer-frame')!
    expect(frame.panelEntries().find(entry => entry.name === 'outline')!.label).toBe('Structure')
    setXhConfig(formZhCN)
    await settle(designer)
    expect(frame.panelEntries().find(entry => entry.name === 'outline')!.label).toBe('页面结构')
  })
})
