import type { ContainerNode, FieldNode, FormDocument } from '@xihan-form/core'
import type { MenuContext, MenuEntry } from '../src/context-menu'
import { createBuiltinKindRegistry, createDocument, createNode } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { describe, expect, it } from 'vitest'
import { menuEntries } from '../src/context-menu'

const registry = createBuiltinKindRegistry()

function sample(): { document: FormDocument, a: FieldNode, b: FieldNode, grid: ContainerNode, table: ContainerNode } {
  const ids = createIdAllocator('m')
  const a = createNode(registry, 'text', ids, { key: 'a' }) as FieldNode
  const b = createNode(registry, 'text', ids, { key: 'b' }) as FieldNode
  const grid = createNode(registry, 'grid', ids) as ContainerNode
  const table = createNode(registry, 'table', ids) as ContainerNode
  return { document: { ...createDocument(), children: [a, b, grid, table] }, a, b, grid, table }
}

function context(document: FormDocument, selection: MenuContext['selection'], extra: Partial<MenuContext> = {}): MenuContext {
  return { document, registry, selection, readonly: false, canPaste: false, ...extra }
}

function states(entries: readonly MenuEntry[]): Record<string, boolean> {
  return Object.fromEntries(entries.map(entry => [entry.value, entry.disabled]))
}

describe('menuEntries', () => {
  it('选中节点：剪贴板、层级与删除；顶层第一个不能选父级、不能上移，没有剪贴板内容不能粘贴', () => {
    const { document, a } = sample()
    const entries = menuEntries(context(document, { nodes: [a.id] }))
    expect(entries.map(entry => entry.value)).toEqual(['copy', 'cut', 'paste', 'duplicate', 'select-parent', 'move-up', 'move-down', 'delete'])
    expect(states(entries)).toMatchObject({ 'copy': false, 'paste': true, 'select-parent': true, 'move-up': true, 'move-down': false, 'delete': false })
    expect(entries.find(entry => entry.value === 'delete')).toMatchObject({ tone: 'danger', separatorBefore: true })
    expect(states(menuEntries(context(document, { nodes: [a.id] }, { canPaste: true })))).toMatchObject({ paste: false })
  })

  it('只读时只能复制与选父级', () => {
    const { document, grid } = sample()
    const inner = { nodes: [], regions: [grid.regions[0]!.id] }
    expect(states(menuEntries(context(document, { nodes: [grid.id] }, { readonly: true, canPaste: true })))).toMatchObject({ copy: false, cut: true, paste: true, duplicate: true, delete: true })
    expect(states(menuEntries(context(document, inner, { readonly: true })))).toMatchObject({ 'select-parent': false, 'delete': true })
  })

  it('选中栅格的区域：粘贴、选父级、删除，删完少于下限时不能删', () => {
    const { document, grid } = sample()
    const one = menuEntries(context(document, { nodes: [], regions: [grid.regions[0]!.id] }))
    expect(one.map(entry => entry.value)).toEqual(['paste', 'select-parent', 'delete'])
    expect(states(one)).toMatchObject({ delete: false })
    expect(states(menuEntries(context(document, { nodes: [], regions: grid.regions.map(region => region.id) })))).toMatchObject({ delete: true })
  })

  it('表格单元格：合并要拼成矩形，拆分要有跨度，删行删列至少留一行一列', () => {
    const { document, table } = sample()
    const [c00, c01, c10] = table.regions.map(region => region.id)
    const single = menuEntries(context(document, { nodes: [], regions: [c00!] }))
    expect(single.map(entry => entry.value)).toEqual([
      'paste',
      'select-parent',
      'merge-cells',
      'split-cell',
      'insert-row-above',
      'insert-row-below',
      'insert-column-left',
      'insert-column-right',
      'remove-row',
      'remove-column',
    ])
    expect(states(single)).toMatchObject({ 'merge-cells': true, 'split-cell': true, 'insert-row-above': false, 'remove-row': false, 'remove-column': false })
    expect(states(menuEntries(context(document, { nodes: [], regions: [c00!, c01!] })))).toMatchObject({ 'merge-cells': false, 'insert-row-above': true })
    expect(states(menuEntries(context(document, { nodes: [], regions: [c01!, c10!] })))).toMatchObject({ 'merge-cells': true })
  })

  it('什么都没选：只有粘贴', () => {
    const { document } = sample()
    expect(menuEntries(context(document, { nodes: [] }, { canPaste: true }))).toEqual([{ value: 'paste', disabled: false }])
  })
})
