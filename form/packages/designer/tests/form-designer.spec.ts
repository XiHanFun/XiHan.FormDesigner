// @vitest-environment jsdom

import type { ContainerNode, FieldNode, FormDocument } from '@xihan-form/core'
import type { DesignerFrameRegion, XhDesignerPropertiesElement } from '@xihan-ui/designer-shell'
import type { FormDesignerEventMap, FormDesignerExtension, XhFormDesigner } from '../src'
import { BUILTIN_FIELDS, createDocument, createFormModel, createNode, findNode, findRegion } from '@xihan-form/core'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS } from '@xihan-form/runtime'
import { onDiagnostic, setDiagnosticsLevel } from '@xihan-ui/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineFormDesigner, FORM_DESIGNER_HELP_URL, FORM_DESIGNER_TAG } from '../src'

defineXhElements()
defineFormDesigner()

// jsdom 没有 scrollIntoView。
Element.prototype.scrollIntoView ??= function scrollIntoView() {}

const registry = createFormModel().registry
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

  it('挂载、选中表单设置与没有属性的区域时，库内元素不报诊断', async () => {
    const { document, card } = sample()
    const codes: string[] = []
    setDiagnosticsLevel('warn')
    const stop = onDiagnostic(record => codes.push(record.code))
    try {
      const designer = await mount((element) => {
        element.schema = document
      })
      designer.select({ regions: [card.regions[0]!.id] })
      await settle(designer)
      designer.select({ nodes: [] })
      await settle(designer)
      await designer.querySelector('xh-designer-properties')!.updateComplete
    }
    finally {
      stop()
      setDiagnosticsLevel('silent')
    }
    expect(codes.filter(code => code.startsWith('wc.'))).toEqual([])
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

  it('复制、粘贴、创建副本；只读时不能改', async () => {
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

  it('readonly attribute 按三态读：没写与写 "false" 都可修改，空串、"true" 与别的写法只读，移除后回到可修改', async () => {
    const { document } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const frame = designer.querySelector('xh-designer-frame')!
    const states: [string | null, boolean | undefined, boolean][] = [
      [null, undefined, false],
      ['false', false, false],
      ['', true, true],
      ['true', true, true],
      ['readonly', true, true],
      [null, undefined, false],
    ]
    for (const [attribute, property, readonly] of states) {
      if (attribute === null)
        designer.removeAttribute('readonly')
      else
        designer.setAttribute('readonly', attribute)
      await settle(designer)
      expect(designer.readonly, `readonly=${attribute}`).toBe(property)
      expect(frame.hasAttribute('data-readonly'), `readonly=${attribute}`).toBe(readonly)
    }
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

  it('工具栏：内置命令带图标、缺省只显示图标，名字与快捷键写在按钮上，共用命令取 xh-designer-commands 的文案，删除带危险语气', async () => {
    const designer = await mount(() => {})
    const bar = designer.querySelector<HTMLElement>('[data-part="command-bar"]')!
    const button = (value: string): HTMLButtonElement => bar.querySelector<HTMLButtonElement>(`button[value="${value}"]`)!
    expect(bar.querySelector('xh-tooltip')!.getAttribute('data-display')).toBe('icon')
    expect(bar.querySelector('xh-toolbar [data-xh-part="root"]')!.getAttribute('aria-label')).toBe('Designer actions')
    expect(['undo', 'redo', 'delete', 'duplicate', 'design', 'preview', 'width-full', 'width-tablet', 'width-phone'].filter(value => button(value).getAttribute('data-icon') === null)).toEqual([])
    expect([button('undo').getAttribute('aria-label'), button('undo').getAttribute('aria-keyshortcuts')]).toEqual(['Undo', 'Control+Z'])
    expect([button('duplicate').getAttribute('aria-label'), button('width-tablet').getAttribute('aria-label')]).toEqual(['Duplicate', 'Tablet'])
    expect([button('delete').getAttribute('data-tone'), button('undo').getAttribute('data-tone')]).toEqual(['danger', null])
    expect(button('design').getAttribute('aria-pressed')).toBe('true')
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

describe('<xh-form-designer>：面板卡片', () => {
  const T = DEFAULT_FORM_DESIGNER_TRANSLATIONS

  it('物料、属性与问题画成卡片：面板头写标题与帮助，属性的副标题随选中换，三个零件只画内容', async () => {
    const { document, name } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const frame = designer.querySelector('xh-designer-frame')!
    const region = (named: string): DesignerFrameRegion => frame.regions!.find(item => item.name === named)!
    expect(['palette', 'properties', 'issues'].map(named => [region(named).title, region(named).help])).toEqual([[T.palette, T.paletteHelp], [T.properties, T.propertiesHelp], [T.issues, T.issuesHelp]])
    expect([region('toolbar').title, region('toolbar').label, region('canvas').title, region('canvas').label]).toEqual([undefined, 'Designer actions', undefined, T.canvas])
    expect(region('properties').subtitle).toBe(T.settings)
    designer.select({ nodes: [name.id] })
    await settle(designer)
    expect(region('properties').subtitle).toBe(T.nodeTag('text', 'name'))
    expect(frame.querySelector('[data-region="properties"] [data-part="panel-subtitle"]')!.textContent).toBe(T.nodeTag('text', 'name'))
    expect(frame.querySelector('[data-region="properties"] [data-part="panel-body"] > [data-part="inspector-tabs"]')).not.toBeNull()
    expect(['catalog', 'inspector', 'problems'].map(part => designer.querySelector<HTMLElement & { headless?: boolean }>(`[data-part="${part}"]`)!.headless)).toEqual([true, true, true])
  })

  it('工具栏末组是 designer-shell 内置的面板、设置与帮助：设置打开设置对话框，帮助在新窗口打开文档站的设计器一页', async () => {
    const designer = await mount(() => {})
    const button = (value: string): HTMLButtonElement => designer.querySelector<HTMLButtonElement>(`[data-part="command-bar"] button[value="${value}"]`)!
    const groups = Array.from(designer.querySelectorAll('[data-part="command-bar"] [data-xh-part="group"]'), group => Array.from(group.querySelectorAll('button'), item => item.value))
    expect(groups.at(-1)).toEqual(['panels', 'settings', 'help'])
    expect(['panels', 'settings', 'help'].map(value => [button(value).getAttribute('aria-label'), button(value).hasAttribute('data-icon')])).toEqual([['Panels', true], ['Settings', true], ['Help', true]])
    button('settings').click()
    await designer.updateComplete
    expect(designer.querySelector<HTMLElement & { open?: boolean }>('xh-designer-settings')!.open).toBe(true)
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    try {
      button('help').click()
      expect(open).toHaveBeenCalledWith(FORM_DESIGNER_HELP_URL, '_blank', 'noopener,noreferrer')
    }
    finally {
      open.mockRestore()
    }
  })

  it('「面板」点开一张锚在按钮上的菜单，列出物料、属性与问题，勾选的显示；点一项开关它并派发 panels-change', async () => {
    const designer = await mount(() => {})
    const button = designer.querySelector<HTMLButtonElement>('[data-part="command-bar"] button[value="panels"]')!
    button.click()
    await settle(designer)
    type MenuHost = HTMLElement & { open?: boolean, anchor?: HTMLElement | null, collection?: readonly { value: string }[], checkboxValue?: readonly string[] }
    const menu = designer.querySelector<MenuHost>('[data-part="command-bar"] xh-menu')!
    expect([menu.open, menu.anchor]).toEqual([true, button])
    expect(menu.collection!.map(item => item.value)).toEqual(['item:palette', 'item:properties', 'item:issues'])
    expect(menu.checkboxValue).toEqual(['item:palette', 'item:properties', 'item:issues'])
    const changes = events(designer, 'panels-change')
    window.document.querySelector<HTMLElement>('[data-scope="menu"][data-part="item"][data-value="item:palette"]')!.click()
    await settle(designer)
    expect(changes).toEqual([{ panels: designer.panels! }])
    expect(designer.panels!.split(' ')).not.toContain('palette')
    expect(menu.checkboxValue).toEqual(['item:properties', 'item:issues'])
    window.document.querySelector<HTMLElement>('[data-scope="menu"][data-part="item"][data-value="item:palette"]')!.click()
    await settle(designer)
    expect(designer.panels!.split(' ')).toContain('palette')
  })

  it('点面板头的关闭钮：收起这块面板，panels 换成外框剩下的区并派发 panels-change，外框的同名事件不冒出设计器', async () => {
    const designer = await mount(() => {})
    const targets: string[] = []
    window.document.body.addEventListener('panels-change', event => targets.push((event.target as Element).localName))
    const changes = events(designer, 'panels-change')
    designer.querySelector<HTMLButtonElement>('[data-region="palette"] [data-part="panel-close"]')!.click()
    await settle(designer)
    expect(changes).toEqual([{ panels: 'header toolbar properties issues status' }])
    expect(designer.panels).toBe('header toolbar properties issues status')
    expect(targets).toEqual(['xh-form-designer'])
    expect(designer.querySelector('[data-part="frame"] [slot="palette"]')).toBeNull()
    designer.querySelector<HTMLButtonElement>('[data-region="issues"] [data-part="panel-close"]')!.click()
    await settle(designer)
    expect(designer.panels).toBe('header toolbar properties status')
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

  it('错误、警告数在问题卡片的面板头里，零件自己的头部不再画；再给 extensions 赋值两次后仍在文档里', async () => {
    const { document, name } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    designer.execute([{ type: 'setKey', nodeId: name.id, key: '1bad' }])
    await settle(designer)
    const filter = (): HTMLElement => designer.querySelector<HTMLElement>('[data-region="issues"] [data-part="panel-actions"] > [data-part="filter"]')!
    expect(filter().querySelector('button[value="error"]')!.textContent).toBe('1 error')
    expect(designer.querySelector('xh-designer-issues [data-part="filter"]')).toBeNull()
    for (let round = 0; round < 2; round++) {
      designer.extensions = [...(designer.extensions ?? [])]
      await settle(designer)
    }
    expect(filter().isConnected).toBe(true)
    expect(filter().parentElement!.hidden).toBe(false)
    designer.execute([{ type: 'setKey', nodeId: name.id, key: 'name' }])
    await settle(designer)
    expect(filter().querySelector('button[value="error"]')!.textContent).toBe('0 errors')
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
    expect([button('duplicate').getAttribute('aria-label'), button('delete').getAttribute('aria-label'), button('delete').getAttribute('data-tone')]).toEqual(['Duplicate', 'Delete', 'danger'])
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

describe('<xh-form-designer>：栅格跨度', () => {
  it('栅格的区域带跨度把手；拖右缘按列宽改 span，拖动中并成一步撤销', async () => {
    const ids = createIdAllocator('g')
    const grid = createNode(registry, 'grid', ids) as ContainerNode
    const card = createNode(registry, 'card', ids) as ContainerNode
    const designer = await mount((element) => {
      element.schema = { ...createDocument(), children: [grid, card] }
    })
    const region = grid.regions[0]!.id
    const span = (): unknown => findRegion(designer.schema, region)!.region.props.span
    expect(designer.querySelector(`[data-region-id="${card.regions[0]!.id}"] > [data-part="span-handle"]`)).toBeNull()
    const handle = designer.querySelector<HTMLElement>(`[data-region-id="${region}"] > [data-part="span-handle"]`)!
    const body = block(designer, grid.id).querySelector<HTMLElement>(':scope > [data-part="node-body"]')!
    body.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 1200, width: 1200, height: 100, x: 0, y: 0, toJSON: () => ({}) })
    const pointer = (type: string, target: EventTarget, clientX: number): void => {
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 3, isPrimary: true, button: 0, clientX, clientY: 10 }))
    }
    pointer('pointerdown', handle, 600)
    pointer('pointermove', window.document, 760)
    expect(span()).toBe(8)
    pointer('pointermove', window.document, 420)
    expect(span()).toBe(4)
    pointer('pointerup', window.document, 420)
    designer.undo()
    expect(span()).toBe(6)
    expect(designer.canUndo).toBe(false)
  })
})

describe('<xh-form-designer>：右键菜单', () => {
  it('右键先选中节点并派发可取消事件；不取消时按选择列出内建菜单，选中条目执行命令', async () => {
    const { document, name, card } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const menu = designer.querySelector('xh-context-menu') as HTMLElement & { updateComplete: Promise<unknown> }
    const opened = events(designer, 'node-contextmenu')
    const right = (target: Element): MouseEvent => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 20 })
      target.dispatchEvent(event)
      return event
    }
    const native = right(block(designer, name.id).querySelector('[data-part="node-body"]')!)
    expect(native.defaultPrevented).toBe(true)
    expect(designer.getSelection()).toEqual({ nodes: [name.id] })
    expect(opened).toEqual([{ id: name.id, x: 10, y: 20 }])
    await menu.updateComplete
    const items = [...menu.querySelectorAll<HTMLElement>('[data-xh-part="item"]')]
    expect(items.map(item => item.getAttribute('value'))).toEqual(['cut', 'copy', 'paste', 'duplicate', 'select-parent', 'move-up', 'move-down', 'delete'])
    expect(items.every(item => item.querySelector('[data-xh-part="item-icon"] > xh-icon') !== null)).toBe(true)
    expect(items.filter(item => item.getAttribute('aria-disabled') === 'true').map(item => item.getAttribute('value'))).toEqual(['paste', 'select-parent', 'move-up'])
    expect(items.at(-1)!.getAttribute('data-tone')).toBe('danger')
    expect(items.find(item => item.getAttribute('value') === 'duplicate')!.querySelector('[data-xh-part="item-shortcut"]')!.textContent).toBe('Ctrl+D')
    menu.dispatchEvent(new CustomEvent('select', { bubbles: true, detail: { value: 'move-down' } }))
    expect(designer.schema.children.map(node => node.id)).toEqual([card.id, name.id])
  })

  it('宿主取消 node-contextmenu 时不换内建菜单的条目', async () => {
    const { document, name } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    designer.addEventListener('node-contextmenu', event => event.preventDefault())
    block(designer, name.id).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    const menu = designer.querySelector('xh-context-menu') as HTMLElement & { updateComplete: Promise<unknown> }
    await menu.updateComplete
    expect([...menu.querySelectorAll('[data-xh-part="item"]')].map(item => item.getAttribute('value'))).toEqual(['paste'])
  })
})

describe('<xh-form-designer>：规则页签', () => {
  it('单选字段时校验与联动页签可用；从菜单加规则、改参数、删掉；选空白时回到属性页签', async () => {
    const { document, name } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const tabs = designer.querySelector('[data-part="inspector-tabs"]') as HTMLElement & { value?: string }
    const trigger = (tab: string): HTMLButtonElement => tabs.querySelector<HTMLButtonElement>(`button[value="${tab}"]`)!
    const rules = (): unknown[] => [...(findNode(designer.schema, name.id)!.node as FieldNode).validation]
    expect([trigger('validation').disabled, trigger('linkage').disabled]).toEqual([true, true])
    designer.select({ nodes: [name.id] })
    await settle(designer)
    expect([trigger('validation').disabled, trigger('linkage').disabled]).toEqual([false, false])
    tabs.value = 'validation'
    const list = designer.querySelector('[data-part="rule-list"][data-list="validation"]')!
    list.querySelector('xh-menu')!.dispatchEvent(new CustomEvent('select', { bubbles: true, detail: { value: 'length' } }))
    expect(rules()).toEqual([{ id: expect.any(String), kind: 'length' }])
    await settle(designer)
    const panel = list.querySelector('xh-designer-properties[data-part="rule"]') as XhDesignerPropertiesElement
    await panel.updateComplete
    expect(panel.errors!.map(error => error.path)).toEqual([['min']])
    const id = (rules()[0] as { id: string }).id
    panel.dispatchEvent(new CustomEvent('property-change', { bubbles: true, detail: { path: ['min'], value: 2, targets: [{ kind: 'rule', id }], merge: 'min' } }))
    expect(rules()).toEqual([{ id, kind: 'length', min: 2 }])
    panel.querySelector<HTMLButtonElement>('[data-part="rule-remove"] button')!.click()
    expect(rules()).toEqual([])
    designer.select({ nodes: [] })
    await settle(designer)
    expect(tabs.value).toBe('properties')
  })

  it('联动规则的条件与赋值用表达式输入框：输入写回规则，补全列出可引用的名字，编译问题由输入框报出', async () => {
    const { document, name } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    designer.select({ nodes: [name.id] })
    await settle(designer)
    const tabs = designer.querySelector('[data-part="inspector-tabs"]') as HTMLElement & { value?: string }
    tabs.value = 'linkage'
    const list = designer.querySelector('[data-part="rule-list"][data-list="linkage"]')!
    list.querySelector('xh-menu')!.dispatchEvent(new CustomEvent('select', { bubbles: true, detail: { value: 'assign' } }))
    await settle(designer)
    const panel = list.querySelector('xh-designer-properties[data-part="rule"]') as XhDesignerPropertiesElement
    await panel.updateComplete
    type ExpressionInput = HTMLElement & { completions?: (query: { source: string, caret: number, word: string, member: string | null }) => readonly { label: string, description?: string }[], updateComplete: Promise<boolean> }
    const inputs = [...panel.querySelectorAll<ExpressionInput>('xh-expression-input')]
    expect(inputs).toHaveLength(2)
    const [when] = inputs as [ExpressionInput, ExpressionInput]
    await when.updateComplete
    const completions = when.completions!({ source: '', caret: 0, word: '', member: null })
    expect(completions.map(item => item.label)).toEqual(['name', 'age', '$value'])
    expect(completions.find(item => item.label === '$value')!.description).toBe(DEFAULT_FORM_DESIGNER_TRANSLATIONS.variableValue)
    const field = when.querySelector<HTMLInputElement>('[data-part="input"]')!
    field.value = 'name =='
    field.setSelectionRange(7, 7)
    field.dispatchEvent(new Event('input', { bubbles: true }))
    const rule = (): unknown => (findNode(designer.schema, name.id)!.node as FieldNode).linkage[0]
    expect(rule()).toEqual({ id: expect.any(String), action: 'assign', when: 'name ==' })
    await settle(designer)
    expect(tabs.value).toBe('linkage')
    await panel.updateComplete
    expect((panel.errors ?? []).filter(error => error.path[0] === 'when')).toEqual([])
    field.dispatchEvent(new FocusEvent('blur'))
    await when.updateComplete
    expect(when.querySelectorAll('[data-part="issue"]').length).toBeGreaterThan(0)
  })
})

describe('<xh-form-designer>：扩展', () => {
  const text = BUILTIN_FIELDS.find(definition => definition.kind === 'text')!

  function slugExtension(log: string[], extra: Partial<FormDesignerExtension> = {}): FormDesignerExtension {
    return {
      id: '@acme/slug',
      kinds: [{ ...text, category: 'acme', kind: 'slug' }],
      fieldRenderers: { slug: context => ({ element: context.document.createElement('input') }) },
      commands: [{ id: '@acme/slug.ping', label: 'Ping', placement: ['toolbar', 'menu:node'], shortcut: ['Mod', 'Shift', 'P'], run: () => void log.push('ping') }],
      panels: [{ region: { name: 'acme', position: 'end', label: 'Acme' }, create: () => ({ element: window.document.createElement('section'), destroy: () => void log.push('destroy') }) }],
      documentProperties: [{ path: ['theme'], control: { kind: 'text' } }],
      issueText: issue => (issue.code === 'node.unknownKind' ? '种类没装上' : undefined),
      setup: () => {
        log.push('setup')
        return () => void log.push('cleanup')
      },
      ...extra,
    }
  }

  it('扩展的种类进物料，命令进工具栏与快捷键，面板进外框的命名区，表单设置追加在内置之后', async () => {
    const log: string[] = []
    const slug = slugExtension(log)
    const designer = await mount((element) => {
      element.extensions = [slug]
    })
    const catalog = designer.querySelector('xh-designer-palette') as HTMLElement & { groups?: { id: string, items: { id: string }[] }[] }
    expect(catalog.groups!.find(group => group.id === 'acme')!.items.map(item => item.id)).toEqual(['slug'])
    const toolbar = [...designer.querySelectorAll<HTMLButtonElement>('[data-part="command-bar"] button[data-xh-part="item"]')].map(button => button.value)
    expect(toolbar.at(-1)).toBe('@acme/slug.ping')
    const frame = designer.querySelector('xh-designer-frame') as HTMLElement & { regions?: { name: string }[] }
    expect(frame.regions!.at(-1)!.name).toBe('acme')
    expect(designer.querySelector('xh-designer-frame section[slot="acme"]')).not.toBeNull()
    designer.querySelector<HTMLElement>('[data-part="canvas"]')!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true }))
    expect(log).toEqual(['setup', 'ping'])
    const inspector = designer.querySelector('xh-designer-properties[data-part="inspector"]') as XhDesignerPropertiesElement
    await inspector.updateComplete
    expect(inspector.targets![0]!.descriptors.map(descriptor => descriptor.path[0]).at(-1)).toBe('theme')
  })

  it('commandLayout 写了的位置只显示列出的命令', async () => {
    const designer = await mount((element) => {
      element.commandLayout = { toolbar: [['redo', 'undo']] }
    })
    expect([...designer.querySelectorAll<HTMLButtonElement>('[data-part="command-bar"] button[data-xh-part="item"]')].map(button => button.value)).toEqual(['redo', 'undo'])
  })

  it('与内置重名时赋值就抛扩展冲突，extensions 与界面保持原样', async () => {
    const log: string[] = []
    const designer = await mount(() => {})
    const clash = (extension: FormDesignerExtension): unknown => {
      try {
        designer.extensions = [extension]
      }
      catch (error) {
        return error
      }
      return undefined
    }
    expect(clash({ id: 'a', commands: [{ id: 'undo', label: 'x', run: () => {} }] })).toMatchObject({ code: 'designer.extension-conflict', space: 'command', key: 'undo' })
    expect(clash(slugExtension(log, { id: 'b', panels: [{ region: { name: 'palette', position: 'start' }, create: () => ({ element: window.document.createElement('div') }) }] }))).toMatchObject({ space: 'panel', key: 'palette' })
    expect(clash({ id: 'c', kinds: [{ ...text }] })).toMatchObject({ space: 'kind', key: 'text' })
    expect(designer.extensions).toBeUndefined()
    expect(log).toEqual([])
  })

  it('setup 在连上文档时调用、断开时清理；换了引用当作卸下再装上，面板随之撤掉', async () => {
    const log: string[] = []
    const designer = await mount((element) => {
      element.extensions = [slugExtension(log)]
    })
    designer.extensions = [slugExtension(log)]
    expect(log).toEqual(['setup', 'destroy', 'cleanup', 'setup'])
    designer.remove()
    expect(log.at(-1)).toBe('cleanup')
  })

  it('去掉扩展时模板里它的种类照样保留，画布画成占位、问题报 node.unknownKind；再装上就恢复', async () => {
    const log: string[] = []
    const slug = slugExtension(log)
    const node = createNode(createFormModel([slug]).registry, 'slug', createIdAllocator('u'), { key: 'path' })
    const designer = await mount((element) => {
      element.extensions = [slug]
      element.schema = { ...createDocument(), children: [node] }
    })
    expect(designer.validate()).toEqual([])
    designer.extensions = []
    await settle(designer)
    expect(findNode(designer.schema, node.id)).toBeDefined()
    expect(block(designer, node.id).querySelector('[data-part="node-placeholder"]')).not.toBeNull()
    expect(designer.validate().map(issue => issue.code)).toEqual(['node.unknownKind'])
    designer.extensions = [slug]
    await settle(designer)
    expect(block(designer, node.id).querySelector('[data-part="node-placeholder"]')).toBeNull()
    expect(designer.validate()).toEqual([])
  })

  it('问题列表的说明先取扩展的 issueText', async () => {
    const log: string[] = []
    const slug = slugExtension(log)
    const node = createNode(createFormModel([slug]).registry, 'slug', createIdAllocator('u'), { key: 'path' })
    const keeper: FormDesignerExtension = { id: '@acme/keeper', issueText: slug.issueText }
    const designer = await mount((element) => {
      element.extensions = [keeper]
      element.schema = { ...createDocument(), children: [node] }
    })
    const problems = designer.querySelector('xh-designer-issues') as HTMLElement & { items?: { message: string }[] }
    expect(problems.items!.map(item => item.message)).toEqual(['种类没装上'])
  })
})
