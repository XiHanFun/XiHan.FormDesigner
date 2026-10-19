import type { ContainerNode, FieldNode, FormDocument } from '@xihan-form/core'
import type { FormDesignerTranslations } from '@xihan-form/runtime'
import { createDocument, createFormModel, createNode } from '@xihan-form/core'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS } from '@xihan-form/runtime'
import { formZhCN } from '@xihan-form/runtime/locale'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { describe, expect, it } from 'vitest'
import { createFormEditor, describeFormOperations } from '../src'

const registry = createFormModel().registry
const ZH = formZhCN.translations!['xh-form-designer'] as FormDesignerTranslations

function sample() {
  const ids = createIdAllocator('s')
  const name = createNode(registry, 'text', ids, { key: 'name' }) as FieldNode
  const age = createNode(registry, 'number', ids, { key: 'age' }) as FieldNode
  const card = createNode(registry, 'card', ids) as ContainerNode
  const grid = createNode(registry, 'grid', ids) as ContainerNode
  const tabs = createNode(registry, 'tabs', ids) as ContainerNode
  const document: FormDocument = { ...createDocument(), children: [name, age, card, grid, tabs] }
  return { document, name, age, card, grid, tabs }
}

/** 带说明的编辑模型；use 换语言，换了以后已有步骤的说明跟着变。 */
function labeled(document: FormDocument) {
  let translations: FormDesignerTranslations = DEFAULT_FORM_DESIGNER_TRANSLATIONS
  const editor = createFormEditor({ document, describe: describeFormOperations(() => translations) })
  return {
    editor,
    use: (next: FormDesignerTranslations) => {
      translations = next
    },
  }
}

describe('撤销历史的说明', () => {
  it('节点：一个写「种类 · 数据键」，几个写个数；换语言后已有的说明跟着变', () => {
    const { document, name, age, card } = sample()
    const { editor, use } = labeled(document)
    editor.select({ nodes: [name.id] })
    editor.deleteSelection()
    expect(editor.history.undoLabel).toBe('Delete “Single-line text · name”')
    use(ZH)
    expect(editor.history.undoLabel).toBe('删除「单行文本 · name」')
    editor.undo()
    editor.moveNodes([name.id, age.id], { parent: card.regions[0]!.id })
    expect(editor.history.undoLabel).toBe('移动 2 个组件')
    editor.select({ nodes: [name.id, age.id] })
    editor.duplicate()
    expect(editor.history.undoLabel).toBe('添加 2 个组件')
    const added = editor.addNode('number', { parent: null })!
    expect(editor.history.undoLabel).toBe(`添加「数字 · ${added.type === 'field' ? added.key : ''}」`)
    use(DEFAULT_FORM_DESIGNER_TRANSLATIONS)
    expect(editor.history.entries.map(entry => typeof entry.label === 'function' ? entry.label() : entry.label)).toEqual([
      'Move 2 components',
      'Add 2 components',
      `Add “Number · ${added.type === 'field' ? added.key : ''}”`,
    ])
  })

  it('名字取执行那一刻的：之后改了数据键，前一步的说明不变', () => {
    const { document, name, age } = sample()
    const { editor } = labeled(document)
    editor.moveNodes([name.id], { parent: null, index: 2 })
    editor.setKey(name.id, 'fullName')
    editor.select({ nodes: [age.id] })
    editor.deleteSelection()
    expect(editor.history.entries.map(entry => typeof entry.label === 'function' ? entry.label() : entry.label)).toEqual([
      'Move “Single-line text · name”',
      'Change “Data key”',
      'Delete “Number · age”',
    ])
  })

  it('属性、区域属性与表单设置写属性名；一步里改了几个不同的属性时没有说明', () => {
    const { document, name, age, grid } = sample()
    const { editor, use } = labeled(document)
    editor.setProperty(name.id, 'basic', 'label', '姓名')
    expect(editor.history.undoLabel).toBe('Change “Label”')
    editor.setGridSpan(grid.regions[0]!.id, 8)
    expect(editor.history.undoLabel).toBe('Change “Column span”')
    editor.setSetting('labelPlacement', 'start')
    expect(editor.history.undoLabel).toBe('Change “Label position”')
    use(ZH)
    expect(editor.history.undoLabel).toBe('修改「标签位置」')
    editor.execute([
      { type: 'setProperty', nodeId: name.id, group: 'basic', name: 'label', value: '全名' },
      { type: 'setProperty', nodeId: age.id, group: 'basic', name: 'label', value: '年龄' },
    ])
    expect(editor.history.undoLabel).toBe('修改「标签」')
    editor.execute([
      { type: 'setProperty', nodeId: name.id, group: 'basic', name: 'label', value: '名字' },
      { type: 'setProperty', nodeId: name.id, group: 'basic', name: 'placeholder', value: '请输入' },
    ])
    expect(editor.history.undoLabel).toBeUndefined()
    editor.execute([
      { type: 'setProperty', nodeId: name.id, group: 'basic', name: 'label', value: '称呼' },
      { type: 'setKey', nodeId: name.id, key: 'title' },
    ])
    expect(editor.history.undoLabel).toBeUndefined()
  })

  it('规则写校验规则种类或联动动作', () => {
    const { document, name } = sample()
    const { editor } = labeled(document)
    const required = editor.addRule(name.id, 'validation', { kind: 'required' })
    expect(editor.history.undoLabel).toBe('Add rule “Required”')
    editor.updateRule(name.id, 'validation', { ...required, message: '必填' })
    expect(editor.history.undoLabel).toBe('Edit rule “Required”')
    const hide = editor.addRule(name.id, 'linkage', { action: 'hide', when: 'true' })
    expect(editor.history.undoLabel).toBe('Add rule “Hide”')
    editor.addRule(name.id, 'linkage', { action: 'show' }, 0)
    editor.moveRule(name.id, 'linkage', hide.id, 0)
    expect(editor.history.undoLabel).toBe('Move rule “Hide”')
    editor.removeRule(name.id, 'validation', required.id)
    expect(editor.history.undoLabel).toBe('Remove rule “Required”')
  })

  it('区域写所在容器，几个写个数；扩展数据写扩展 id', () => {
    const { document, tabs } = sample()
    const { editor, use } = labeled(document)
    const added = editor.addRegion(tabs.id, undefined, { title: '第三页' })
    expect(editor.history.undoLabel).toBe('Add region to “Tabs”')
    editor.moveRegion(added.id, 0)
    expect(editor.history.undoLabel).toBe('Move region in “Tabs”')
    editor.removeRegion(added.id)
    expect(editor.history.undoLabel).toBe('Delete region from “Tabs”')
    editor.addRegion(tabs.id)
    editor.select({ regions: tabs.regions.map(region => region.id) })
    editor.deleteSelection()
    expect(editor.history.undoLabel).toBe('Delete 2 regions')
    editor.execute([{ type: 'setExtensionData', nodeId: null, id: 'demo', data: { on: true } }])
    use(ZH)
    expect(editor.history.undoLabel).toBe('修改扩展「demo」的数据')
  })

  it('几种操作混在一起时没有说明，调用处给的说明优先', () => {
    const editor = createFormEditor({ document: createDocument(), describe: describeFormOperations(() => DEFAULT_FORM_DESIGNER_TRANSLATIONS) })
    const table = editor.addNode('table') as ContainerNode
    const [a, b] = table.regions
    editor.mergeCells(table.id, [a!.id, b!.id])
    expect(editor.history.undoLabel).toBeUndefined()
    editor.splitCell(table.id, a!.id, { label: () => DEFAULT_FORM_DESIGNER_TRANSLATIONS.splitCell })
    expect(editor.history.undoLabel).toBe('Split cell')
  })
})
