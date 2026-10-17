// @vitest-environment jsdom

import type { FieldNode } from '@xihan-form/core'
import { createFormModel, createNode } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { describe, expect, it } from 'vitest'
import { CONTAINER_BUILDERS, createFieldShell, issueMessage, STATIC_BUILDERS } from '../src/design'
import { DEFAULT_FORM_RENDERER_TRANSLATIONS } from '../src/translations'

describe('设计态出口', () => {
  it('字段外壳只建宿主：标题与提示取节点写到属性上，错误文案常挂，控件写成 slot="control" 放进去', () => {
    const registry = createFormModel().registry
    const node = createNode(registry, 'text', createIdAllocator('d'), { key: 'name' }) as FieldNode
    const labelled = { ...node, basic: { ...node.basic, label: '姓名', hint: '与证件一致' } }
    const control = document.createElement('input')
    const shell = createFieldShell(document, labelled, control)
    const field = shell.element as HTMLElement & { label?: string, description?: string, errorText?: string }
    expect(field.tagName).toBe('XH-FIELD')
    expect([field.label, field.description, field.errorText]).toEqual(['姓名', '与证件一致', ''])
    expect([...field.children]).toEqual([control])
    expect(control.getAttribute('slot')).toBe('control')
    expect(field.querySelector('[data-xh-part]')).toBeNull()
  })

  it('容器与静态元素的部件树与值问题的文案都能取到', () => {
    expect(Object.keys(CONTAINER_BUILDERS)).toEqual(['grid', 'tabs', 'card', 'collapse', 'fieldset', 'table'])
    expect(Object.keys(STATIC_BUILDERS)).toEqual(['divider', 'paragraph', 'heading', 'alert', 'image', 'barcode', 'qrcode'])
    expect(issueMessage({ code: 'XH_FORM_VALUE_REQUIRED', path: ['a'] }, DEFAULT_FORM_RENDERER_TRANSLATIONS)).toBe('This field is required')
  })
})
