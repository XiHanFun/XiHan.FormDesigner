// @vitest-environment jsdom

import type { ContainerNode, FieldNode, FormDocument } from '@xihan-form/core'
import { createDocument, createFormModel, createNode } from '@xihan-form/core'
import { createFormRuntimeModel, DEFAULT_FORM_DESIGNER_TRANSLATIONS, DEFAULT_FORM_RENDERER_TRANSLATIONS } from '@xihan-form/runtime'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { afterEach, describe, expect, it } from 'vitest'
import { DesignCanvas } from '../src/canvas'

defineXhElements()

const registry = createFormModel().registry

function sample(): { document: FormDocument, a: FieldNode, b: FieldNode, card: ContainerNode, inner: FieldNode, grid: ContainerNode } {
  const ids = createIdAllocator('c')
  const a = createNode(registry, 'text', ids, { key: 'a' }) as FieldNode
  const b = createNode(registry, 'text', ids, { key: 'b' }) as FieldNode
  const inner = createNode(registry, 'number', ids, { key: 'inner' }) as FieldNode
  const card = createNode(registry, 'card', ids) as ContainerNode
  const filled: ContainerNode = { ...card, regions: [{ ...card.regions[0]!, children: [inner] }] }
  const grid = createNode(registry, 'grid', ids) as ContainerNode
  return { document: { ...createDocument(), children: [a, b, filled, grid] }, a, b, card: filled, inner, grid }
}

function mount(document: FormDocument): DesignCanvas {
  const canvas = new DesignCanvas({
    ownerDocument: window.document,
    model: () => createFormRuntimeModel(),
    translations: () => DEFAULT_FORM_DESIGNER_TRANSLATIONS,
    rendererTranslations: () => DEFAULT_FORM_RENDERER_TRANSLATIONS,
  })
  canvas.render(document)
  window.document.body.append(canvas.element)
  return canvas
}

/** jsdom 不排版：给元素定一个位置。 */
function place(element: HTMLElement, top: number, height: number, left = 0, width = 200): void {
  element.getBoundingClientRect = () => ({ top, bottom: top + height, left, right: left + width, width, height, x: left, y: top, toJSON: () => ({}) })
}

function pointAt(hit: Element | undefined): void {
  window.document.elementsFromPoint = () => (hit === undefined ? [] : [hit])
}

afterEach(() => {
  window.document.body.replaceChildren()
})

describe('dropAt', () => {
  it('顶层：按节点块的竖向中线算插入下标', () => {
    const { document, a, b, card, grid } = sample()
    const canvas = mount(document)
    ;[a, b, card, grid].forEach((node, index) => place(canvas.nodeElement(node.id)!, index * 100, 80))
    pointAt(canvas.nodeElement(b.id))
    const drop = canvas.dropAt({ x: 10, y: 110 })
    expect(drop.target).toEqual({ parent: null, index: 1 })
    expect(drop.before).toBe(canvas.nodeElement(b.id))
    expect(drop.after).toBe(canvas.nodeElement(a.id))
    pointAt(undefined)
    expect(canvas.dropAt({ x: 10, y: 1000 }).target).toEqual({ parent: null, index: 4 })
  })

  it('指针在区域里时放进最内层的区域；空区域插在开头', () => {
    const { document, card, inner, grid } = sample()
    const canvas = mount(document)
    place(canvas.nodeElement(inner.id)!, 200, 40)
    pointAt(canvas.nodeElement(inner.id)!.querySelector('[data-part="node-body"]')!)
    expect(canvas.dropAt({ x: 10, y: 230 })).toMatchObject({ target: { parent: card.regions[0]!.id, index: 1 }, before: undefined, after: canvas.nodeElement(inner.id) })
    const column = canvas.regionElement(grid.regions[1]!.id)!
    pointAt(column)
    expect(canvas.dropAt({ x: 10, y: 400 })).toMatchObject({ target: { parent: grid.regions[1]!.id, index: 0 }, list: column, before: undefined, after: undefined })
  })

  it('落在容器外框里、不在区域里：贴边放在容器前后，否则放进最近的区域', () => {
    const { document, a, b, card, grid } = sample()
    const canvas = mount(document)
    ;[a, b, card, grid].forEach((node, index) => place(canvas.nodeElement(node.id)!, index * 100, index === 3 ? 200 : 80))
    place(canvas.regionElement(grid.regions[0]!.id)!, 300, 80, 0, 100)
    place(canvas.regionElement(grid.regions[1]!.id)!, 300, 80, 100, 100)
    pointAt(canvas.nodeElement(grid.id)!.querySelector('[data-part="node-body"]')!)
    expect(canvas.dropAt({ x: 150, y: 390 }).target).toEqual({ parent: grid.regions[1]!.id, index: 0 })
    expect(canvas.dropAt({ x: 150, y: 305 }).target).toEqual({ parent: null, index: 3 })
    expect(canvas.dropAt({ x: 150, y: 495 }).target).toEqual({ parent: null, index: 4 })
  })
})
