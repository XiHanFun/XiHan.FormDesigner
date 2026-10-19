// @vitest-environment jsdom

import type { FieldNode, FormDocument } from '@xihan-form/core'
import type { DesignerIssueItem, XhDesignerJsonEditorElement } from '@xihan-ui/designer-shell'
import type { FormDesignerContext, FormDesignerEventMap, XhFormDesigner } from '../src'
import { createDocument, createFormModel, createNode } from '@xihan-form/core'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS } from '@xihan-form/runtime'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { afterEach, describe, expect, it } from 'vitest'
import { defineFormDesigner, FORM_COMMANDS, FORM_DESIGNER_TAG, FORM_MENU_LAYOUTS } from '../src'

defineXhElements()
defineFormDesigner()

Element.prototype.scrollIntoView ??= function scrollIntoView() {}

const registry = createFormModel().registry
const mounted: Element[] = []

afterEach(() => {
  for (const element of mounted.splice(0))
    element.remove()
})

function sample(): { document: FormDocument, name: FieldNode } {
  const name = createNode(registry, 'text', createIdAllocator('j'), { key: 'name' }) as FieldNode
  return { document: { ...createDocument(), children: [name] }, name }
}

async function mount(setup: (designer: XhFormDesigner) => void = () => {}): Promise<XhFormDesigner> {
  const designer = window.document.createElement(FORM_DESIGNER_TAG)
  designer.autoTour = false
  designer.schema = sample().document
  setup(designer)
  window.document.body.append(designer)
  mounted.push(designer)
  await designer.updateComplete
  return designer
}

function editorOf(designer: XhFormDesigner): XhDesignerJsonEditorElement {
  return designer.querySelector('xh-designer-json-editor')!
}

function apply(designer: XhFormDesigner, value: FormDocument): void {
  editorOf(designer).dispatchEvent(new CustomEvent('json-apply', { detail: { value } }))
}

describe('<xh-form-designer>：JSON 编辑框', () => {
  it('openJsonEditor 写出此刻的整份模板并打开；只读或预览态时编辑框只读', async () => {
    const designer = await mount()
    designer.openJsonEditor()
    const editor = editorOf(designer)
    expect([editor.value, editor.open, editor.readonly]).toEqual([designer.schema, true, false])
    editor.open = false
    designer.readonly = true
    designer.openJsonEditor()
    expect(editor.readonly).toBe(true)
    designer.readonly = false
    designer.mode = 'preview'
    designer.openJsonEditor()
    expect(editor.readonly).toBe(true)
  })

  it('校验与 validate() 同一套，问题带问题列表里的说明；文字不成形时照样给出问题、不抛', async () => {
    const designer = await mount()
    designer.openJsonEditor()
    const validate = editorOf(designer).validate!
    expect(validate(designer.schema as never)).toEqual([])
    const { name } = sample()
    const duplicated = { ...designer.schema, children: [name, { ...name, id: 'j-copy' }] }
    const items: readonly DesignerIssueItem[] = validate(duplicated as never)
    expect(items.map(item => item.issue.code)).toContain('duplicate-key')
    expect(items.find(item => item.issue.code === 'duplicate-key')!.message).toBe(DEFAULT_FORM_DESIGNER_TRANSLATIONS.issue(items.find(item => item.issue.code === 'duplicate-key')!.issue as never))
    expect(validate({ children: 5 }).length).toBeGreaterThan(0)
    expect(validate('not a document').length).toBeGreaterThan(0)
  })

  it('应用：整份换上，作为一步进撤销栈，说明是「编辑 JSON」，撤销回到原来那份；只读时不换', async () => {
    const designer = await mount()
    const before = designer.schema
    const changes: FormDesignerEventMap['schema-change']['detail'][] = []
    designer.addEventListener('schema-change', event => changes.push((event as FormDesignerEventMap['schema-change']).detail))
    const next: FormDocument = { ...createDocument(), children: [createNode(registry, 'number', createIdAllocator('k'), { key: 'age' })] }
    apply(designer, next)
    expect(designer.schema).toEqual(next)
    expect(changes.map(change => [change.kind, change.operations.map(operation => operation.type)])).toEqual([['execute', ['replaceDocument']]])
    expect(designer.historyState.entries.at(-1)!.label).toBe(DEFAULT_FORM_DESIGNER_TRANSLATIONS.history.replaceDocument)
    designer.undo()
    expect(designer.schema).toEqual(before)
    designer.readonly = true
    apply(designer, next)
    expect(designer.schema).toEqual(before)
  })

  it('命令 edit-json（Mod+Shift+J）打开编辑框，排在画布空白处右键菜单的末组', async () => {
    const designer = await mount()
    const command = FORM_COMMANDS.find(item => item.id === 'edit-json')!
    expect(command.shortcut).toEqual(['Mod', 'Shift', 'J'])
    expect(FORM_MENU_LAYOUTS.blank.at(-1)).toEqual(['edit-json'])
    command.run?.({ designer } as FormDesignerContext)
    expect(editorOf(designer).open).toBe(true)
  })
})
