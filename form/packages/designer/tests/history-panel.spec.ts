// @vitest-environment jsdom

import type { FieldNode, FormDocument } from '@xihan-form/core'
import type { HistorySnapshot } from '@xihan-ui/designer-kit'
import type { XhFormDesigner } from '../src'
import { createDocument, createFormModel, createNode, findNode } from '@xihan-form/core'
import { formZhCN } from '@xihan-form/runtime/locale'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { setXhConfig } from '@xihan-ui/web-components'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { afterEach, describe, expect, it } from 'vitest'
import { defineFormDesigner, FORM_DESIGNER_TAG } from '../src'

defineXhElements()
defineFormDesigner()

Element.prototype.scrollIntoView ??= function scrollIntoView() {}

const registry = createFormModel().registry
const mounted: Element[] = []

afterEach(() => {
  for (const element of mounted.splice(0))
    element.remove()
  setXhConfig({})
})

type HistoryPart = HTMLElement & { snapshot?: HistorySnapshot, readonly?: boolean, updateComplete: Promise<unknown> }
type Frame = HTMLElement & { setPanelVisible: (name: string, visible: boolean) => void, showsPanel: (name: string) => boolean, updateComplete: Promise<unknown> }

function sample(): { document: FormDocument, name: FieldNode, age: FieldNode } {
  const ids = createIdAllocator('h')
  const name = createNode(registry, 'text', ids, { key: 'name' }) as FieldNode
  const age = createNode(registry, 'number', ids, { key: 'age' }) as FieldNode
  return { document: { ...createDocument(), children: [name, age] }, name, age }
}

async function settle(designer: XhFormDesigner): Promise<void> {
  await designer.updateComplete
  await designer.querySelector<Frame>('xh-designer-frame')!.updateComplete
  await designer.querySelector<HistoryPart>('xh-designer-history')?.updateComplete
}

async function mount(setup: (designer: XhFormDesigner) => void = () => {}): Promise<XhFormDesigner> {
  const { document } = sample()
  const designer = window.document.createElement(FORM_DESIGNER_TAG)
  designer.schema = document
  setup(designer)
  window.document.body.append(designer)
  mounted.push(designer)
  await settle(designer)
  return designer
}

/** 打开历史记录面板，返回它的零件。 */
async function open(designer: XhFormDesigner): Promise<HistoryPart> {
  designer.querySelector<Frame>('xh-designer-frame')!.setPanelVisible('history', true)
  await settle(designer)
  return designer.querySelector<HistoryPart>('xh-designer-history')!
}

describe('<xh-form-designer>：历史记录面板', () => {
  it('缺省隐藏、打开后在右栏属性下面；面板头是清空历史；列出每一步的说明，当前位置跟着撤销与重做走', async () => {
    const designer = await mount()
    const frame = designer.querySelector<Frame>('xh-designer-frame')!
    expect(frame.showsPanel('history')).toBe(false)
    const { name, age } = sample()
    designer.select({ nodes: [name.id] })
    designer.deleteSelection()
    designer.execute([{ type: 'setProperty', nodeId: age.id, group: 'basic', name: 'label', value: '年龄' }])
    const part = await open(designer)
    expect([part.slot, frame.showsPanel('history')]).toEqual(['history', true])
    expect(designer.querySelector('[slot="history-actions"] button[value="clear-history"]')).not.toBeNull()
    const snapshot = part.snapshot!
    expect(snapshot.entries.map(entry => entry.label)).toEqual(['Delete “Single-line text · name”', 'Change “Label”'])
    expect(snapshot.position).toBe(snapshot.entries[1]!.position)
    designer.undo()
    await settle(designer)
    expect(part.snapshot!.position).toBe(snapshot.entries[0]!.position)
    expect(part.snapshot!.entries.map(entry => entry.state)).toEqual(['done', 'undone'])
  })

  it('选一行跳到那一步：一次跳到、只派发一次 schema-change；只读时只能看、不跳', async () => {
    const designer = await mount()
    const { name, age } = sample()
    const original = designer.schema
    designer.select({ nodes: [name.id] })
    designer.deleteSelection()
    designer.select({ nodes: [age.id] })
    designer.deleteSelection()
    const part = await open(designer)
    const changes: string[] = []
    designer.addEventListener('schema-change', event => changes.push((event as CustomEvent<{ kind: string }>).detail.kind))
    part.dispatchEvent(new CustomEvent('history-go', { detail: { position: part.snapshot!.origin } }))
    expect(designer.schema).toEqual(original)
    expect(changes).toEqual(['undo'])
    designer.readonly = true
    await settle(designer)
    expect(part.readonly).toBe(true)
    part.dispatchEvent(new CustomEvent('history-go', { detail: { position: part.snapshot!.entries[1]!.position } }))
    expect(findNode(designer.schema, age.id)).toBeDefined()
  })

  it('面板标题与步骤说明跟着语言变', async () => {
    const designer = await mount()
    const { name } = sample()
    designer.select({ nodes: [name.id] })
    designer.deleteSelection()
    const part = await open(designer)
    const frame = designer.querySelector<HTMLElement & { panelEntries: () => { name: string, label: string }[] }>('xh-designer-frame')!
    expect(frame.panelEntries().find(entry => entry.name === 'history')!.label).toBe('History')
    setXhConfig(formZhCN)
    await settle(designer)
    expect(frame.panelEntries().find(entry => entry.name === 'history')!.label).toBe('历史记录')
    expect(part.snapshot!.entries[0]!.label).toBe('删除「单行文本 · name」')
  })
})

describe('<xh-form-designer>：元素的历史接口', () => {
  it('historyLimit 在下一次装载时生效：只留最近几步，起点之前丢过步', async () => {
    const designer = await mount((element) => {
      element.historyLimit = 2
    })
    const { name, age } = sample()
    // 每次删一个节点各是一步；mount 时 historyLimit 还没生效，三步都留着
    const removeAll = (): void => {
      for (const id of [name.id, age.id]) {
        designer.select({ nodes: [id] })
        designer.deleteSelection()
      }
      designer.execute([{ type: 'setSetting', name: 'labelPlacement', value: 'start' }])
    }
    removeAll()
    expect([designer.historyState.entries.length, designer.historyState.truncated]).toEqual([3, false])
    designer.schema = sample().document
    removeAll()
    expect([designer.historyState.entries.length, designer.historyState.truncated]).toEqual([2, true])
  })

  it('goToHistory 一次跳到某一步或起点；只读、预览或位置号不认识时返回 false', async () => {
    const designer = await mount()
    const { name, age } = sample()
    const original = designer.schema
    designer.select({ nodes: [name.id] })
    designer.deleteSelection()
    designer.select({ nodes: [age.id] })
    designer.deleteSelection()
    const { origin, entries } = designer.historyState
    expect(designer.goToHistory(-99)).toBe(false)
    designer.readonly = true
    expect(designer.goToHistory(origin)).toBe(false)
    designer.readonly = false
    designer.mode = 'preview'
    expect(designer.goToHistory(origin)).toBe(false)
    designer.mode = 'design'
    expect(designer.goToHistory(origin)).toBe(true)
    expect(designer.schema).toEqual(original)
    expect(designer.historyState.position).toBe(origin)
    expect(designer.goToHistory(entries[1]!.position)).toBe(true)
    expect(findNode(designer.schema, age.id)).toBeUndefined()
  })

  it('clearHistory 清空撤销与重做，模板与是否已保存不变；只读时什么都不做', async () => {
    const designer = await mount()
    const { name } = sample()
    designer.select({ nodes: [name.id] })
    designer.deleteSelection()
    designer.readonly = true
    designer.clearHistory()
    expect(designer.historyState.entries).toHaveLength(1)
    designer.readonly = false
    const before = designer.schema
    designer.clearHistory()
    expect([designer.historyState.entries, designer.canUndo, designer.schema, designer.dirty]).toEqual([[], false, before, true])
  })

  it('history-change 在执行、撤销、跳转、清空、保存与装载之后各派发一次，detail 是此刻的 historyState', async () => {
    const designer = await mount()
    const { name } = sample()
    const seen: HistorySnapshot[] = []
    designer.addEventListener('history-change', event => seen.push((event as CustomEvent<HistorySnapshot>).detail))
    designer.execute([{ type: 'setProperty', nodeId: name.id, group: 'basic', name: 'label', value: '姓名' }])
    designer.undo()
    designer.goToHistory(designer.historyState.entries[0]!.position)
    designer.markSaved()
    designer.clearHistory()
    designer.schema = sample().document
    expect(seen).toHaveLength(6)
    expect(seen.at(-1)).toEqual(designer.historyState)
    expect(seen.map(snapshot => snapshot.entries.length)).toEqual([1, 1, 1, 1, 0, 0])
  })
})
