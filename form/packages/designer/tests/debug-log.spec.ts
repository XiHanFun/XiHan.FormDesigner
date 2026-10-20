// @vitest-environment jsdom

import type { XhFormDesigner } from '../src'
import { createDocument, createFormModel, createNode } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineFormDesigner, FORM_DESIGNER_TAG } from '../src'

defineXhElements()
defineFormDesigner()

Element.prototype.scrollIntoView ??= function scrollIntoView() {}

const registry = createFormModel().registry
const mounted: Element[] = []

afterEach(() => {
  for (const element of mounted.splice(0))
    element.remove()
  vi.restoreAllMocks()
})

async function mount(): Promise<XhFormDesigner> {
  const designer = window.document.createElement(FORM_DESIGNER_TAG)
  designer.autoTour = false
  designer.schema = { ...createDocument(), children: [createNode(registry, 'text', createIdAllocator('d'), { key: 'name' })] }
  window.document.body.append(designer)
  mounted.push(designer)
  await designer.updateComplete
  return designer
}

describe('<xh-form-designer>：渲染调试日志', () => {
  it('开发者模式与渲染日志都开着时，重画、重铺画布与模板自检各在控制台记一组带耗时的；关掉开发者模式就不记', async () => {
    const group = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {})
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const designer = await mount()
    const titles = (): string[] => group.mock.calls.map(call => String(call[0]))
    designer.readonly = true
    await designer.updateComplete
    expect(group).not.toHaveBeenCalled()
    designer.settings = { 'general.developer': true, 'general.debugRender': true }
    await designer.updateComplete
    group.mockClear()
    designer.readonly = false
    await designer.updateComplete
    expect(titles()).toContainEqual(expect.stringMatching(/^\[xh-form-designer\] render · update: readonly \d+\.\d ms$/))
    group.mockClear()
    designer.execute([{ type: 'setProperty', nodeId: designer.schema.children[0]!.id, group: 'basic', name: 'label', value: 'Name' }])
    await designer.updateComplete
    expect(titles()).toEqual(expect.arrayContaining([
      expect.stringMatching(/^\[xh-form-designer\] render · validate \d+\.\d ms$/),
      expect.stringMatching(/^\[xh-form-designer\] render · canvas \d+\.\d ms$/),
    ]))
    designer.settings = { 'general.debugRender': true }
    await designer.updateComplete
    group.mockClear()
    designer.readonly = true
    await designer.updateComplete
    expect(group).not.toHaveBeenCalled()
  })
})
