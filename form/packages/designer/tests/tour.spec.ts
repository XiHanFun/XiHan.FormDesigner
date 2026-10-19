// @vitest-environment jsdom

import type { DesignerTourStepView, XhDesignerTourElement } from '@xihan-ui/designer-shell'
import type { FormDesignerContext, FormDesignerEventMap, XhFormDesigner } from '../src'
import { createDocument, createFormModel, createNode } from '@xihan-form/core'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS } from '@xihan-form/runtime'
import { createIdAllocator, DesignerExtensionError } from '@xihan-ui/designer-kit'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { afterEach, describe, expect, it } from 'vitest'
import { createFormDesignerModel, defineFormDesigner, FORM_COMMANDS, FORM_DESIGNER_TAG } from '../src'

defineXhElements()
defineFormDesigner()

Element.prototype.scrollIntoView ??= function scrollIntoView() {}

const registry = createFormModel().registry
const mounted: Element[] = []

afterEach(() => {
  for (const element of mounted.splice(0))
    element.remove()
})

/** jsdom 不排版：给画布一个宽度，当作设计器显示着；0 是没显示。 */
function setCanvasWidth(designer: XhFormDesigner, width: number): void {
  Object.defineProperty(designer.querySelector('[data-part="canvas"]')!, 'clientWidth', { configurable: true, value: width })
}

async function settle(designer: XhFormDesigner): Promise<void> {
  await designer.updateComplete
  await designer.querySelector('xh-designer-frame')!.updateComplete
  // 自动开始排在这一轮更新落定之后
  await Promise.resolve()
}

async function mount(setup: (designer: XhFormDesigner) => void = () => {}): Promise<XhFormDesigner> {
  const designer = window.document.createElement(FORM_DESIGNER_TAG)
  designer.schema = { ...createDocument(), children: [createNode(registry, 'text', createIdAllocator('t'), { key: 'name' })] }
  setup(designer)
  window.document.body.append(designer)
  mounted.push(designer)
  await settle(designer)
  return designer
}

/** 设计器显示出来：画布有了宽度，再走一轮更新。 */
async function show(designer: XhFormDesigner): Promise<XhFormDesigner> {
  setCanvasWidth(designer, 800)
  designer.requestUpdate()
  await settle(designer)
  return designer
}

function tourOf(designer: XhFormDesigner): XhDesignerTourElement {
  return designer.querySelector('xh-designer-tour')!
}

function ids(steps: readonly { readonly id: string }[] | undefined): string[] {
  return (steps ?? []).map(step => step.id)
}

function events<K extends keyof FormDesignerEventMap>(target: EventTarget, type: K): FormDesignerEventMap[K]['detail'][] {
  const out: FormDesignerEventMap[K]['detail'][] = []
  target.addEventListener(type, event => out.push((event as FormDesignerEventMap[K]).detail))
  return out
}

describe('新手引导', () => {
  it('内置扩展登记表单的四步；步骤 id 与别人重名或用了 shell. 前缀时抛 DesignerExtensionError', () => {
    expect(ids(createFormDesignerModel([]).tourSteps)).toEqual(['form.insert', 'form.outline', 'form.rules', 'form.preview'])
    const step = (id: string): { id: string, title: string, description: string } => ({ id, title: 'T', description: 'D' })
    expect(ids(createFormDesignerModel([{ id: '@acme/tour', tourSteps: [step('@acme/tour.extra')] }]).tourSteps).at(-1)).toBe('@acme/tour.extra')
    expect(() => createFormDesignerModel([{ id: '@acme/tour', tourSteps: [step('form.insert')] }])).toThrow(DesignerExtensionError)
    expect(() => createFormDesignerModel([{ id: '@acme/tour', tourSteps: [step('shell.mine')] }])).toThrow(DesignerExtensionError)
  })

  it('交给引导零件的各步按此刻的文案取好文字；只读时不讲顶栏插入与校验联动两步', async () => {
    const designer = await mount(element => element.autoTour = false)
    const tour = tourOf(designer)
    expect(tour.frame).toBe(designer.querySelector('xh-designer-frame'))
    const steps = tour.steps as readonly DesignerTourStepView[]
    expect(ids(steps)).toEqual(['form.insert', 'form.outline', 'form.rules', 'form.preview'])
    expect(steps.find(step => step.id === 'form.outline')).toMatchObject({ target: { panel: 'outline' }, title: DEFAULT_FORM_DESIGNER_TRANSLATIONS.tour.outlineTitle, description: DEFAULT_FORM_DESIGNER_TRANSLATIONS.tour.outlineDescription })
    designer.readonly = true
    await designer.updateComplete
    expect(ids(tour.steps)).toEqual(['form.outline', 'form.preview'])
  })

  it('第一次铺好画布后自动开始；收起时派发 tour-end，设置里记下 help.tourDone 并派发 settings-change', async () => {
    const designer = await show(await mount())
    const tour = tourOf(designer)
    expect(tour.running).toBe(true)
    const ended = events(designer, 'tour-end')
    const changed = events(designer, 'settings-change')
    tour.stop()
    expect(ended).toEqual([{ reason: 'close', step: 'shell.welcome' }])
    expect(designer.settings).toEqual({ 'help.tourDone': true })
    expect(changed.map(detail => [detail.key, detail.value])).toEqual([['help.tourDone', true]])
    designer.startTour()
    tour.stop()
    expect(changed).toHaveLength(1)
  })

  it('设计器没显示出来（画布没有宽度）时先不开始，显示出来再开始，只开一次', async () => {
    const designer = await mount()
    const tour = tourOf(designer)
    expect(tour.running).toBe(false)
    await show(designer)
    expect(tour.running).toBe(true)
    tour.stop()
    designer.requestUpdate()
    await settle(designer)
    expect(tour.running).toBe(false)
  })

  it('设置里记着走完、autoTour 为 false 或在预览态时不自动开始；startTour() 与命令 start-tour 照样能开', async () => {
    expect(tourOf(await show(await mount(element => element.settings = { 'help.tourDone': true }))).running).toBe(false)
    expect(tourOf(await show(await mount(element => element.mode = 'preview'))).running).toBe(false)
    const designer = await show(await mount(element => element.autoTour = false))
    const tour = tourOf(designer)
    expect(tour.running).toBe(false)
    expect(designer.startTour()).toBe(true)
    expect(tour.running).toBe(true)
    tour.stop()
    const command = FORM_COMMANDS.find(item => item.id === 'start-tour')!
    command.run?.({ designer } as FormDesignerContext)
    expect(tour.running).toBe(true)
    tour.stop()
  })

  it('同一页别的设计器的引导开着时自动开始不抢；startTour()、命令 start-tour 与帮助页的「开始引导」先收起那一个再开始', async () => {
    const first = await show(await mount())
    expect(tourOf(first).running).toBe(true)
    const second = await show(await mount())
    expect(tourOf(second).running).toBe(false)
    expect(second.startTour()).toBe(true)
    expect([tourOf(first).running, tourOf(second).running]).toEqual([false, true])
    const command = FORM_COMMANDS.find(item => item.id === 'start-tour')!
    command.run?.({ designer: first } as FormDesignerContext)
    expect([tourOf(first).running, tourOf(second).running]).toEqual([true, false])
    second.querySelector('xh-designer-settings')!.dispatchEvent(new CustomEvent('settings-command', { detail: { command: 'start-tour' } }))
    expect([tourOf(first).running, tourOf(second).running]).toEqual([false, true])
    tourOf(second).stop()
  })
})
