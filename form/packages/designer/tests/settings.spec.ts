// @vitest-environment jsdom

import type { FormDesignerContext, FormDesignerExtension, XhFormDesigner } from '../src'
import { DesignerExtensionError } from '@xihan-ui/designer-kit'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { afterEach, describe, expect, it } from 'vitest'
import { defineFormDesigner, FORM_DESIGNER_TAG } from '../src'

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
  it('openSettings 打开设置对话框：只有基础一页，列出主题、工具栏显示方式与状态栏', async () => {
    const designer = await mount()
    designer.openSettings()
    await settle(designer)
    expect(pages()).toEqual(['general'])
    expect(['theme', 'toolbarDisplay', 'statusBar'].map(id => row(`general.${id}`) !== null)).toEqual([true, true, true])
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
    expect(pages()).toEqual(['general', 'acme'])
    expect(row('acme.token')!.querySelector('xh-password-input')).not.toBeNull()
    designer.querySelector<HTMLButtonElement>('[data-part="command-bar"] button[value="acme.read"]')!.click()
    expect(seen).toEqual([{ 'acme.token': 'k', 'acme.dense': false }])
    const before = designer.extensions
    const clash = (extensions: readonly FormDesignerExtension[]) => (): unknown => (designer.extensions = extensions)
    expect(clash([{ id: 'acme', settings: [{ ...section, id: 'general' }] }])).toThrow(DesignerExtensionError)
    expect(clash([acme, { id: 'other', settings: [section] }])).toThrow(DesignerExtensionError)
    expect(designer.extensions).toBe(before)
  })

  it('工具栏显示方式取设置里的 general.toolbarDisplay，缺省只显示图标', async () => {
    const designer = await mount()
    const shell = (): Element => designer.querySelector('xh-tooltip[data-scope="designer-commands"]')!
    expect(shell().getAttribute('data-display')).toBe('icon')
    designer.settings = { 'general.toolbarDisplay': 'both' }
    await designer.updateComplete
    expect(shell().getAttribute('data-display')).toBe('both')
    designer.settings = { 'general.toolbarDisplay': 'text' }
    await designer.updateComplete
    expect(shell().getAttribute('data-display')).toBe('text')
  })

  it('设置里关掉状态栏：外框不显示它；这时关掉一块面板，panels 仍留着 status，再打开状态栏照样出现', async () => {
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
    expect(designer.panels!.split(' ')).toContain('status')
    designer.settings = {}
    await designer.updateComplete
    await frame.updateComplete
    expect(frame.showsPanel('status')).toBe(true)
  })
})
