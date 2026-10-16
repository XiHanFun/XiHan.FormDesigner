// @vitest-environment jsdom

import type { ContainerNode, FieldNode, FormDocument } from '@xihan-form/core'
import type { XhDesignerPropertiesElement } from '@xihan-ui/designer-shell'
import type { FormDesignerEventMap, XhFormDesigner } from '../src'
import { createBuiltinKindRegistry, createDocument, createNode, findNode } from '@xihan-form/core'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS } from '@xihan-form/runtime'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineFormDesigner, FORM_DESIGNER_TAG } from '../src'

defineXhElements()
defineFormDesigner()

// jsdom 没有 scrollIntoView。
Element.prototype.scrollIntoView ??= function scrollIntoView() {}

// jsdom 不排版：多行文本框自动增高要读的计算样式与内容高度给出浏览器里的缺省值
const STYLE_FALLBACK: Readonly<Record<string, string>> = {
  'writing-mode': 'horizontal-tb',
  'box-sizing': 'border-box',
  'max-block-size': 'none',
  'padding-top': '0px',
  'padding-bottom': '0px',
  'border-top-width': '0px',
  'border-bottom-width': '0px',
  'font-size': '14px',
  'line-height': '20px',
}

beforeEach(() => {
  const real = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => new Proxy(real(element, pseudo), {
    get(target, key) {
      if (key === 'getPropertyValue')
        return (name: string) => target.getPropertyValue(name) || STYLE_FALLBACK[name] || ''
      const value = Reflect.get(target, key) as unknown
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value
    },
  }))
  vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(20)
})

const registry = createBuiltinKindRegistry()
const mounted: Element[] = []

afterEach(() => {
  for (const element of mounted.splice(0))
    element.remove()
  vi.restoreAllMocks()
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
  await settle(designer)
  return designer
}

/** 等设计器与外框都更新完。 */
async function settle(designer: XhFormDesigner): Promise<void> {
  await designer.updateComplete
  await designer.querySelector('xh-designer-frame')!.updateComplete
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
  it('panels 经外框收起面板，画布常驻；预览态只留工具栏', async () => {
    const designer = await mount((element) => {
      element.panels = 'toolbar properties'
    })
    const shown = (): string[] => ['toolbar', 'palette', 'canvas', 'properties', 'issues'].filter(name => designer.querySelector(`[data-part="frame"] [slot="${name}"]`) !== null)
    expect(shown()).toEqual(['toolbar', 'canvas', 'properties'])
    designer.mode = 'preview'
    await settle(designer)
    expect(shown()).toEqual(['toolbar', 'canvas'])
    designer.mode = 'design'
    designer.panels = undefined
    await settle(designer)
    expect(shown()).toEqual(['toolbar', 'palette', 'canvas', 'properties', 'issues'])
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

describe('<xh-form-designer>：属性面板', () => {
  function inspector(designer: XhFormDesigner): XhDesignerPropertiesElement {
    return designer.querySelector('xh-designer-properties')!
  }

  async function pick(designer: XhFormDesigner, selection: Parameters<XhFormDesigner['select']>[0]): Promise<void> {
    designer.select(selection)
    await settle(designer)
    await inspector(designer).updateComplete
  }

  it('编辑对象随选择换：表单设置、节点、区域', async () => {
    const { document, name, card } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const panel = inspector(designer)
    expect(panel.targets!.map(target => target.kind)).toEqual(['settings'])
    expect(panel.heading).toBe(DEFAULT_FORM_DESIGNER_TRANSLATIONS.settings)
    await pick(designer, { nodes: [name.id] })
    expect(panel.targets!.map(target => target.id)).toEqual([name.id])
    expect(panel.querySelector('[data-path="key"]')).not.toBeNull()
    expect(panel.querySelector('[data-path="basic.label"]')).not.toBeNull()
    await pick(designer, { regions: [card.regions[0]!.id] })
    expect(panel.targets!.map(target => target.kind)).toEqual(['region'])
  })

  it('同一合并键的写入并成一步，property-commit 后另起一步；面板事件不冒出设计器', async () => {
    const { document, name } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    await pick(designer, { nodes: [name.id] })
    const panel = inspector(designer)
    const outside: Event[] = []
    window.document.body.addEventListener('property-change', event => outside.push(event))
    const change = (value: string): void => {
      panel.dispatchEvent(new CustomEvent('property-change', { bubbles: true, detail: { path: ['basic', 'label'], value, targets: [{ kind: 'text', id: name.id }], merge: 'label' } }))
    }
    const label = (): unknown => findNode(designer.schema, name.id)!.node.basic.label
    change('a')
    change('ab')
    expect(label()).toBe('ab')
    panel.dispatchEvent(new CustomEvent('property-commit', { bubbles: true, detail: { path: ['basic', 'label'] } }))
    change('abc')
    designer.undo()
    expect(label()).toBe('ab')
    designer.undo()
    expect(label()).toBe(name.basic.label)
    expect(outside).toHaveLength(0)
  })

  it('在字段里输入，模板跟着改', async () => {
    const { document, name } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    await pick(designer, { nodes: [name.id] })
    const input = inspector(designer).querySelector<HTMLInputElement>('[data-path="key"] input')!
    input.value = 'fullName'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect((findNode(designer.schema, name.id)!.node as FieldNode).key).toBe('fullName')
  })

  it('问题落到字段上；只读时面板只读、写入不生效', async () => {
    const { document, name } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    await pick(designer, { nodes: [name.id] })
    designer.execute([{ type: 'setKey', nodeId: name.id, key: '1bad' }])
    await settle(designer)
    const panel = inspector(designer)
    expect(panel.errors).toEqual([{ target: { kind: 'text', id: name.id }, path: ['key'], message: expect.any(String) }])
    designer.readonly = true
    await settle(designer)
    expect(panel.readonly).toBe(true)
    panel.dispatchEvent(new CustomEvent('property-change', { bubbles: true, detail: { path: ['key'], value: 'ok', targets: [{ kind: 'text', id: name.id }], merge: 'key' } }))
    expect((findNode(designer.schema, name.id)!.node as FieldNode).key).toBe('1bad')
  })
})

describe('<xh-form-designer>：物料面板', () => {
  it('物料按分类列出；点按物料新建到缺省位置并选中，只读时点了没反应', async () => {
    const { document, name } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const catalog = designer.querySelector('xh-designer-palette')!
    await catalog.updateComplete
    expect(catalog.groups!.map(group => group.id)).toContain('input')
    designer.select({ nodes: [name.id] })
    catalog.querySelector<HTMLButtonElement>('button[data-part="item"][data-id="switch"]')!.click()
    const added = designer.getSelection().nodes[0]!
    expect(findNode(designer.schema, added)).toMatchObject({ node: { kind: 'switch' }, region: null, index: 1 })
    designer.readonly = true
    await settle(designer)
    catalog.querySelector<HTMLButtonElement>('button[data-part="item"][data-id="switch"]')!.click()
    expect(designer.schema.children).toHaveLength(3)
  })
})

describe('<xh-form-designer>：问题列表', () => {
  it('问题列进问题面板；点开一条选中所在节点并把焦点交给对应字段', async () => {
    const { document, name } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    designer.execute([{ type: 'setKey', nodeId: name.id, key: '1bad' }])
    await settle(designer)
    const problems = designer.querySelector('xh-designer-issues')!
    expect(problems.items!.map(item => [item.issue.code, item.subject])).toEqual([['invalid-value', DEFAULT_FORM_DESIGNER_TRANSLATIONS.nodeTag('text', '1bad')]])
    problems.dispatchEvent(new CustomEvent('issue-activate', { bubbles: true, detail: { issue: problems.items![0]!.issue, index: 0 } }))
    expect(designer.getSelection()).toEqual({ nodes: [name.id] })
    await settle(designer)
    await designer.querySelector('xh-designer-properties')!.updateComplete
    await new Promise(resolve => setTimeout(resolve))
    expect(window.document.activeElement?.closest('[data-path]')?.getAttribute('data-path')).toBe('key')
  })

  it('规则里的表达式按 expressionEngine 检查', async () => {
    const { document, name } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    designer.execute([{ type: 'insertRule', nodeId: name.id, list: 'linkage', index: 0, rule: { id: 'r1', action: 'hide', when: 'name +' } }])
    expect(designer.validate().map(issue => issue.code)).toContain('expression.invalid')
  })
})

describe('<xh-form-designer>：节点小工具条', () => {
  it('只选中一个节点时挂进它的外框，按它在同层的位置启用按钮；点按钮执行后不丢选择', async () => {
    const { document, name, card, inner } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const toolbar = (): HTMLElement | null => designer.querySelector<HTMLElement>('[data-part="node-toolbar"]')
    const button = (action: string): HTMLButtonElement => toolbar()!.querySelector<HTMLButtonElement>(`button[value="${action}"]`)!
    const disabled = (): boolean[] => ['parent', 'up', 'down', 'duplicate', 'delete'].map(action => button(action).disabled)
    expect(toolbar()).toBeNull()
    designer.select({ nodes: [name.id] })
    await settle(designer)
    expect(toolbar()!.parentElement).toBe(block(designer, name.id))
    expect(disabled()).toEqual([true, true, false, false, false])
    expect(button('down').getAttribute('aria-label')).toBe(DEFAULT_FORM_DESIGNER_TRANSLATIONS.moveDown)
    button('down').click()
    await settle(designer)
    expect(designer.schema.children.map(node => node.id)).toEqual([card.id, name.id])
    expect(designer.getSelection().nodes).toEqual([name.id])
    expect(toolbar()!.parentElement).toBe(block(designer, name.id))
    designer.select({ nodes: [inner.id] })
    await settle(designer)
    button('parent').click()
    expect(designer.getSelection().nodes).toEqual([card.id])
    designer.select({ nodes: [name.id, card.id] })
    await settle(designer)
    expect(toolbar()).toBeNull()
    designer.select({ nodes: [name.id] })
    designer.readonly = true
    await settle(designer)
    expect(toolbar()).toBeNull()
  })
})
