// @vitest-environment jsdom

import type { DesignerPaletteGroup, XhDesignerOutlineElement } from '@xihan-ui/designer-shell'
import type { FormDesignerExtension } from '../src'
import { BUILTIN_FIELDS, createDocument, createFormModel, createNode } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { StarIcon } from '@xihan-ui/icons'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { afterEach, describe, expect, it } from 'vitest'
import { createFormDesignerModel, defineFormDesigner, FORM_DESIGNER_TAG, FORM_KIND_ICONS } from '../src'

defineXhElements()
defineFormDesigner()

Element.prototype.scrollIntoView ??= function scrollIntoView() {}

const mounted: Element[] = []

afterEach(() => {
  for (const element of mounted.splice(0))
    element.remove()
})

const text = BUILTIN_FIELDS.find(definition => definition.kind === 'text')!

/** 一个只带种类与它的渲染器的扩展。 */
function slug(extra: Partial<FormDesignerExtension> = {}): FormDesignerExtension {
  return {
    id: '@acme/slug',
    kinds: [{ ...text, kind: 'slug' }],
    fieldRenderers: { slug: context => ({ element: context.document.createElement('input') }) },
    ...extra,
  }
}

describe('种类图标', () => {
  it('内置种类都有图标', () => {
    const missing = createFormModel().registry.list().map(definition => definition.kind).filter(kind => FORM_KIND_ICONS[kind] === undefined)
    expect(missing).toEqual([])
  })

  it('扩展经 kindIcons 给自己种类的图标；给了别人的种类时抛 TypeError', () => {
    expect(createFormDesignerModel([slug({ kindIcons: { slug: StarIcon } })]).kindIcons.get('slug')).toBe(StarIcon)
    expect(createFormDesignerModel([slug()]).kindIcons.has('slug')).toBe(false)
    expect(() => createFormDesignerModel([slug({ kindIcons: { text: StarIcon } })])).toThrow(TypeError)
  })

  it('物料面板与页面结构的条目带种类的图标', async () => {
    const node = createNode(createFormModel().registry, 'number', createIdAllocator('k'), { key: 'age' })
    const designer = window.document.createElement(FORM_DESIGNER_TAG)
    designer.schema = { ...createDocument(), children: [node] }
    designer.extensions = [slug({ kindIcons: { slug: StarIcon } })]
    window.document.body.append(designer)
    mounted.push(designer)
    await designer.updateComplete
    const groups = (designer.querySelector('xh-designer-palette') as HTMLElement & { groups?: DesignerPaletteGroup[] }).groups!
    const items = new Map(groups.flatMap(group => group.items).map(item => [item.id, item.icon]))
    expect([items.get('text'), items.get('number'), items.get('slug')]).toEqual([FORM_KIND_ICONS.text, FORM_KIND_ICONS.number, StarIcon])
    const outline = designer.querySelector<XhDesignerOutlineElement>('xh-designer-outline')!
    expect(outline.nodes![0]!.icon).toBe(FORM_KIND_ICONS.number)
  })
})
