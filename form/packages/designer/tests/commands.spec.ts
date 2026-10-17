import type { ContainerNode, FieldNode, FormDocument } from '@xihan-form/core'
import type { FormDesignerContext, FormMenuSubject } from '../src'
import type { FormSelection } from '../src/editor'
import type { XhFormDesigner } from '../src/form-designer'
import { createDocument, createFormModel, createNode } from '@xihan-form/core'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS } from '@xihan-form/runtime'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { describe, expect, it } from 'vitest'
import { FORM_COMMANDS, FORM_MENU_LAYOUTS } from '../src'
import { menuSubject } from '../src/commands'
import { provideInternals } from '../src/internals'

const registry = createFormModel().registry

function sample(): { document: FormDocument, a: FieldNode, b: FieldNode, grid: ContainerNode, table: ContainerNode } {
  const ids = createIdAllocator('m')
  const a = createNode(registry, 'text', ids, { key: 'a' }) as FieldNode
  const b = createNode(registry, 'text', ids, { key: 'b' }) as FieldNode
  const grid = createNode(registry, 'grid', ids) as ContainerNode
  const table = createNode(registry, 'table', ids) as ContainerNode
  return { document: { ...createDocument(), children: [a, b, grid, table] }, a, b, grid, table }
}

interface FakeState {
  readonly readonly?: boolean
  readonly canPaste?: boolean
  readonly mode?: 'design' | 'preview'
}

/** 只带命令要读的状态的假设计器。 */
function context(schema: FormDocument, selection: FormSelection, state: FakeState = {}): FormDesignerContext {
  const designer = { schema, getSelection: () => selection, canUndo: false, canRedo: false, canPaste: false, ...state }
  const noop = (): void => {}
  provideInternals(designer, { registry: () => registry, setMode: noop, save: noop, selectParent: noop, moveSelected: noop, mergeCells: noop, splitCell: noop, insertTableLine: noop, removeTableLine: noop })
  return { designer: designer as unknown as XhFormDesigner, translations: DEFAULT_FORM_DESIGNER_TRANSLATIONS }
}

/** 某个菜单主体的缺省排列里，各命令此刻可不可用。 */
function states(subject: FormMenuSubject, ctx: FormDesignerContext): Record<string, boolean> {
  const commands = new Map(FORM_COMMANDS.map(command => [command.id, command]))
  return Object.fromEntries(FORM_MENU_LAYOUTS[subject].flat().map(id => [id, commands.get(id)!.enabled?.(ctx) ?? true]))
}

describe('内置命令与右键菜单', () => {
  it('选中节点：剪贴板、层级与删除；顶层第一个不能选父级、不能上移，没有剪贴板内容不能粘贴', () => {
    const { document, a } = sample()
    expect(menuSubject(document, { nodes: [a.id] })).toBe('node')
    expect(FORM_MENU_LAYOUTS.node).toEqual([['copy', 'cut', 'paste', 'duplicate'], ['select-parent', 'move-up', 'move-down'], ['delete']])
    expect(states('node', context(document, { nodes: [a.id] }))).toMatchObject({ 'copy': true, 'paste': false, 'select-parent': false, 'move-up': false, 'move-down': true, 'delete': true })
    expect(states('node', context(document, { nodes: [a.id] }, { canPaste: true }))).toMatchObject({ paste: true })
  })

  it('只读时只能复制与选父级；预览态不能删除与再制', () => {
    const { document, grid } = sample()
    const inner = { nodes: [], regions: [grid.regions[0]!.id] }
    expect(states('node', context(document, { nodes: [grid.id] }, { readonly: true, canPaste: true }))).toMatchObject({ copy: true, cut: false, paste: false, duplicate: false, delete: false })
    expect(states('region', context(document, inner, { readonly: true }))).toMatchObject({ 'select-parent': true, 'delete': false })
    expect(states('node', context(document, { nodes: [grid.id] }, { mode: 'preview' }))).toMatchObject({ copy: true, duplicate: false, delete: false })
  })

  it('选中栅格的区域：粘贴、选父级、删除，删完少于下限时不能删', () => {
    const { document, grid } = sample()
    expect(menuSubject(document, { nodes: [], regions: [grid.regions[0]!.id] })).toBe('region')
    expect(states('region', context(document, { nodes: [], regions: [grid.regions[0]!.id] }))).toMatchObject({ delete: true })
    expect(states('region', context(document, { nodes: [], regions: grid.regions.map(region => region.id) }))).toMatchObject({ delete: false })
  })

  it('表格单元格：合并要拼成矩形，拆分要有跨度，删行删列至少留一行一列', () => {
    const { document, table } = sample()
    const [c00, c01, c10] = table.regions.map(region => region.id)
    expect(menuSubject(document, { nodes: [], regions: [c00!] })).toBe('cell')
    expect(FORM_MENU_LAYOUTS.cell.flat()).toEqual(['paste', 'select-parent', 'merge-cells', 'split-cell', 'insert-row-above', 'insert-row-below', 'insert-column-left', 'insert-column-right', 'remove-row', 'remove-column'])
    expect(states('cell', context(document, { nodes: [], regions: [c00!] }))).toMatchObject({ 'merge-cells': false, 'split-cell': false, 'insert-row-above': true, 'remove-row': true, 'remove-column': true })
    expect(states('cell', context(document, { nodes: [], regions: [c00!, c01!] }))).toMatchObject({ 'merge-cells': true, 'insert-row-above': false })
    expect(states('cell', context(document, { nodes: [], regions: [c01!, c10!] }))).toMatchObject({ 'merge-cells': false })
  })

  it('什么都没选：只有粘贴', () => {
    const { document } = sample()
    expect(menuSubject(document, { nodes: [] })).toBe('blank')
    expect(states('blank', context(document, { nodes: [] }, { canPaste: true }))).toEqual({ paste: true })
  })
})
