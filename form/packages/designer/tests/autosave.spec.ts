// @vitest-environment jsdom

import type { FormDocument } from '@xihan-form/core'
import type { XhFormDesigner } from '../src'
import { createDocument, createFormModel, createNode } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { DESIGNER_COMMANDS_EN_US } from '@xihan-ui/designer-shell'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineFormDesigner, FORM_DESIGNER_TAG } from '../src'

defineXhElements()
defineFormDesigner()

Element.prototype.scrollIntoView ??= function scrollIntoView() {}

const registry = createFormModel().registry
const mounted: Element[] = []
const KEY = 'xh-designer-draft:xh-form-designer:f1'

afterEach(() => {
  vi.useRealTimers()
  for (const element of mounted.splice(0))
    element.remove()
  localStorage.clear()
  document.body.replaceChildren()
})

function sample(): FormDocument {
  return { ...createDocument(), children: [createNode(registry, 'text', createIdAllocator('a'), { key: 'name' })] }
}

/** 草稿：比 sample 多一个数字字段。 */
function withDraft(): FormDocument {
  const base = sample()
  return { ...base, children: [...base.children, createNode(registry, 'number', createIdAllocator('b'), { key: 'age' })] }
}

async function mount(setup: (designer: XhFormDesigner) => void = () => {}): Promise<XhFormDesigner> {
  const designer = window.document.createElement(FORM_DESIGNER_TAG)
  designer.autoTour = false
  designer.draftKey = 'f1'
  designer.schema = sample()
  setup(designer)
  window.document.body.append(designer)
  mounted.push(designer)
  await designer.updateComplete
  return designer
}

async function until<T>(read: () => T | null | undefined): Promise<T> {
  for (let round = 0; round < 100; round++) {
    const value = read()
    if (value)
      return value
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('等了 1 秒仍没到期望的状态')
}

function button(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === text)
}

describe('<xh-form-designer>：自动保存', () => {
  it('开着时改了停手约一秒存成草稿，键是设计器种类加 draftKey；markSaved 后草稿删掉；关着时不存', async () => {
    const designer = await mount(element => (element.settings = { 'general.autoSave': true }))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    designer.addNode('text')
    vi.advanceTimersByTime(999)
    expect(localStorage.getItem(KEY)).toBeNull()
    vi.advanceTimersByTime(1)
    expect((JSON.parse(localStorage.getItem(KEY)!) as { document: FormDocument }).document).toEqual(designer.schema)
    designer.markSaved()
    expect(localStorage.getItem(KEY)).toBeNull()
    designer.settings = {}
    await designer.updateComplete
    designer.addNode('text')
    vi.advanceTimersByTime(1000)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('宿主装进同一个键、和草稿不一样的模板时问「发现未保存的草稿」：恢复后模板换成草稿、记一步撤销，说明是「恢复」', async () => {
    localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), document: withDraft() }))
    const designer = await mount()
    const restore = await until(() => button(DESIGNER_COMMANDS_EN_US.draftRestore))
    expect(document.body.textContent).toContain(DESIGNER_COMMANDS_EN_US.draftFoundDescription)
    restore.click()
    await until(() => designer.schema.children.length === 2)
    expect([designer.schema.children.map(node => node.kind), designer.canUndo, designer.historyState.entries.at(-1)?.label]).toEqual([['text', 'number'], true, DESIGNER_COMMANDS_EN_US.draftRestore])
  })

  it('选丢弃：草稿删掉，模板照旧；草稿和装进的一样时不问、悄悄删掉；只读时不问、草稿留着', async () => {
    localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), document: withDraft() }))
    const designer = await mount()
    ;(await until(() => button(DESIGNER_COMMANDS_EN_US.draftDiscard))).click()
    await until(() => localStorage.getItem(KEY) === null)
    expect(designer.schema.children.map(node => node.kind)).toEqual(['text'])
    designer.remove()
    localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), document: sample() }))
    await mount()
    await until(() => localStorage.getItem(KEY) === null)
    expect(button(DESIGNER_COMMANDS_EN_US.draftRestore)).toBeUndefined()
    localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), document: withDraft() }))
    await mount(element => (element.readonly = true))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect([button(DESIGNER_COMMANDS_EN_US.draftRestore), localStorage.getItem(KEY) !== null]).toEqual([undefined, true])
  })
})
