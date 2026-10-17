// @vitest-environment jsdom

import type { XhFormDesigner } from '../src'
import { createBuiltinKindRegistry, createDocument, createNode } from '@xihan-form/core'
import { FORM_FIELD_RENDERERS } from '@xihan-form/runtime'
import { CONTAINER_BUILDERS, STATIC_BUILDERS } from '@xihan-form/runtime/design'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { afterEach, expect, it } from 'vitest'
import { defineFormDesigner, FORM_DESIGNER_TAG } from '../src'

// 只调设计器自己的 define，不调 defineXhElements()：宿主按需注册时元素也要都能升级。
defineFormDesigner()

Element.prototype.scrollIntoView ??= function scrollIntoView() {}

afterEach(() => {
  document.body.replaceChildren()
})

/** 子树里没有注册过的 xh-* 元素标签。 */
function unregistered(root: ParentNode): string[] {
  return [...new Set([...root.querySelectorAll('*')].map(element => element.localName).filter(tag => tag.startsWith('xh-') && customElements.get(tag) === undefined))]
}

async function settle(designer: XhFormDesigner): Promise<void> {
  await designer.updateComplete
  for (const element of designer.querySelectorAll('*')) {
    const pending = (element as Element & { updateComplete?: Promise<unknown> }).updateComplete
    if (pending !== undefined)
      await pending
  }
}

it('只调 defineFormDesigner，画布、工具栏、右键菜单、规则页签、零件与预览用到的元素都已注册', async () => {
  const registry = createBuiltinKindRegistry()
  const ids = createIdAllocator('d')
  const children = registry.list()
    .filter(definition => Object.hasOwn(definition.type === 'field' ? FORM_FIELD_RENDERERS : definition.type === 'container' ? CONTAINER_BUILDERS : STATIC_BUILDERS, definition.kind) || (definition.type === 'container' && definition.scope === 'list'))
    .map(definition => createNode(registry, definition.kind, ids))
  const designer = document.createElement(FORM_DESIGNER_TAG)
  designer.schema = { ...createDocument(), children }
  document.body.append(designer)
  await settle(designer)
  const field = children.find(node => node.type === 'field')!
  designer.select({ nodes: [field.id] })
  await settle(designer)
  ;(designer.querySelector('[data-part="inspector-tabs"]') as HTMLElement & { value?: string }).value = 'validation'
  designer.querySelector(`[data-node-id="${field.id}"]`)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
  await settle(designer)
  expect(designer.querySelector('[data-part="node-toolbar"] xh-toolbar')).not.toBeNull()
  expect(unregistered(document)).toEqual([])
  designer.mode = 'preview'
  await settle(designer)
  expect(designer.querySelector('xh-form-renderer')).not.toBeNull()
  expect(unregistered(document)).toEqual([])
})
