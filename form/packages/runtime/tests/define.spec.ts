// @vitest-environment jsdom

import type { XhFormRenderer } from '../src'
import { createBuiltinKindRegistry, createDocument, createNode } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { afterEach, expect, it } from 'vitest'
import { defineFormRenderer, FORM_FIELD_RENDERERS, FORM_RENDERER_TAG } from '../src'
import { CONTAINER_BUILDERS, STATIC_BUILDERS } from '../src/design'

// 只调渲染器自己的 define，不调 defineXhElements()：宿主按需注册时元素也要都能升级。
defineFormRenderer()

afterEach(() => {
  document.body.replaceChildren()
})

/** 子树里没有注册过的 xh-* 元素标签。 */
function unregistered(root: ParentNode): string[] {
  return [...new Set([...root.querySelectorAll('*')].map(element => element.localName).filter(tag => tag.startsWith('xh-') && customElements.get(tag) === undefined))]
}

it('只调 defineFormRenderer，内置的每种字段、容器与静态元素建出的库内元素都已注册', async () => {
  const registry = createBuiltinKindRegistry()
  const ids = createIdAllocator('d')
  const children = registry.list()
    .filter(definition => Object.hasOwn(definition.type === 'field' ? FORM_FIELD_RENDERERS : definition.type === 'container' ? CONTAINER_BUILDERS : STATIC_BUILDERS, definition.kind) || (definition.type === 'container' && definition.scope === 'list'))
    .map(definition => createNode(registry, definition.kind, ids))
  const renderer = document.createElement(FORM_RENDERER_TAG) as XhFormRenderer
  renderer.schema = { ...createDocument(), children }
  document.body.append(renderer)
  await renderer.updateComplete
  renderer.validate()
  await renderer.updateComplete
  const tags = new Set([...renderer.querySelectorAll('*')].map(element => element.localName).filter(tag => tag.startsWith('xh-')))
  expect(tags.size).toBeGreaterThan(15)
  expect(unregistered(document)).toEqual([])
})
