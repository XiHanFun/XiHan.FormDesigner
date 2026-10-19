// @vitest-environment jsdom

import type { FieldNode, FormDocument } from '@xihan-form/core'
import type { DesignerPaletteGroup, DesignerPaletteItem } from '@xihan-ui/designer-shell'
import type { FormDesignerExtension, FormDropTarget, XhFormDesigner } from '../src'
import { createDocument, createFormModel, createNode } from '@xihan-form/core'
import { createIdAllocator, DesignerExtensionError } from '@xihan-ui/designer-kit'
import { startDrag } from '@xihan-ui/designer-shell'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { afterEach, describe, expect, it } from 'vitest'
import { createFormDesignerModel, defineFormDesigner, FORM_DESIGNER_TAG } from '../src'

defineXhElements()
defineFormDesigner()

Element.prototype.scrollIntoView ??= function scrollIntoView() {}

const registry = createFormModel().registry
const mounted: Element[] = []

afterEach(() => {
  for (const element of mounted.splice(0))
    element.remove()
  document.body.innerHTML = ''
})

function sample(): { document: FormDocument, name: FieldNode } {
  const name = createNode(registry, 'text', createIdAllocator('p'), { key: 'name' }) as FieldNode
  return { document: { ...createDocument(), children: [name] }, name }
}

/** 一个物料来源：一组一条，插入时只记下条目与落点。 */
function blocks(seen: (readonly [string, FormDropTarget | undefined])[]): FormDesignerExtension {
  return {
    id: '@acme/blocks',
    paletteSources: [{
      id: '@acme/blocks.palette',
      groups: () => [{ id: 'acme', label: 'Acme', items: [{ id: 'acme.block', label: 'Block', payload: { block: 1 } }] }],
      insert: (item, _context, at) => void seen.push([item.id, at]),
    }],
  }
}

async function mount(extensions: readonly FormDesignerExtension[]): Promise<XhFormDesigner> {
  const designer = window.document.createElement(FORM_DESIGNER_TAG)
  designer.autoTour = false
  designer.schema = sample().document
  designer.extensions = extensions
  window.document.body.append(designer)
  mounted.push(designer)
  await designer.updateComplete
  return designer
}

function catalogOf(designer: XhFormDesigner): HTMLElement & { groups?: readonly DesignerPaletteGroup[] } {
  return designer.querySelector('xh-designer-palette')!
}

function activate(designer: XhFormDesigner, item: Pick<DesignerPaletteItem, 'id' | 'payload'>): void {
  catalogOf(designer).dispatchEvent(new CustomEvent('item-activate', { detail: { id: item.id, payload: item.payload }, bubbles: true }))
}

function pointer(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: 'mouse', button: 0, clientX: x, clientY: y })
}

/** 从一个按钮按住拖到画布上松开：放置目标与画布里的落点都按指针下的元素找，这里都指到画布。 */
function dragToCanvas(designer: XhFormDesigner, payload: unknown): void {
  const canvas = designer.querySelector<HTMLElement>('[data-part="canvas"]')!
  const handle = window.document.createElement('button')
  window.document.body.append(handle)
  handle.addEventListener('pointerdown', event => startDrag(event, { payload, preview: null }))
  const { elementFromPoint, elementsFromPoint } = window.document
  window.document.elementFromPoint = () => canvas
  window.document.elementsFromPoint = () => [canvas]
  try {
    handle.dispatchEvent(pointer('pointerdown', 10, 10))
    window.document.dispatchEvent(pointer('pointermove', 60, 60))
    window.document.dispatchEvent(pointer('pointermove', 80, 80))
    window.document.dispatchEvent(pointer('pointerup', 80, 80))
  }
  finally {
    window.document.elementFromPoint = elementFromPoint
    window.document.elementsFromPoint = elementsFromPoint
  }
}

describe('<xh-form-designer>：物料来源', () => {
  it('扩展登记的物料来源，分组接在内置分组后面；点按与拖到画布上放下都交给它的 insert，内置的种类照旧插入', async () => {
    const seen: (readonly [string, FormDropTarget | undefined])[] = []
    const designer = await mount([blocks(seen)])
    expect(catalogOf(designer).groups!.at(-1)!.id).toBe('acme')
    const before = designer.schema
    activate(designer, { id: 'acme.block', payload: { block: 1 } })
    expect(seen).toEqual([['acme.block', undefined]])
    expect(designer.schema).toBe(before)
    dragToCanvas(designer, { source: 'palette', id: 'acme.block', payload: { block: 1 } })
    expect(seen).toHaveLength(2)
    expect(seen[1]![0]).toBe('acme.block')
    expect(seen[1]![1]).toMatchObject({ parent: null })
    activate(designer, { id: 'number', payload: { kind: 'number' } })
    expect(designer.schema.children.map(node => node.kind)).toEqual(['text', 'number'])
    expect(seen).toHaveLength(2)
  })

  it('物料来源 id 重名时合出模型就抛 DesignerExtensionError', () => {
    const one = blocks([])
    expect(() => createFormDesignerModel([one, { ...one, id: '@acme/other' }])).toThrow(DesignerExtensionError)
    expect(createFormDesignerModel([one]).paletteSources.map(source => source.id)).toEqual(['@acme/blocks.palette'])
  })

  it('paste 给了 at 就粘贴到那里，不给时在选中节点之后', async () => {
    const designer = await mount([])
    const { name } = sample()
    designer.paste({ nodes: [{ ...name, id: 'p-copy' }] }, { at: { parent: null, index: 0 } })
    expect(designer.schema.children).toHaveLength(2)
    expect(designer.schema.children[1]!.id).toBe(name.id)
    designer.select({ nodes: [designer.schema.children[0]!.id] })
    designer.paste({ nodes: [{ ...name, id: 'p-copy-2' }] })
    expect(designer.schema.children.map(node => node.id).indexOf(name.id)).toBe(2)
  })
})
