// @vitest-environment jsdom

import type { FormDesignerContext, FormDesignerExtension, XhFormDesigner } from '../src'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS } from '@xihan-form/runtime'
import { DesignerExtensionError } from '@xihan-ui/designer-kit'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { afterEach, describe, expect, it } from 'vitest'
import { version } from '../package.json'
import { defineFormDesigner, FORM_DESIGNER_TAG, FORM_DESIGNER_VERSION, FORM_TOOLBAR_LAYOUT } from '../src'

defineXhElements()
defineFormDesigner()

// jsdom 没有 scrollIntoView。
Element.prototype.scrollIntoView ??= function scrollIntoView() {}

const mounted: Element[] = []

afterEach(() => {
  for (const element of mounted.splice(0))
    element.remove()
  localStorage.clear()
})

async function mount(setup: (designer: XhFormDesigner) => void = () => {}): Promise<XhFormDesigner> {
  const designer = window.document.createElement(FORM_DESIGNER_TAG)
  setup(designer)
  window.document.body.append(designer)
  mounted.push(designer)
  await designer.updateComplete
  return designer
}

/** 等设计器与设置对话框都更新完；对话框打开后内容搬到浮层根，要多等几拍。 */
async function settle(designer: XhFormDesigner): Promise<void> {
  for (let round = 0; round < 3; round++) {
    await designer.updateComplete
    await designer.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('xh-designer-settings')!.updateComplete
    await Promise.resolve()
  }
}

/** 主题切换组的值是选项的下标：跟随页面、跟随系统、亮色、暗色。 */
const THEME = { light: '2', dark: '3' } as const

function row(key: string): HTMLElement | null {
  return window.document.querySelector<HTMLElement>(`[data-setting="${key}"]`)
}

function pages(): string[] {
  return Array.from(window.document.querySelectorAll('[data-scope="designer-settings"][data-part="pages"] [data-xh-part="list"] > button'), button => button.getAttribute('value')!)
}

describe('<xh-form-designer>：设置', () => {
  it('openSettings 打开设置对话框：基础、布局、工具栏、帮助、快捷键与关于六页；基础列出主题与状态栏，工具栏页列出按钮显示方式、显示工具栏与按钮表', async () => {
    const designer = await mount()
    designer.openSettings()
    await settle(designer)
    expect(pages()).toEqual(['general', 'layout', 'toolbar', 'help', 'shortcuts', 'about'])
    expect(['general.theme', 'general.statusBar', 'general.toolbarDisplay'].map(key => row(key) !== null)).toEqual([true, true, false])
    designer.openSettings('toolbar')
    await settle(designer)
    expect(['toolbar.display', 'toolbar.visible', 'toolbar.layout'].map(key => row(key) !== null)).toEqual([true, true, true])
    expect(designer.querySelector('xh-designer-frame + xh-designer-settings')).not.toBeNull()
  })

  it('settingsPolicy 锁定的条目只读', async () => {
    const designer = await mount((element) => {
      element.settingsPolicy = { 'general.theme': 'locked' }
    })
    designer.openSettings()
    await settle(designer)
    expect(row('general.theme')!.querySelector('xh-field')!.hasAttribute('read-only')).toBe(true)
  })

  it('在对话框里换主题：settings 换成新的一份、派发 settings-change，主题落在设计器元素上；赋回 settings 恢复', async () => {
    const designer = await mount()
    designer.openSettings()
    await settle(designer)
    const changes: unknown[] = []
    designer.addEventListener('settings-change', event => changes.push((event as CustomEvent).detail))
    row('general.theme')!.querySelector('xh-toggle-group')!.dispatchEvent(new CustomEvent('value-change', { detail: { value: THEME.dark }, bubbles: true }))
    await settle(designer)
    expect(changes).toEqual([{ key: 'general.theme', value: 'dark', settings: { 'general.theme': 'dark' } }])
    expect(designer.settings).toEqual({ 'general.theme': 'dark' })
    expect(designer.getAttribute('data-theme')).toBe('dark')
    designer.settings = {}
    await settle(designer)
    expect(designer.hasAttribute('data-theme')).toBe(false)
  })

  it('主题与主题色落在设计器元素上：亮暗写 data-theme，预设主题色写 data-brand，跟随页面时去掉', async () => {
    const designer = await mount((element) => {
      element.brands = [{ value: 'green', color: '#16a34a' }]
      element.settings = { 'general.theme': 'dark' }
    })
    expect(designer.getAttribute('data-theme')).toBe('dark')
    designer.settings = { 'general.brand': 'green' }
    await designer.updateComplete
    expect([designer.getAttribute('data-theme'), designer.getAttribute('data-brand')]).toEqual(['light', 'green'])
    designer.settings = {}
    await designer.updateComplete
    expect([designer.hasAttribute('data-theme'), designer.hasAttribute('data-brand')]).toEqual([false, false])
  })

  it('给了 settingsStorageKey：没赋 settings 时从存储读，对话框里改了就写回；读出的不是对象时派发 settings-storage-error', async () => {
    localStorage.setItem('form-settings', JSON.stringify({ 'general.toolbarDisplay': 'both' }))
    const designer = await mount(element => (element.settingsStorageKey = 'form-settings'))
    expect(designer.settings).toEqual({ 'general.toolbarDisplay': 'both' })
    designer.openSettings()
    await settle(designer)
    row('general.theme')!.querySelector('xh-toggle-group')!.dispatchEvent(new CustomEvent('value-change', { detail: { value: THEME.light }, bubbles: true }))
    expect(JSON.parse(localStorage.getItem('form-settings')!)).toEqual({ 'general.toolbarDisplay': 'both', 'general.theme': 'light' })

    localStorage.setItem('broken', '[1]')
    const errors: unknown[] = []
    await mount((element) => {
      element.addEventListener('settings-storage-error', event => errors.push((event as CustomEvent).detail))
      element.settingsStorageKey = 'broken'
    })
    expect(errors).toEqual([expect.objectContaining({ operation: 'read', key: 'broken' })])
  })

  it('扩展登记的设置分区放进对话框，命令从上下文的 settings 读到缺省值与写了的值；分区 id 与 general 或彼此重名时赋值即抛错', async () => {
    const seen: FormDesignerContext['settings'][] = []
    const section = { id: 'acme', label: 'Acme', order: 200, items: [{ path: ['token'], label: 'Token', control: { kind: 'text' as const, secret: true } }, { path: ['dense'], label: 'Dense', control: { kind: 'boolean' as const }, default: false }] }
    const acme: FormDesignerExtension = { id: 'acme', settings: [section], commands: [{ id: 'acme.read', label: 'Read', placement: ['toolbar'], run: context => void seen.push(context.settings) }] }
    const designer = await mount((element) => {
      element.extensions = [acme]
      element.settings = { 'acme.token': 'k' }
    })
    designer.openSettings('acme')
    await settle(designer)
    expect(pages()).toEqual(['general', 'layout', 'toolbar', 'acme', 'help', 'shortcuts', 'about'])
    expect(row('acme.token')!.querySelector('xh-password-input')).not.toBeNull()
    designer.querySelector<HTMLButtonElement>('[data-part="command-bar"] button[value="acme.read"]')!.click()
    expect(seen).toEqual([{ 'acme.token': 'k', 'acme.dense': false }])
    const before = designer.extensions
    const clash = (extensions: readonly FormDesignerExtension[]) => (): unknown => (designer.extensions = extensions)
    expect(clash([{ id: 'acme', settings: [{ ...section, id: 'general' }] }])).toThrow(DesignerExtensionError)
    expect(clash([acme, { id: 'other', settings: [section] }])).toThrow(DesignerExtensionError)
    expect(designer.extensions).toBe(before)
  })

  it('工具栏的按钮显示方式取设置里的 toolbar.display，缺省只显示图标', async () => {
    const designer = await mount()
    const shell = (): Element => designer.querySelector('[data-part="command-bar"] xh-tooltip[data-scope="designer-commands"]')!
    expect(shell().getAttribute('data-display')).toBe('icon')
    designer.settings = { 'toolbar.display': 'both' }
    await designer.updateComplete
    expect(shell().getAttribute('data-display')).toBe('both')
    designer.settings = { 'toolbar.display': 'text' }
    await designer.updateComplete
    expect(shell().getAttribute('data-display')).toBe('text')
  })

  it('工具栏按设置「工具栏」页的定制排：换了先后、藏起的不在工具栏上；对话框拿到缺省排列与各命令的文字；toolbar.visible 为 false 时不登记工具栏', async () => {
    const designer = await mount()
    const values = (): string[] => Array.from(designer.querySelectorAll<HTMLButtonElement>('[data-part="command-bar"] button[data-xh-part="item"][value]'), button => button.value)
    const dialog = designer.querySelector<HTMLElement & { toolbar?: { defaults: string[][], commands: { id: string, label: string }[] } }>('xh-designer-settings')!
    expect(dialog.toolbar!.defaults).toEqual(FORM_TOOLBAR_LAYOUT.map(group => [...group]))
    expect(dialog.toolbar!.commands[0]).toMatchObject({ id: 'undo', label: 'Undo' })
    expect(values().slice(0, 3)).toEqual(['undo', 'redo', 'delete'])
    const [first, second, ...rest] = FORM_TOOLBAR_LAYOUT
    designer.settings = { 'toolbar.layout': { groups: [[...second!], [first![1]!, first![0]!], ...rest.map(group => [...group])], hidden: ['delete'] } }
    await settle(designer)
    expect(values().slice(0, 3)).toEqual(['duplicate', 'redo', 'undo'])
    expect(values()).not.toContain('delete')
    const frame = designer.querySelector<HTMLElement & { showsPanel: (name: string) => boolean, updateComplete: Promise<unknown> }>('xh-designer-frame')!
    expect(frame.showsPanel('toolbar')).toBe(true)
    designer.settings = { 'toolbar.visible': false }
    await settle(designer)
    await frame.updateComplete
    expect(frame.showsPanel('toolbar')).toBe(false)
  })

  it('设置里关掉状态栏：外框不登记它；这时关掉一块面板，设置里两条都在，再打开状态栏照样出现', async () => {
    const designer = await mount()
    const frame = designer.querySelector<HTMLElement & { showsPanel: (name: string) => boolean, updateComplete: Promise<unknown> }>('xh-designer-frame')!
    await frame.updateComplete
    expect(frame.showsPanel('status')).toBe(true)
    designer.settings = { 'general.statusBar': false }
    await designer.updateComplete
    await frame.updateComplete
    expect(frame.showsPanel('status')).toBe(false)
    frame.querySelector<HTMLButtonElement>('[data-region="palette"] [data-part="panel-close"]')!.click()
    await designer.updateComplete
    expect(designer.settings!['general.statusBar']).toBe(false)
    expect(designer.settings!['layout.panels']).toMatchObject({ hidden: ['history', 'palette'] })
    designer.settings = { 'layout.panels': designer.settings!['layout.panels']! }
    await designer.updateComplete
    await frame.updateComplete
    expect(frame.showsPanel('status')).toBe(true)
    expect(frame.showsPanel('palette')).toBe(false)
  })

  it('帮助页是表单的几段说明与开始引导、打开文档两颗钮；点开始引导先关上对话框，再开始引导', async () => {
    const designer = await mount(element => element.autoTour = false)
    designer.openSettings('help')
    await settle(designer)
    expect(row('help.guide')!.textContent).toContain(DEFAULT_FORM_DESIGNER_TRANSLATIONS.help.notes[0])
    expect([row('help.startTour'), row('help.help')].map(item => item?.querySelector('[data-part="action"]')?.getAttribute('data-command'))).toEqual(['start-tour', 'help'])
    expect(row('help.help')!.textContent).toContain(DEFAULT_FORM_DESIGNER_TRANSLATIONS.help.docs)
    row('help.startTour')!.querySelector<HTMLElement>('[data-part="action"]')!.click()
    await settle(designer)
    const dialog = designer.querySelector<HTMLElement & { open?: boolean }>('xh-designer-settings')!
    const tour = designer.querySelector<HTMLElement & { running: boolean, stop: () => void }>('xh-designer-tour')!
    expect([dialog.open, tour.running]).toEqual([false, true])
    tour.stop()
  })

  it('快捷键页按命令表分组：扩展的命令归「扩展」，「本设计器」那组末尾是表单不是命令的按键；「通用」组末尾只留 Alt+F10 与 Esc', async () => {
    const extension: FormDesignerExtension = { id: '@acme/keys', commands: [{ id: '@acme/keys.ping', label: 'Ping', shortcut: ['Mod', 'Shift', 'P'], run: () => {} }] }
    const designer = await mount(element => element.extensions = [extension])
    const shortcuts = designer.querySelector<HTMLElement & { shortcuts?: { groups: readonly { id: string, rows: readonly { label: string, keys: readonly (readonly string[])[] }[] }[], commonKeys?: readonly { id: string }[] } }>('xh-designer-settings')!.shortcuts!
    expect(shortcuts.commonKeys?.map(key => key.id)).toEqual(['selectionToolbar', 'cancel'])
    const group = (id: string): readonly { label: string, keys: readonly (readonly string[])[] }[] => shortcuts.groups.find(item => item.id === id)?.rows ?? []
    expect(group('extensions')).toEqual([{ label: 'Ping', keys: [['Mod', 'Shift', 'P']] }])
    expect(group('edit').map(item => item.label)).toContain('Delete')
    const keys = DEFAULT_FORM_DESIGNER_TRANSLATIONS.keys
    expect(group('designer').slice(-5)).toEqual([
      { label: keys.selectSibling, keys: [['ArrowUp'], ['ArrowDown']] },
      { label: keys.moveSibling, keys: [['Alt', 'ArrowUp'], ['Alt', 'ArrowDown']] },
      { label: keys.selectChild, keys: [['Enter']] },
      { label: keys.selectParent, keys: [['Escape']] },
      { label: keys.contextMenu, keys: [['Shift', 'F10'], ['ContextMenu']] },
    ])
  })

  it('关于页：产品名、表单设计器的版本（取 package.json）与许可证，后面接各扩展的 about', async () => {
    expect(FORM_DESIGNER_VERSION).toBe(version)
    const designer = await mount(element => element.extensions = [{ id: '@acme/pro', about: [{ label: 'Acme Pro', value: '1.2.0' }] }])
    const about = designer.querySelector<HTMLElement & { about?: unknown }>('xh-designer-settings')!.about
    expect(about).toEqual({ product: DEFAULT_FORM_DESIGNER_TRANSLATIONS.help.product, version, license: 'MIT', rows: [{ label: 'Acme Pro', value: '1.2.0' }] })
  })
})
