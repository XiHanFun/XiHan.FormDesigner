// @vitest-environment jsdom

import type { FieldNode } from '@xihan-form/core'
import { createBuiltinKindRegistry, createNode } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { describe, expect, it } from 'vitest'
import { CONTAINER_BUILDERS, createFieldShell, issueMessage, STATIC_BUILDERS } from '../src/design'
import { DEFAULT_FORM_RENDERER_TRANSLATIONS } from '../src/translations'

describe('设计态出口', () => {
  it('字段外壳包住控件，标题与提示取节点', () => {
    const registry = createBuiltinKindRegistry()
    const node = createNode(registry, 'text', createIdAllocator('d'), { key: 'name' }) as FieldNode
    const labelled = { ...node, basic: { ...node.basic, label: '姓名', hint: '与证件一致' } }
    const control = document.createElement('input')
    const shell = createFieldShell(document, labelled, control)
    expect(shell.element.tagName).toBe('XH-FIELD')
    expect(control.getAttribute('data-xh-part')).toBe('control')
    expect(shell.element.querySelector('[data-xh-part="label"]')!.textContent).toBe('姓名')
    expect(shell.element.querySelector('[data-xh-part="description"]')!.textContent).toBe('与证件一致')
  })

  it('容器与静态元素的部件树与值问题的文案都能取到', () => {
    expect(Object.keys(CONTAINER_BUILDERS)).toEqual(['grid', 'tabs', 'card', 'collapse', 'fieldset', 'table'])
    expect(Object.keys(STATIC_BUILDERS)).toEqual(['divider', 'paragraph', 'heading', 'alert', 'image', 'barcode', 'qrcode'])
    expect(issueMessage({ code: 'XH_FORM_VALUE_REQUIRED', path: ['a'] }, DEFAULT_FORM_RENDERER_TRANSLATIONS)).toBe('This field is required')
  })
})
