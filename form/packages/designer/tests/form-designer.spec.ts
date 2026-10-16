// @vitest-environment jsdom

import type { ContainerNode, FieldNode, FormDocument } from '@xihan-form/core'
import type { FormDesignerEventMap, XhFormDesigner } from '../src'
import { createBuiltinKindRegistry, createDocument, createNode, findNode } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { afterEach, describe, expect, it } from 'vitest'
import { defineFormDesigner, FORM_DESIGNER_TAG } from '../src'

defineXhElements()
defineFormDesigner()

// jsdom 没有 scrollIntoView。
Element.prototype.scrollIntoView ??= function scrollIntoView() {}

const registry = createBuiltinKindRegistry()
const mounted: Element[] = []

afterEach(() => {
  for (const element of mounted.splice(0))
    element.remove()
})

function sample(): { document: FormDocument, name: FieldNode, card: ContainerNode, inner: FieldNode } {
  const ids = createIdAllocator('s')
  const name = createNode(registry, 'text', ids, { key: 'name' }) as FieldNode
  const inner = createNode(registry, 'number', ids, { key: 'age' }) as FieldNode
  const card = createNode(registry, 'card', ids) as ContainerNode
  const filled: ContainerNode = { ...card, regions: [{ ...card.regions[0]!, children: [inner] }] }
  return { document: { ...createDocument(), children: [name, filled] }, name, card: filled, inner }
}

async function mount(setup: (designer: XhFormDesigner) => void): Promise<XhFormDesigner> {
  const designer = window.document.createElement(FORM_DESIGNER_TAG)
  setup(designer)
  window.document.body.append(designer)
  mounted.push(designer)
  await designer.updateComplete
  return designer
}

function events<K extends keyof FormDesignerEventMap>(target: EventTarget, type: K): FormDesignerEventMap[K]['detail'][] {
  const out: FormDesignerEventMap[K]['detail'][] = []
  target.addEventListener(type, event => out.push((event as FormDesignerEventMap[K]).detail))
  return out
}

function block(designer: XhFormDesigner, id: string): HTMLElement {
  return designer.querySelector<HTMLElement>(`[data-part="node"][data-node-id="${id}"]`)!
}

describe('<xh-form-designer>：装载与画布', () => {
  it('装载模板：画布为每个节点画一块外框，字段用渲染器的字段外壳，容器的区域是放置区', async () => {
    const { document, name, card, inner } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    expect(block(designer, name.id).querySelector('xh-field xh-text-field')).not.toBeNull()
    expect(block(designer, card.id).querySelector(`[data-part="region"][data-region-id="${card.regions[0]!.id}"]`)).not.toBeNull()
    expect(block(designer, inner.id).closest('[data-part="region"]')!.getAttribute('data-region-id')).toBe(card.regions[0]!.id)
    expect((block(designer, name.id).querySelector('xh-field') as HTMLElement).inert).toBe(true)
  })

  it('赋回当前这一份不重新装载；新模板清空历史', async () => {
    const { document, name } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const changes = events(designer, 'schema-change')
    designer.execute([{ type: 'setProperty', nodeId: name.id, group: 'basic', name: 'label', value: '姓名' }])
    const current = designer.schema
    designer.schema = current
    expect(designer.canUndo).toBe(true)
    designer.schema = createDocument()
    expect(designer.canUndo).toBe(false)
    expect(changes.map(change => change.kind)).toEqual(['execute', 'load'])
  })

  it('点选节点与区域空白处，选中标记落到画布上；Shift 追加；点空白清空', async () => {
    const { document, name, card } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const selections = events(designer, 'selection-change')
    block(designer, name.id).querySelector('[data-part="node-body"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(designer.getSelection()).toEqual({ nodes: [name.id] })
    expect(block(designer, name.id).hasAttribute('data-selected')).toBe(true)
    block(designer, card.id).dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    expect(designer.getSelection().nodes).toEqual([name.id, card.id])
    const region = designer.querySelector<HTMLElement>(`[data-region-id="${card.regions[0]!.id}"]`)!
    region.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(designer.getSelection()).toEqual({ nodes: [], regions: [card.regions[0]!.id] })
    expect(region.hasAttribute('data-selected')).toBe(true)
    designer.querySelector('[data-part="surface"] form')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(designer.getSelection()).toEqual({ nodes: [] })
    expect(selections).toHaveLength(4)
  })
})

describe('<xh-form-designer>：编辑', () => {
  it('新建节点后画布重排；撤销重做；dirty 与 markSaved', async () => {
    const designer = await mount(() => {})
    const dirty = events(designer, 'dirty-change')
    const added = designer.addNode('switch')!
    await designer.updateComplete
    expect(block(designer, added.id)).not.toBeNull()
    expect(designer.dirty).toBe(true)
    designer.markSaved()
    expect(designer.dirty).toBe(false)
    designer.undo()
    await designer.updateComplete
    expect(designer.querySelector(`[data-node-id="${added.id}"]`)).toBeNull()
    expect(dirty.map(item => item.dirty)).toEqual([true, false, true])
  })

  it('键盘：Delete 删除，Alt+↓ 下移，↑ 选上一个，Esc 选上一级再清空，Ctrl+Z 撤销', async () => {
    const { document, name, card, inner } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const canvas = designer.querySelector<HTMLElement>('[data-part="canvas"]')!
    const key = (init: KeyboardEventInit): void => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
    }
    designer.select({ nodes: [name.id] })
    key({ key: 'ArrowDown', altKey: true })
    expect(designer.schema.children.map(node => node.id)).toEqual([card.id, name.id])
    key({ key: 'ArrowUp' })
    expect(designer.getSelection().nodes).toEqual([card.id])
    designer.select({ nodes: [inner.id] })
    key({ key: 'Escape' })
    expect(designer.getSelection().nodes).toEqual([card.id])
    key({ key: 'Escape' })
    expect(designer.getSelection().nodes).toEqual([])
    designer.select({ nodes: [inner.id] })
    key({ key: 'Delete' })
    expect(findNode(designer.schema, inner.id)).toBeUndefined()
    key({ key: 'z', ctrlKey: true })
    expect(findNode(designer.schema, inner.id)).toBeDefined()
  })

  it('复制、粘贴、再制；只读时不能改', async () => {
    const { document, name } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    designer.select({ nodes: [name.id] })
    expect(designer.canPaste).toBe(false)
    designer.copy()
    expect(designer.canPaste).toBe(true)
    expect(designer.paste().nodes).toHaveLength(1)
    expect(designer.duplicate().nodes).toHaveLength(1)
    expect(designer.schema.children).toHaveLength(4)
    designer.readonly = true
    expect(designer.addNode('text')).toBeUndefined()
    expect(designer.paste()).toEqual({ nodes: [] })
    expect(designer.deleteSelection()).toBe(false)
  })

  it('问题变了才派发 issues-change；validate 返回同形的问题', async () => {
    const { document, name } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const issues = events(designer, 'issues-change')
    designer.execute([{ type: 'setKey', nodeId: name.id, key: '1bad' }])
    designer.execute([{ type: 'setProperty', nodeId: name.id, group: 'basic', name: 'label', value: 'x' }])
    expect(issues).toHaveLength(1)
    expect(designer.validate().map(issue => issue.code)).toEqual(['invalid-value'])
  })
})

describe('<xh-form-designer>：面板与模式', () => {
  it('panels 只控制可收起的面板，画布常驻', async () => {
    const designer = await mount((element) => {
      element.panels = 'toolbar'
    })
    const part = (name: string): HTMLElement => designer.querySelector<HTMLElement>(`[data-part="${name}"]`)!
    expect([part('toolbar').hidden, part('palette').hidden, part('properties').hidden, part('issues').hidden, part('canvas').hidden]).toEqual([false, true, true, true, false])
  })

  it('切到预览态时画布换成渲染器，派发 mode-change', async () => {
    const { document } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const modes = events(designer, 'mode-change')
    designer.querySelector<HTMLButtonElement>('button[value="preview"]')!.click()
    await designer.updateComplete
    const preview = designer.querySelector('[data-part="canvas"] > xh-form-renderer') as HTMLElement & { schema?: unknown }
    expect(preview).not.toBeNull()
    expect(preview.schema).toBe(designer.schema)
    expect(modes).toEqual([{ mode: 'preview' }])
  })
})
