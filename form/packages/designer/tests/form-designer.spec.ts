// @vitest-environment jsdom

import type { ContainerNode, FieldNode, FormDocument } from '@xihan-form/core'
import type { XhFormRenderer } from '@xihan-form/runtime'
import type { DesignerFrameRegion, XhDesignerPropertiesElement } from '@xihan-ui/designer-shell'
import type { FormDesignerEventMap, FormDesignerExtension, XhFormDesigner } from '../src'
import { BUILTIN_FIELDS, createDocument, createFormModel, createNode, findNode, findRegion } from '@xihan-form/core'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS } from '@xihan-form/runtime'
import { formZhCN } from '@xihan-form/runtime/locale'
import { onDiagnostic, setDiagnosticsLevel } from '@xihan-ui/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { DESIGNER_SETTING_KEYS } from '@xihan-ui/designer-shell'
import { setXhConfig } from '@xihan-ui/web-components'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFormDesignerModel, defineFormDesigner, FORM_DESIGNER_HELP_URL, FORM_DESIGNER_PANELS, FORM_DESIGNER_TAG } from '../src'

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
  // 新手引导会把焦点拿走，这里的用例不要它自动开始
  designer.autoTour = false
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
  it('工具栏上撤销、重做的全名带上下一步的说明，跟着设计器的语言变；只读时 undo() 不撤', async () => {
    const { document, name } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const button = (value: string): HTMLButtonElement => designer.querySelector<HTMLButtonElement>(`[data-part="command-bar"] button[value="${value}"]`)!
    designer.select({ nodes: [name.id] })
    designer.deleteSelection()
    await settle(designer)
    expect(button('undo').getAttribute('aria-label')).toBe('Undo: Delete “Single-line text · name”')
    setXhConfig(formZhCN)
    try {
      await settle(designer)
      expect(button('undo').getAttribute('aria-label')).toContain('删除「单行文本 · name」')
    }
    finally {
      setXhConfig({})
    }
    designer.readonly = true
    expect(designer.undo()).toBe(false)
    designer.readonly = false
    expect(designer.undo()).toBe(true)
    await settle(designer)
    expect(button('redo').getAttribute('aria-label')).toBe('Redo: Delete “Single-line text · name”')
  })

  it('只是选择变了时不重排画布：切到第二页的标签页停在那一页；换语言才重排', async () => {
    const tabs = createNode(registry, 'tabs', createIdAllocator('t')) as ContainerNode
    const designer = await mount((element) => {
      element.schema = { ...createDocument(), children: [tabs] }
    })
    const host = (): HTMLElement & { value?: unknown } => designer.querySelector<HTMLElement & { value?: unknown }>(`[data-node-id="${tabs.id}"] xh-tabs`)!
    const first = host()
    first.value = tabs.regions[1]!.id
    designer.select({ regions: [tabs.regions[1]!.id] })
    await settle(designer)
    expect([host() === first, host().value]).toEqual([true, tabs.regions[1]!.id])
    setXhConfig(formZhCN)
    try {
      await settle(designer)
      expect(host() === first).toBe(false)
    }
    finally {
      setXhConfig({})
    }
  })

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

  it('键盘：Delete 删除，Alt+↓ 下移，↑ 选上一个，Esc 选上一级再清空，Ctrl+Z 撤销，Ctrl+Y 重做', async () => {
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
    key({ key: 'y', ctrlKey: true })
    expect(findNode(designer.schema, inner.id)).toBeUndefined()
    expect(designer.canRedo).toBe(false)
  })

  it('连续按 Alt + ↑ ↓ 挪同一个节点并成一步撤销；换了选择另起一步', async () => {
    const { document, name, card } = sample()
    const extra = createNode(registry, 'switch', createIdAllocator('x'), { key: 'agree' })
    const designer = await mount((element) => {
      element.schema = { ...document, children: [...document.children, extra] }
    })
    const canvas = designer.querySelector<HTMLElement>('[data-part="canvas"]')!
    const nudge = (key: 'ArrowUp' | 'ArrowDown'): void => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, altKey: true }))
    }
    const order = (): string[] => designer.schema.children.map(node => node.id)
    designer.select({ nodes: [name.id] })
    nudge('ArrowDown')
    nudge('ArrowDown')
    expect(order()).toEqual([card.id, extra.id, name.id])
    designer.undo()
    expect(order()).toEqual([name.id, card.id, extra.id])
    expect(designer.canUndo).toBe(false)
    nudge('ArrowDown')
    designer.select({ nodes: [card.id] })
    designer.select({ nodes: [name.id] })
    nudge('ArrowDown')
    expect(order()).toEqual([card.id, extra.id, name.id])
    designer.undo()
    expect(order()).toEqual([card.id, name.id, extra.id])
    designer.undo()
    expect(order()).toEqual([name.id, card.id, extra.id])
  })

  it('快捷键在整个设计器里认：焦点在物料、属性面板时 Ctrl+Z / Ctrl+D 照样生效，单键不抢；文字输入里与组件已处理过的键不接', async () => {
    const { document, name, inner } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const key = (target: Element, init: KeyboardEventInit): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
      target.dispatchEvent(event)
      return event
    }
    const palette = designer.querySelector('[data-part="catalog"]')!
    const item = palette.querySelector<HTMLElement>('[data-scope="designer-palette"][data-part="item"]') ?? palette
    const search = palette.querySelector('input')!
    designer.select({ nodes: [inner.id] })
    designer.deleteSelection()
    expect(findNode(designer.schema, inner.id)).toBeUndefined()
    expect(key(search, { key: 'z', ctrlKey: true }).defaultPrevented).toBe(false)
    expect(findNode(designer.schema, inner.id)).toBeUndefined()
    expect(key(item, { key: 'z', ctrlKey: true }).defaultPrevented).toBe(true)
    expect(findNode(designer.schema, inner.id)).toBeDefined()
    designer.select({ nodes: [name.id] })
    const inspector = designer.querySelector('[data-part="inspector-tabs"]')!
    key(inspector, { key: 'd', ctrlKey: true })
    expect(designer.schema.children).toHaveLength(3)
    key(item, { key: 'Delete' })
    key(inspector, { key: 'ArrowDown', altKey: true })
    expect(designer.schema.children).toHaveLength(3)
    const handled = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })
    handled.preventDefault()
    item.dispatchEvent(handled)
    expect(designer.canRedo).toBe(false)
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
  it('defaultLayout 给缺省的显隐，画布常驻；预览态不显示面板，不动布局', async () => {
    const designer = await mount((element) => {
      element.defaultLayout = { version: 1, hidden: [FORM_DESIGNER_PANELS.palette, FORM_DESIGNER_PANELS.issues] }
    })
    const frame = designer.querySelector('xh-designer-frame')!
    const shown = (): string[] => ['menubar', 'toolbar', 'palette', 'canvas', 'properties', 'issues', 'status'].filter(name => frame.showsPanel(name))
    expect(shown()).toEqual(['menubar', 'toolbar', 'canvas', 'properties', 'status'])
    const changes = events(designer, 'settings-change')
    designer.mode = 'preview'
    await settle(designer)
    expect(shown()).toEqual(['menubar', 'toolbar', 'canvas', 'status'])
    designer.mode = 'design'
    await settle(designer)
    expect(shown()).toEqual(['menubar', 'toolbar', 'canvas', 'properties', 'status'])
    designer.defaultLayout = undefined
    await settle(designer)
    expect(shown()).toEqual(['menubar', 'toolbar', 'palette', 'canvas', 'properties', 'issues', 'status'])
    expect(changes).toEqual([])
  })

  it('面板登记带图标与缺省的栏：物料与页面结构在左栏（页面结构在物料下面）、属性在右栏、问题在下栏', async () => {
    const designer = await mount(() => {})
    const frame = designer.querySelector('xh-designer-frame')!
    const entries = frame.panelEntries()
    expect(entries.map(entry => [entry.name, entry.dock, entry.icon !== undefined])).toEqual([
      ['palette', 'start', true],
      ['properties', 'end', true],
      ['issues', 'bottom', true],
      ['outline', 'start', true],
      ['history', 'end', true],
    ])
    expect(frame.resolvedLayout.docks).toMatchObject({ start: ['palette', 'outline'], end: ['properties', 'history'], bottom: ['issues'] })
    expect(entries.find(entry => entry.name === 'history')!.shown).toBe(false)
    expect(entries.find(entry => entry.name === 'outline')!.label).toBe('Structure')
  })

  it('工具栏：内置命令带图标、缺省只显示图标，名字与快捷键写在按钮上，共用命令取 xh-designer-commands 的文案，删除带危险语气', async () => {
    const designer = await mount(() => {})
    const bar = designer.querySelector<HTMLElement>('[data-part="command-bar"]')!
    const button = (value: string): HTMLButtonElement => bar.querySelector<HTMLButtonElement>(`button[value="${value}"]`)!
    expect(bar.querySelector('xh-tooltip')!.getAttribute('data-display')).toBe('icon')
    expect(bar.querySelector('xh-toolbar [data-xh-part="root"]')!.getAttribute('aria-label')).toBe('Designer actions')
    expect(['undo', 'redo', 'delete', 'duplicate', 'design', 'preview', 'width-full', 'width-tablet', 'width-phone'].filter(value => button(value).getAttribute('data-icon') === null)).toEqual([])
    expect([button('undo').getAttribute('aria-label'), button('undo').getAttribute('aria-keyshortcuts')]).toEqual(['Undo', 'Control+Z'])
    expect(button('redo').getAttribute('aria-keyshortcuts')).toBe('Control+Shift+Z Control+Y')
    expect([button('duplicate').getAttribute('aria-label'), button('width-tablet').getAttribute('aria-label')]).toEqual(['Duplicate', 'Tablet'])
    expect([button('delete').getAttribute('data-tone'), button('undo').getAttribute('data-tone')]).toEqual(['danger', null])
    expect(button('design').getAttribute('aria-pressed')).toBe('true')
  })

  it('预览里的文件字段用设计器的 uploadFile 上传，返回的附件记录写进预览数据；换了函数预览跟着换', async () => {
    const ids = createIdAllocator('u')
    const files = createNode(registry, 'file', ids, { key: 'files' }) as FieldNode
    const names: string[] = []
    const designer = await mount((element) => {
      element.schema = { ...createDocument(), children: [files] }
      element.uploadFile = (request) => {
        names.push(request.file.name)
        return Promise.resolve({ id: 'r1' })
      }
      element.mode = 'preview'
    })
    const preview = designer.querySelector('[data-part="canvas"] > xh-form-renderer') as XhFormRenderer
    await preview.updateComplete
    expect(preview.uploadFile).toBe(designer.uploadFile)
    const upload = preview.querySelector('xh-file-upload') as HTMLElement & { addFiles: (files: File[]) => void, updateComplete: Promise<boolean> }
    await upload.updateComplete
    upload.addFiles([new File(['abc'], 'a.pdf', { type: 'application/pdf' })])
    await vi.waitFor(() => expect(preview.getFormData().files).toEqual([{ id: 'r1', name: 'a.pdf', size: 3, type: 'application/pdf' }]))
    expect(names).toEqual(['a.pdf'])
    const next = (): undefined => undefined
    designer.uploadFile = next
    await designer.updateComplete
    expect(preview.uploadFile).toBe(next)
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

  it('状态栏：左段写选中的字段种类与字段名，区域写所在容器，多选写个数，没选中写字段数；右段写预览宽度，点了回到全宽', async () => {
    const { document, name, card, inner } = sample()
    const designer = await mount((element) => {
      element.schema = document
      element.previewWidth = 'tablet'
    })
    const frame = designer.querySelector('xh-designer-frame')!
    const zone = (named: string): string[] => Array.from(frame.querySelectorAll(`[data-region="status"] [data-zone="${named}"] [data-part="status-item"]`), item => Array.from(item.querySelectorAll('[data-part="status-label"]:not([hidden]), [data-part="status-value"]'), part => part.textContent).join('|'))
    expect([zone('start'), zone('end')]).toEqual([['2 fields'], ['Preview width|Tablet']])
    designer.select({ nodes: [name.id] })
    await settle(designer)
    expect(zone('start')).toEqual([`${T.kind('text')}|name`])
    designer.select({ nodes: [], regions: [card.regions[0]!.id] })
    await settle(designer)
    expect(zone('start')).toEqual([`${T.group('region')}|${T.kind('card')}`])
    designer.select({ nodes: [name.id, inner.id] })
    await settle(designer)
    expect(zone('start')).toEqual(['2 selected'])
    frame.querySelector<HTMLButtonElement>('[data-region="status"] [data-zone="end"] button')!.click()
    await settle(designer)
    expect([designer.previewWidth, zone('end')]).toEqual(['full', ['Preview width|Full']])
    designer.mode = 'preview'
    await settle(designer)
    expect(['menubar', 'toolbar', 'palette', 'canvas', 'properties', 'issues', 'status'].filter(region => frame.showsPanel(region))).toEqual(['menubar', 'toolbar', 'canvas', 'status'])
  })

  it('外框没有顶栏，命令表里没有插入命令：物料只从物料面板拖进来或点一下加进来', async () => {
    const designer = await mount(() => {})
    const frame = designer.querySelector('xh-designer-frame')!
    expect(frame.querySelector('[data-region="header"]')).toBeNull()
    expect([...createFormDesignerModel([]).commands.keys()].filter(id => id.startsWith('insert:'))).toEqual([])
    designer.mode = 'preview'
    await settle(designer)
    expect(['menubar', 'toolbar', 'palette', 'canvas', 'properties', 'issues', 'status'].filter(region => frame.showsPanel(region))).toEqual(['menubar', 'toolbar', 'canvas', 'status'])
  })

  it('工具栏末组只留面板，设置与帮助只在菜单栏里（菜单栏常开，设置里写 toolbar.menubar 也不起作用）：设置打开设置对话框，帮助在新窗口打开文档站的设计器一页', async () => {
    const designer = await mount(() => {})
    const button = (value: string): HTMLButtonElement => designer.querySelector<HTMLButtonElement>(`[data-part="command-bar"] button[value="${value}"]`)!
    const groups = (): string[][] => Array.from(designer.querySelectorAll('[data-part="command-bar"] [data-xh-part="group"]'), group => Array.from(group.querySelectorAll('button'), item => item.value))
    const select = (menu: string, id: string): void => void designer.querySelector('xh-menubar')!.dispatchEvent(new CustomEvent('item-select', { detail: { menu, value: `${menu}/${id}` } }))
    expect(groups().at(-1)).toEqual(['panels'])
    expect([button('panels').getAttribute('aria-label'), button('panels').hasAttribute('data-icon')]).toEqual(['Panels', true])
    designer.settings = { 'toolbar.menubar': false }
    await settle(designer)
    expect([groups().at(-1), designer.querySelector('xh-designer-frame')!.regions!.some(region => region.name === 'menubar')]).toEqual([['panels'], true])
    select('file', 'settings')
    await designer.updateComplete
    expect(designer.querySelector<HTMLElement & { open?: boolean }>('xh-designer-settings')!.open).toBe(true)
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    try {
      select('help', 'help')
      expect(open).toHaveBeenCalledWith(FORM_DESIGNER_HELP_URL, '_blank', 'noopener,noreferrer')
    }
    finally {
      open.mockRestore()
    }
  })

  it('「面板」点开一张锚在按钮上的菜单，列出物料、属性、问题与页面结构，勾选的显示；点一项开关它，布局写进设置并派发 settings-change', async () => {
    const designer = await mount(() => {})
    const button = designer.querySelector<HTMLButtonElement>('[data-part="command-bar"] button[value="panels"]')!
    button.click()
    await settle(designer)
    type MenuHost = HTMLElement & { open?: boolean, anchor?: HTMLElement | null, collection?: readonly { value: string }[], checkboxValue?: readonly string[] }
    const menu = designer.querySelector<MenuHost>('[data-part="command-bar"] xh-menu')!
    expect([menu.open, menu.anchor]).toEqual([true, button])
    expect(menu.collection!.map(item => item.value).filter(value => value.startsWith('item:'))).toEqual(['item:palette', 'item:properties', 'item:issues', 'item:outline', 'item:history'])
    expect(menu.checkboxValue).toEqual(['item:palette', 'item:properties', 'item:issues', 'item:outline'])
    const changes = events(designer, 'settings-change')
    const hidden = (): readonly string[] | undefined => (designer.settings?.[DESIGNER_SETTING_KEYS.layout] as { hidden?: readonly string[] } | undefined)?.hidden
    window.document.querySelector<HTMLElement>('[data-scope="menu"][data-part="item"][data-value="item:palette"]')!.click()
    await settle(designer)
    expect(changes.map(change => change.key)).toEqual([DESIGNER_SETTING_KEYS.layout])
    expect(changes[0]!.settings).toBe(designer.settings)
    expect(hidden()).toEqual(['history', 'palette'])
    expect(menu.checkboxValue).toEqual(['item:properties', 'item:issues', 'item:outline'])
    window.document.querySelector<HTMLElement>('[data-scope="menu"][data-part="item"][data-value="item:palette"]')!.click()
    await settle(designer)
    expect(hidden()).toEqual(['history'])
  })

  it('每块面板一条开关命令 panel:<面板 id>，可以排进工具栏；扩展的面板也有', async () => {
    const designer = await mount((element) => {
      element.commandLayout = { toolbar: [['panel:issues', 'panel:acme']] }
      element.extensions = [{ id: '@acme/panel', panels: [{ region: { name: 'acme', position: 'end', title: 'Acme' }, create: () => ({ element: window.document.createElement('section') }) }] }]
    })
    const frame = designer.querySelector('xh-designer-frame')!
    const button = (value: string): HTMLButtonElement => designer.querySelector<HTMLButtonElement>(`[data-part="command-bar"] button[value="${value}"]`)!
    expect([button('panel:issues').getAttribute('aria-label'), button('panel:issues').getAttribute('aria-pressed')]).toEqual([DEFAULT_FORM_DESIGNER_TRANSLATIONS.issues, 'true'])
    expect(button('panel:acme').getAttribute('aria-label')).toBe('Acme')
    button('panel:issues').click()
    await settle(designer)
    expect(frame.showsPanel('issues')).toBe(false)
    expect(button('panel:issues').getAttribute('aria-pressed')).toBe('false')
  })

  it('settingsPolicy 管布局：layout.panels.<面板 id> 藏掉一块面板，layout.panels 锁定整份', async () => {
    const designer = await mount((element) => {
      element.settingsPolicy = { 'layout.panels.issues': 'hidden' }
    })
    const frame = designer.querySelector('xh-designer-frame')!
    expect(frame.showsPanel('issues')).toBe(false)
    expect(frame.panelEntries().map(entry => entry.name)).toEqual(['palette', 'properties', 'outline', 'history'])
    expect(designer.querySelector<HTMLButtonElement>('[data-region="palette"] [data-part="panel-close"]')!.hidden).toBe(false)
    designer.settingsPolicy = { 'layout.panels': 'locked' }
    await settle(designer)
    expect(frame.showsPanel('issues')).toBe(true)
    expect(designer.querySelector<HTMLButtonElement>('[data-region="palette"] [data-part="panel-close"]')!.hidden).toBe(true)
  })

  it('点面板头的关闭钮：隐藏这块面板，整份布局写进设置的 layout.panels 并派发 settings-change，外框的 layout-change 不冒出设计器', async () => {
    const designer = await mount(() => {})
    const frame = designer.querySelector('xh-designer-frame')!
    const bubbled: string[] = []
    window.document.body.addEventListener('layout-change', event => bubbled.push((event.target as Element).localName))
    const changes = events(designer, 'settings-change')
    designer.querySelector<HTMLButtonElement>('[data-region="palette"] [data-part="panel-close"]')!.click()
    await settle(designer)
    expect(changes.map(change => change.key)).toEqual([DESIGNER_SETTING_KEYS.layout])
    expect(changes[0]!.value).toEqual(frame.resolvedLayout)
    expect(frame.showsPanel('palette')).toBe(false)
    expect(bubbled).toEqual([])
    designer.querySelector<HTMLButtonElement>('[data-region="issues"] [data-part="panel-close"]')!.click()
    await settle(designer)
    const saved = designer.settings!
    expect(saved[DESIGNER_SETTING_KEYS.layout]).toMatchObject({ hidden: ['history', 'palette', 'issues'] })
    const again = await mount((element) => {
      element.settings = saved
    })
    const restored = again.querySelector('xh-designer-frame')!
    expect(['palette', 'properties', 'issues', 'history'].filter(name => restored.showsPanel(name))).toEqual(['properties'])
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

  it('选项是一张选项表；第 3 项的值出错时，错误标在第 3 行值那一格的控件上，名字与 aria-invalid 也落在那里', async () => {
    const ids = createIdAllocator('o')
    const select = createNode(registry, 'select', ids, { key: 'city' }) as FieldNode
    const options = [{ value: 'bj', label: '北京' }, { value: 'sh', label: '上海' }, { value: '', label: '广州' }]
    const filled: FieldNode = { ...select, data: { ...select.data, options } }
    const designer = await mount((element) => {
      element.schema = { ...createDocument(), children: [filled] }
    })
    await pick(designer, { nodes: [select.id] })
    const panel = inspector(designer)
    const row = panel.querySelector<HTMLElement>('[data-path="data.options"]')!
    expect(row.querySelector('[data-control="unsupported"]')).toBeNull()
    const table = row.querySelector<HTMLElement & { items: readonly { key: string }[], updateComplete: Promise<unknown> }>('xh-field-array')!
    await table.updateComplete
    expect(panel.errors).toContainEqual({ target: { kind: 'select', id: select.id }, path: ['data', 'options', 2, 'value'], message: expect.any(String) })
    const cell = (index: number, column: string): HTMLElement => table.querySelector<HTMLElement>(`[slot="item-cell:${table.items[index]!.key}:${column}"]`)!
    const input = (index: number): HTMLInputElement => cell(index, 'value').querySelector('input')!
    await (cell(2, 'value') as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
    expect(cell(2, 'value').querySelector('xh-text-field')!.getAttribute('aria-label')).toBe('Value, option 3')
    expect(input(2).getAttribute('aria-invalid')).toBe('true')
    const described = (input(2).getAttribute('aria-describedby') ?? '').split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ')
    expect(described).toContain(panel.errors!.find(error => error.path.at(-1) === 'value')!.message)
    expect([input(0), input(1)].map(item => item.getAttribute('aria-invalid'))).not.toContain('true')
  })

  it('列最小宽度只在子表里的字段上列出', async () => {
    const ids = createIdAllocator('w')
    const loose = createNode(registry, 'number', ids, { key: 'loose' }) as FieldNode
    const cell = createNode(registry, 'number', ids, { key: 'cell' }) as FieldNode
    const table = createNode(registry, 'subtable', ids, { key: 'rows' }) as ContainerNode
    const filled: ContainerNode = { ...table, regions: [{ ...table.regions[0]!, children: [cell] }] }
    const designer = await mount((element) => {
      element.schema = { ...createDocument(), children: [loose, filled] }
    })
    const paths = async (id: string): Promise<string[]> => {
      designer.select({ nodes: [id] })
      await settle(designer)
      const inspector = designer.querySelector('xh-designer-properties[data-part="inspector"]') as XhDesignerPropertiesElement
      return inspector.targets![0]!.descriptors.map(descriptor => descriptor.path.join('.'))
    }
    expect(await paths(loose.id)).not.toContain('appearance.columnMinWidth')
    expect(await paths(cell.id)).toContain('appearance.columnMinWidth')
  })

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
  it('物料是简单分组：每组一行组名，下面直接列出条目，全部展开、不能折叠；搜索框留着', async () => {
    const designer = await mount(() => {})
    const catalog = designer.querySelector('xh-designer-palette')!
    await catalog.updateComplete
    expect(catalog.querySelector('xh-accordion')).toBeNull()
    expect(catalog.querySelector<HTMLElement>('[data-part="search"]')!.hidden).toBe(false)
    const sections = [...catalog.querySelectorAll<HTMLElement>('[data-part="group"]')]
    expect(sections.map(section => section.querySelector('[data-part="group-label"]')!.textContent)).toEqual(catalog.groups!.map(group => group.label))
    for (const [index, section] of sections.entries()) {
      expect([...section.querySelectorAll<HTMLButtonElement>('button[data-part="item"]')].map(button => button.dataset.id)).toEqual(catalog.groups![index]!.items.map(item => item.id))
      for (let element: HTMLElement | null = section; element && element !== catalog; element = element.parentElement)
        expect(element.hidden).toBe(false)
    }
  })

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
    // JSON 编辑框里另有一份问题列表，自己画头部；这里只看问题面板那一份
    expect(designer.querySelector('xh-designer-issues[data-part="problems"]')).not.toBeNull()
    expect(designer.querySelector('xh-designer-issues[data-part="problems"] [data-part="filter"]')).toBeNull()
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

describe('<xh-form-designer>：选中工具条', () => {
  const ORDER = ['select-parent', 'move-up', 'move-down', 'duplicate', 'delete']

  function toolbarOf(designer: XhFormDesigner): HTMLElement | null {
    return designer.querySelector<HTMLElement>('[data-part="node-toolbar"]')
  }

  function buttonOf(designer: XhFormDesigner, id: string): HTMLButtonElement {
    return toolbarOf(designer)!.querySelector<HTMLButtonElement>(`button[value="${id}"]`)!
  }

  it('只选中一个节点时挂进它的外框，命令按 selection:node 的缺省排列、按它在同层的位置启用；点了执行后不丢选择，焦点回到画布', async () => {
    const { document, name, card, inner } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const disabled = (): boolean[] => ORDER.map(id => buttonOf(designer, id).disabled)
    expect(toolbarOf(designer)).toBeNull()
    designer.select({ nodes: [name.id] })
    await settle(designer)
    expect(toolbarOf(designer)!.parentElement).toBe(block(designer, name.id))
    expect(Array.from(toolbarOf(designer)!.querySelectorAll<HTMLButtonElement>('button[value]'), button => button.value)).toEqual(ORDER)
    expect(disabled()).toEqual([true, true, false, false, false])
    expect(toolbarOf(designer)!.querySelector('xh-toolbar [data-xh-part="root"]')!.getAttribute('aria-label')).toBe('Single-line text · name')
    expect(buttonOf(designer, 'move-down').getAttribute('aria-label')).toBe(DEFAULT_FORM_DESIGNER_TRANSLATIONS.moveDown)
    expect([buttonOf(designer, 'duplicate').getAttribute('aria-label'), buttonOf(designer, 'delete').getAttribute('aria-label'), buttonOf(designer, 'delete').getAttribute('data-tone')]).toEqual(['Duplicate', 'Delete', 'danger'])
    buttonOf(designer, 'move-down').click()
    await settle(designer)
    expect(designer.schema.children.map(node => node.id)).toEqual([card.id, name.id])
    expect(designer.getSelection().nodes).toEqual([name.id])
    expect(toolbarOf(designer)!.parentElement).toBe(block(designer, name.id))
    expect(window.document.activeElement).toBe(designer.querySelector('[data-part="canvas"]'))
    designer.select({ nodes: [inner.id] })
    await settle(designer)
    buttonOf(designer, 'select-parent').click()
    expect(designer.getSelection().nodes).toEqual([card.id])
    designer.select({ nodes: [name.id, card.id] })
    await settle(designer)
    expect(toolbarOf(designer)).toBeNull()
    designer.select({ nodes: [name.id] })
    designer.readonly = true
    await settle(designer)
    expect(toolbarOf(designer)).toBeNull()
  })

  it('在工具条的钮上按下、松开再点：命令执行，选中不丢，工具条还在原节点上', async () => {
    const { document, name, card } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    designer.select({ nodes: [name.id] })
    await settle(designer)
    const button = buttonOf(designer, 'move-down')
    const init = { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'mouse', isPrimary: true, button: 0, clientX: 10, clientY: 10 }
    button.dispatchEvent(new PointerEvent('pointerdown', { ...init, buttons: 1 }))
    button.dispatchEvent(new MouseEvent('mousedown', { ...init, buttons: 1 }))
    await settle(designer)
    expect(designer.getSelection().nodes).toEqual([name.id])
    expect(toolbarOf(designer)!.contains(button)).toBe(true)
    button.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }))
    button.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }))
    button.dispatchEvent(new MouseEvent('click', { ...init, buttons: 0 }))
    await settle(designer)
    expect(designer.schema.children.map(node => node.id)).toEqual([card.id, name.id])
    expect(designer.getSelection().nodes).toEqual([name.id])
    expect(toolbarOf(designer)!.parentElement).toBe(block(designer, name.id))
  })

  it('焦点在画布里按 Alt+F10：焦点移到选中工具条；没有选中工具条时什么都不做', async () => {
    const { document, name } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const canvas = designer.querySelector<HTMLElement>('[data-part="canvas"]')!
    const press = (): boolean => canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', altKey: true, bubbles: true, cancelable: true }))
    canvas.focus()
    expect(press()).toBe(true)
    expect(window.document.activeElement).toBe(canvas)
    designer.select({ nodes: [name.id] })
    await settle(designer)
    canvas.focus()
    expect(press()).toBe(false)
    expect(toolbarOf(designer)!.contains(window.document.activeElement)).toBe(true)
    expect(window.document.activeElement?.localName).toBe('button')
  })

  it('宿主经 commandLayout 改 selection:node 的排列，写空就没有工具条；扩展命令写上这个落点就追加成一组', async () => {
    const { document, name } = sample()
    const pinged: string[] = []
    const designer = await mount((element) => {
      element.schema = document
      element.commandLayout = { 'selection:node': [['delete']] }
    })
    designer.select({ nodes: [name.id] })
    await settle(designer)
    const values = (): string[] => Array.from(toolbarOf(designer)!.querySelectorAll<HTMLButtonElement>('button[value]'), button => button.value)
    expect(values()).toEqual(['delete'])
    designer.commandLayout = { 'selection:node': [] }
    await settle(designer)
    expect(toolbarOf(designer)).toBeNull()
    designer.commandLayout = undefined
    designer.extensions = [{ id: '@acme/ping', commands: [{ id: '@acme/ping.node', label: 'Ping', placement: ['selection:node'], run: ({ designer: owner }) => void pinged.push(owner.getSelection().nodes.join()) }] }]
    await settle(designer)
    expect(values()).toEqual([...ORDER, '@acme/ping.node'])
    buttonOf(designer, '@acme/ping.node').click()
    expect(pinged).toEqual([name.id])
  })

  it('伸出画布内容区的行首边时往行尾挪回来，挪的量写进 --xh-form-node-toolbar-shift；伸不出时不写', async () => {
    const { document, name, card } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    const box = (left: number, width: number): DOMRect => ({ top: 0, bottom: 28, left, right: left + width, width, height: 28, x: left, y: 0, toJSON: () => ({}) })
    const canvas = designer.querySelector<HTMLElement>('[data-part="canvas"]')!
    canvas.getBoundingClientRect = () => box(100, 300)
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 300 })
    designer.select({ nodes: [name.id] })
    await settle(designer)
    const toolbar = toolbarOf(designer)!
    let left = 80
    toolbar.getBoundingClientRect = () => box(left, 150)
    designer.select({ nodes: [card.id] })
    await settle(designer)
    expect(toolbar.style.getPropertyValue('--xh-form-node-toolbar-shift')).toBe('20px')
    left = 120
    designer.select({ nodes: [name.id] })
    await settle(designer)
    expect(toolbar.style.getPropertyValue('--xh-form-node-toolbar-shift')).toBe('')
  })
})

describe('<xh-form-designer>：栅格跨度', () => {
  /** 一个栅格（首列带跨度把手，正文宽 1200px）与一张卡片。 */
  async function spanSetup() {
    const ids = createIdAllocator('g')
    const grid = createNode(registry, 'grid', ids) as ContainerNode
    const card = createNode(registry, 'card', ids) as ContainerNode
    const designer = await mount((element) => {
      element.schema = { ...createDocument(), children: [grid, card] }
    })
    const region = grid.regions[0]!.id
    const handle = designer.querySelector<HTMLElement>(`[data-region-id="${region}"] > [data-part="span-handle"]`)!
    const body = block(designer, grid.id).querySelector<HTMLElement>(':scope > [data-part="node-body"]')!
    body.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 1200, width: 1200, height: 100, x: 0, y: 0, toJSON: () => ({}) })
    const pointer = (type: string, target: EventTarget, clientX: number): void => {
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 3, isPrimary: true, button: 0, clientX, clientY: 10 }))
    }
    const span = (): unknown => findRegion(designer.schema, region)!.region.props.span
    return { designer, grid, card, region, handle, pointer, span }
  }

  it('栅格的区域带跨度把手；拖右缘按列宽改 span，按下到松手是一步撤销，松手时派发一次 schema-change', async () => {
    const { designer, card, region, handle, pointer, span } = await spanSetup()
    expect(designer.querySelector(`[data-region-id="${card.regions[0]!.id}"] > [data-part="span-handle"]`)).toBeNull()
    const changes = events(designer, 'schema-change')
    pointer('pointerdown', handle, 600)
    pointer('pointermove', window.document, 760)
    expect(span()).toBe(8)
    expect(designer.undo()).toBe(false)
    pointer('pointermove', window.document, 420)
    expect(span()).toBe(4)
    expect(changes).toEqual([])
    pointer('pointerup', window.document, 420)
    expect(changes.map(change => [change.kind, change.operations])).toEqual([['execute', [
      { type: 'setRegionProperty', regionId: region, name: 'span', value: 8 },
      { type: 'setRegionProperty', regionId: region, name: 'span', value: 4 },
    ]]])
    designer.undo()
    expect(span()).toBe(6)
    expect(designer.canUndo).toBe(false)
  })

  it('拖跨度时按 Esc 取消：跨度回到按下时，不留步、不派发 schema-change，也不当作选上一级', async () => {
    const { designer, grid, handle, pointer, span } = await spanSetup()
    designer.select({ nodes: [grid.id] })
    const changes = events(designer, 'schema-change')
    pointer('pointerdown', handle, 600)
    pointer('pointermove', window.document, 760)
    expect(span()).toBe(8)
    const canvas = designer.querySelector<HTMLElement>('[data-part="canvas"]')!
    const escape = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })
    canvas.dispatchEvent(escape)
    expect(escape.defaultPrevented).toBe(true)
    expect(span()).toBe(6)
    expect(designer.getSelection().nodes).toEqual([grid.id])
    expect(canvas.hasAttribute('data-resizing')).toBe(false)
    pointer('pointermove', window.document, 900)
    pointer('pointerup', window.document, 900)
    expect(span()).toBe(6)
    expect(designer.canUndo).toBe(false)
    expect(designer.dirty).toBe(false)
    expect(changes).toEqual([])
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
    menu.dispatchEvent(new CustomEvent('item-select', { bubbles: true, detail: { value: 'move-down' } }))
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

describe('<xh-form-designer>：菜单栏', () => {
  /** 菜单栏的 <xh-menubar>：按数据铺的菜单与勾选。 */
  interface MenubarNode { value: string, label?: string, kind?: string, items?: MenubarNode[], children?: MenubarNode[], checkboxValue?: string[] }
  type MenubarHost = HTMLElement & { collection?: MenubarNode[], checkboxValue?: string[] }

  function menubarOf(designer: XhFormDesigner): MenubarHost {
    return designer.querySelector<MenubarHost>('xh-menubar')!
  }

  function items(designer: XhFormDesigner, menu: string): string[] {
    return menubarOf(designer).collection!.find(node => node.value === menu)!.items!.map(item => item.value.slice(menu.length + 1))
  }

  function select(designer: XhFormDesigner, menu: string, id: string): void {
    menubarOf(designer).dispatchEvent(new CustomEvent('item-select', { detail: { menu, value: `${menu}/${id}` } }))
  }

  function regionNames(designer: XhFormDesigner): string[] {
    return designer.querySelector('xh-designer-frame')!.regions!.map(region => region.name)
  }

  it('外框最上一条是菜单栏（开发者模式开着）：文件、编辑、视图、帮助四张；保存与设置在文件里，预览宽度跟在拖动后面、面板与外观收尾，工具栏、状态栏两条显示开关在外观子菜单里；勾上的是此刻的模式、宽度、面板与显示开关', async () => {
    const designer = await mount((element) => {
      element.settings = { 'general.developer': true }
    })
    const menubar = menubarOf(designer)
    expect(menubar.closest('[data-region]')!.getAttribute('data-region')).toBe('menubar')
    expect(regionNames(designer)[0]).toBe('menubar')
    expect(menubar.collection!.map(node => [node.value, node.label])).toEqual([['file', 'File'], ['edit', 'Edit'], ['view', 'View'], ['help', 'Help']])
    expect(items(designer, 'file')).toEqual(['save', 'settings'])
    expect(items(designer, 'edit')).toEqual(['undo', 'redo', 'cut', 'copy', 'paste', 'delete', 'duplicate', 'select-all', 'edit-json'])
    expect(items(designer, 'view')).toEqual(['design', 'preview', 'pan-tool', 'width-full', 'width-tablet', 'width-phone', 'panels', 'appearance'])
    expect(items(designer, 'help')).toEqual(['start-tour', 'help', 'shortcuts', 'about'])
    expect(menubar.checkboxValue).toEqual(['view/design', 'view/width-full'])
    const view = menubar.collection!.find(node => node.value === 'view')!.items!
    const panels = view.find(item => item.value === 'view/panels')!
    expect(panels.checkboxValue).toEqual(['view/panels/item:palette', 'view/panels/item:properties', 'view/panels/item:issues', 'view/panels/item:outline'])
    const appearance = view.find(item => item.value === 'view/appearance')!
    const toggles = ['show-toolbar', 'show-status-bar'].map(id => `view/appearance/command:${id}`)
    expect([appearance.children!.map(child => [child.value, child.kind]), appearance.checkboxValue]).toEqual([toggles.map(value => [value, 'checkbox']), toggles])
  })

  it('开发者模式关着时没有编辑 JSON：编辑菜单、空白处右键菜单里都没有，Ctrl / ⌘ + Shift + J 不打开；打开开发者模式后都有', async () => {
    const designer = await mount(() => {})
    const editor = designer.querySelector<HTMLElement & { open?: boolean }>('xh-designer-json-editor')!
    const canvas = designer.querySelector<HTMLElement>('[data-part="canvas"]')!
    const press = (): void => void canvas.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'J', code: 'KeyJ', ctrlKey: true, shiftKey: true }))
    const menu = designer.querySelector('xh-context-menu') as HTMLElement & { updateComplete: Promise<unknown> }
    // 菜单打开后内容搬进浮层，先记住内容那一块
    const content = menu.querySelector<HTMLElement>('[data-xh-part="content"]')!
    const blank = async (): Promise<(string | null)[]> => {
      canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
      await menu.updateComplete
      return [...content.querySelectorAll('[data-xh-part="item"]')].map(item => item.getAttribute('value'))
    }
    expect([items(designer, 'edit').includes('edit-json'), await blank()]).toEqual([false, ['paste']])
    press()
    expect(editor.open).not.toBe(true)
    designer.settings = { 'general.developer': true }
    await settle(designer)
    expect([items(designer, 'edit').at(-1), await blank()]).toEqual(['edit-json', ['paste', 'edit-json']])
    press()
    expect(editor.open).toBe(true)
  })

  it('保存是外壳的 save 命令：文件菜单里点它、画布上按 Ctrl+S 都派发 save；快捷键写在条目上', async () => {
    const designer = await mount(() => {})
    const saves = events(designer, 'save')
    select(designer, 'file', 'save')
    expect(saves).toHaveLength(1)
    const canvas = designer.querySelector<HTMLElement>('[data-part="canvas"]')!
    const press = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 's', code: 'KeyS', ctrlKey: true })
    canvas.dispatchEvent(press)
    expect([saves.length, press.defaultPrevented]).toEqual([2, true])
    const save = createFormDesignerModel([]).commands.get('save')!
    expect([save.placement, save.shortcut]).toEqual([['menubar:file'], ['Mod', 'S']])
    const node = menubarOf(designer).collection!.find(item => item.value === 'file')!.items!.find(item => item.value === 'file/save') as { shortcut?: string }
    expect(node.shortcut).toBeTruthy()
  })

  it('视图菜单切预览宽度与模式；预览态外框照样登记菜单栏，能从「视图」切回设计', async () => {
    const designer = await mount(() => {})
    select(designer, 'view', 'width-phone')
    await settle(designer)
    expect([designer.previewWidth, menubarOf(designer).checkboxValue!.includes('view/width-phone')]).toEqual(['phone', true])
    select(designer, 'view', 'preview')
    await settle(designer)
    expect(designer.mode).toBe('preview')
    expect(regionNames(designer)).toContain('menubar')
    select(designer, 'view', 'design')
    await settle(designer)
    expect(designer.mode).toBe('design')
  })

  it('显示开关改设置并派发 settings-change：关掉状态栏外框不登记它；菜单栏常开，没有它的开关', async () => {
    const designer = await mount(() => {})
    const changes = events(designer, 'settings-change')
    select(designer, 'view', 'appearance/command:show-status-bar')
    await settle(designer)
    expect([changes.map(change => [change.key, change.value]), regionNames(designer).includes('status')]).toEqual([[['general.statusBar', false]], false])
    expect([createFormDesignerModel([]).commands.has('show-menubar'), regionNames(designer).includes('menubar')]).toEqual([false, true])
  })

  it('宿主写在设计器上的三处：menubar-center 在菜单栏正中、menubar-end 在菜单栏右边、status-end 在状态栏右段，连上文档前写的、后来加的都一样', async () => {
    const host = (slot: string, text: string): HTMLElement => {
      const element = window.document.createElement('span')
      element.slot = slot
      element.textContent = text
      return element
    }
    const title = host('menubar-center', '报销单 · EXP-01')
    const extra = host('menubar-end', '只读')
    const saved = host('status-end', '已保存')
    const designer = await mount(element => element.append(title, extra, saved))
    await settle(designer)
    const place = (element: Element): (string | null | undefined)[] => [element.closest('[data-region]')?.getAttribute('data-region'), element.parentElement?.getAttribute('data-zone')]
    expect([place(title), place(extra), place(saved)]).toEqual([['menubar', 'center'], ['menubar', 'end'], ['status', 'end']])
    const later = host('menubar-center', '草稿')
    designer.append(later)
    await settle(designer)
    expect(place(later)).toEqual(['menubar', 'center'])
  })

  it('状态栏右段里宿主的状态排在表单自己的预览宽度前面，后加的也一样；设置里关掉状态栏时宿主的状态不在任何区里，再打开放回原处', async () => {
    const saved = window.document.createElement('span')
    saved.slot = 'status-end'
    saved.textContent = '已保存'
    const designer = await mount(element => element.append(saved))
    await settle(designer)
    // 比文字不比元素：同样的空元素换了顺序 toEqual 也算相等
    const end = (): string[] => Array.from(designer.querySelector('[data-region="status"] [data-zone="end"]')!.children, child => child.textContent ?? '')
    expect(end()).toEqual(['已保存', expect.stringContaining('Preview width')])
    const time = window.document.createElement('span')
    time.slot = 'status-end'
    time.textContent = '10:21'
    designer.append(time)
    await settle(designer)
    expect(end()).toEqual(['已保存', '10:21', expect.stringContaining('Preview width')])
    designer.settings = { 'general.statusBar': false }
    await settle(designer)
    expect([saved.isConnected, saved.closest('[data-region]'), time.closest('[data-region]')]).toEqual([true, null, null])
    designer.settings = {}
    await settle(designer)
    expect(end()).toEqual(['已保存', '10:21', expect.stringContaining('Preview width')])
  })

  it('画布有焦点时按 F10 把焦点交给菜单栏，再按 F10 回到画布', async () => {
    const designer = await mount(() => {})
    const canvas = designer.querySelector<HTMLElement>('[data-part="canvas"]')!
    canvas.focus()
    const f10 = (): void => void (window.document.activeElement ?? canvas).dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', bubbles: true, cancelable: true }))
    f10()
    expect(menubarOf(designer).contains(window.document.activeElement)).toBe(true)
    f10()
    expect(window.document.activeElement).toBe(canvas)
  })

  it('宿主的命令写 placement: [\'menubar:file\'] 落进文件菜单，排在设置之前；commandLayout 写了 menubar:<菜单> 就只用它', async () => {
    const extension: FormDesignerExtension = { id: '@acme/host', commands: [{ id: '@acme/host.publish', label: 'Publish', placement: ['menubar:file'], run: () => {} }] }
    const designer = await mount((element) => {
      element.extensions = [extension]
    })
    expect(items(designer, 'file')).toEqual(['save', '@acme/host.publish', 'settings'])
    designer.commandLayout = { 'menubar:file': [['@acme/host.publish'], ['save']], 'menubar:help': [] }
    await settle(designer)
    expect(items(designer, 'file')).toEqual(['@acme/host.publish', 'save'])
    expect(menubarOf(designer).collection!.map(node => node.value)).toEqual(['file', 'edit', 'view'])
  })
})

describe('<xh-form-designer>：拖动工具', () => {
  function pointer(type: string, target: EventTarget, clientX: number, clientY: number): void {
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 5, isPrimary: true, button: 0, clientX, clientY }))
  }

  function escape(target: EventTarget): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })
    target.dispatchEvent(event)
    return event
  }

  /** 选中 name、开着拖动工具的设计器；画布的 scrollBy 记下每次滚了多少。 */
  async function panSetup() {
    const { document, name, inner } = sample()
    const designer = await mount((element) => {
      element.schema = document
    })
    designer.select({ nodes: [name.id] })
    const frame = designer.querySelector('xh-designer-frame')!
    frame.canvasTool = 'pan'
    await settle(designer)
    const canvas = designer.querySelector<HTMLElement>('[data-part="canvas"]')!
    const scrolled: [number, number][] = []
    Object.defineProperty(canvas, 'scrollBy', { configurable: true, value: (x: number, y: number) => void scrolled.push([x, y]) })
    return { designer, frame, canvas, scrolled, name, inner }
  }

  it('工具栏预览宽度那组最前是外壳的拖动工具（H，手形图标）；外框换了工具时按钮的按下状态跟着重画', async () => {
    const designer = await mount(() => {})
    const frame = designer.querySelector('xh-designer-frame')!
    const button = (): HTMLButtonElement => designer.querySelector<HTMLButtonElement>('[data-part="command-bar"] button[value="pan-tool"]')!
    expect([button().getAttribute('data-icon') === null, button().getAttribute('aria-keyshortcuts'), button().getAttribute('aria-pressed')]).toEqual([false, 'H', 'false'])
    frame.canvasTool = 'pan'
    await settle(designer)
    expect(button().getAttribute('aria-pressed')).toBe('true')
    frame.canvasTool = 'select'
    await settle(designer)
    expect(button().getAttribute('aria-pressed')).toBe('false')
  })

  it('开着时在节点上按住拖动是滚动画布：不选中、不挪节点，拖动中画布标上 data-gesture；只点一下不取消选择，双击不派发 node-dblclick', async () => {
    const { designer, canvas, scrolled, name, inner } = await panSetup()
    const schema = designer.schema
    const dblclicks = events(designer, 'node-dblclick')
    pointer('pointerdown', block(designer, inner.id), 100, 100)
    expect(canvas.getAttribute('data-gesture')).toBe('pan')
    pointer('pointermove', window.document, 80, 60)
    pointer('pointermove', window.document, 90, 70)
    pointer('pointerup', window.document, 90, 70)
    expect(scrolled).toEqual([[20, 40], [-10, -10]])
    expect(canvas.hasAttribute('data-gesture')).toBe(false)
    block(designer, inner.id).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    block(designer, inner.id).dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
    await settle(designer)
    expect(designer.getSelection().nodes).toEqual([name.id])
    expect(designer.schema).toBe(schema)
    expect(dblclicks).toEqual([])
  })

  it('跨度把手上按下也是滚动画布，不改跨度；只读与预览态照样能拖', async () => {
    const ids = createIdAllocator('p')
    const grid = createNode(registry, 'grid', ids) as ContainerNode
    const { designer, canvas, scrolled } = await panSetup()
    designer.schema = { ...createDocument(), children: [grid] }
    await settle(designer)
    const handle = designer.querySelector<HTMLElement>(`[data-region-id="${grid.regions[0]!.id}"] > [data-part="span-handle"]`)!
    pointer('pointerdown', handle, 100, 100)
    pointer('pointermove', window.document, 60, 100)
    pointer('pointerup', window.document, 60, 100)
    expect(scrolled).toEqual([[40, 0]])
    expect([canvas.hasAttribute('data-resizing'), designer.canUndo]).toEqual([false, false])
    designer.readonly = true
    designer.mode = 'preview'
    await settle(designer)
    pointer('pointerdown', canvas.querySelector('xh-form-renderer')!, 100, 100)
    pointer('pointermove', window.document, 100, 50)
    pointer('pointerup', window.document, 100, 50)
    expect(scrolled).toEqual([[40, 0], [0, 50]])
  })

  it('拖动途中按 Esc 只取消这次拖动：拖动工具还开着、选择不动；不在拖动时 Esc 由外框退出拖动工具，选择也不动', async () => {
    const { designer, frame, canvas, scrolled, name } = await panSetup()
    pointer('pointerdown', canvas, 100, 100)
    pointer('pointermove', window.document, 90, 100)
    const during = escape(canvas)
    expect([during.defaultPrevented, frame.canvasTool, canvas.hasAttribute('data-gesture')]).toEqual([true, 'pan', false])
    pointer('pointermove', window.document, 50, 100)
    pointer('pointerup', window.document, 50, 100)
    expect(scrolled).toEqual([[10, 0]])
    expect(designer.getSelection().nodes).toEqual([name.id])
    expect(escape(canvas).defaultPrevented).toBe(true)
    expect(frame.canvasTool).toBe('select')
    expect(designer.getSelection().nodes).toEqual([name.id])
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
    list.querySelector('xh-menu')!.dispatchEvent(new CustomEvent('item-select', { bubbles: true, detail: { value: 'length' } }))
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
    list.querySelector('xh-menu')!.dispatchEvent(new CustomEvent('item-select', { bubbles: true, detail: { value: 'assign' } }))
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

  it('扩展的种类自带按语言给的名字：物料、节点标签、状态栏与问题说明都用它；元素自己的 translations 仍压在上面', async () => {
    setXhConfig({ locale: 'zh-TW' })
    try {
      const labelled: FormDesignerExtension = {
        id: '@acme/id',
        kinds: [{ ...text, kind: 'id-card', label: { 'en-US': 'ID card', 'zh-CN': '身份证号', 'zh-TW': '身分證號' } }],
        fieldRenderers: { 'id-card': context => ({ element: context.document.createElement('input') }) },
      }
      const ids = createIdAllocator('k')
      const node = { ...createNode(createFormModel([labelled]).registry, 'id-card', ids, { key: 'card' }) } as FieldNode
      const designer = await mount((element) => {
        element.extensions = [labelled]
        element.schema = { ...createDocument(), children: [node, { ...node, id: 'k-dup' }] }
      })
      const catalog = designer.querySelector('xh-designer-palette') as HTMLElement & { groups?: { items: { id: string, label: string }[] }[] }
      expect(catalog.groups!.flatMap(group => group.items).find(item => item.id === 'id-card')!.label).toBe('身分證號')
      designer.select({ nodes: [node.id] })
      await settle(designer)
      const frame = designer.querySelector('xh-designer-frame')!
      expect(frame.regions!.find(region => region.name === 'properties')!.subtitle).toBe('身分證號 · card')
      expect(frame.querySelector('[data-region="status"] [data-zone="start"]')!.textContent).toContain('身分證號')
      const problems = designer.querySelector('xh-designer-issues')!
      expect(problems.items!.map(item => item.subject)).toContain('身分證號 · card')
      designer.translations = { kind: kind => (kind === 'id-card' ? '证件号' : kind) }
      await settle(designer)
      expect(catalog.groups!.flatMap(group => group.items).find(item => item.id === 'id-card')!.label).toBe('证件号')
    }
    finally {
      setXhConfig({})
    }
  })

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
