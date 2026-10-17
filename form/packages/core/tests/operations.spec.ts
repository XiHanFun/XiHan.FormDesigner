import type { FieldNode, FormDocument, FormOperation } from '../src'
import { describe, expect, it } from 'vitest'
import { applyOperation, applyOperations, createNode, FormOperationError, validateDocument } from '../src'
import { containerOf, documentOf, fieldOf, setup, withChildren } from './helpers'

function sample() {
  const { registry, ids } = setup()
  const name = fieldOf(registry, ids, 'text', 'name')
  const age = fieldOf(registry, ids, 'number', 'age')
  const grid = withChildren(containerOf(registry, ids, 'grid'), 0, [age])
  const note = createNode(registry, 'paragraph', ids)
  return { registry, ids, document: documentOf([name, grid, note]), name, age, grid, note }
}

/** 应用后再应用逆操作必须精确回到原文档，逆操作经 JSON 往返后同样成立。 */
function roundTrip(document: FormDocument, operations: readonly FormOperation[]): FormDocument {
  const result = applyOperations(document, operations)
  expect(applyOperations(result.document, result.inverse).document).toEqual(document)
  const serialized = JSON.parse(JSON.stringify(result.inverse)) as FormOperation[]
  expect(applyOperations(result.document, serialized).document).toEqual(document)
  return result.document
}

function errorCode(run: () => unknown): string {
  try {
    run()
  }
  catch (error) {
    if (error instanceof FormOperationError)
      return error.code
    throw error
  }
  throw new Error('预期抛出 FormOperationError')
}

describe('编辑操作：节点', () => {
  it('插入节点并给出删除它的逆操作', () => {
    const { registry, ids, document, grid } = sample()
    const node = fieldOf(registry, ids, 'switch', 'active')
    const result = applyOperation(document, { type: 'insertNode', parent: grid.regions[1]!.id, index: 0, node })
    expect(result.inverse).toEqual([{ type: 'removeNode', nodeId: node.id }])
    expect(validateDocument(result.document)).toEqual([])
    roundTrip(document, [{ type: 'insertNode', parent: null, index: 3, node }])
  })

  it('删除节点，逆操作带着原节点插回原位', () => {
    const { document, age, grid } = sample()
    const result = applyOperation(document, { type: 'removeNode', nodeId: age.id })
    expect(result.inverse).toEqual([{ type: 'insertNode', parent: grid.regions[0]!.id, index: 0, node: age }])
    roundTrip(document, [{ type: 'removeNode', nodeId: grid.id }])
  })

  it('移动节点：跨区域、同一列表内前移后移，逆操作移回原位', () => {
    const { document, name, age, grid, note } = sample()
    const moved = roundTrip(document, [{ type: 'moveNode', nodeId: name.id, parent: grid.regions[0]!.id, index: 1 }])
    expect((moved.children[0] as typeof grid).regions[0]!.children.map(child => child.id)).toEqual([age.id, name.id])
    expect(roundTrip(document, [{ type: 'moveNode', nodeId: name.id, parent: null, index: 2 }]).children.map(child => child.id)).toEqual([grid.id, note.id, name.id])
    expect(roundTrip(document, [{ type: 'moveNode', nodeId: note.id, parent: null, index: 0 }]).children.map(child => child.id)).toEqual([note.id, name.id, grid.id])
  })

  it('不能把容器移进它自己的区域', () => {
    const { registry, ids } = setup()
    const inner = containerOf(registry, ids, 'card')
    const outer = withChildren(containerOf(registry, ids, 'card'), 0, [inner])
    const document = documentOf([outer])
    expect(errorCode(() => applyOperation(document, { type: 'moveNode', nodeId: outer.id, parent: inner.regions[0]!.id, index: 0 }))).toBe('XH_FORM_OP_CYCLE')
    expect(errorCode(() => applyOperation(document, { type: 'moveNode', nodeId: outer.id, parent: outer.regions[0]!.id, index: 0 }))).toBe('XH_FORM_OP_CYCLE')
  })

  it('插入的节点与文档里已有的 id 重复时拒绝，以保证逆操作精确', () => {
    const { registry, ids, document, name, grid } = sample()
    expect(errorCode(() => applyOperation(document, { type: 'insertNode', parent: null, index: 0, node: name }))).toBe('XH_FORM_OP_DUPLICATE_ID')
    const clash = { ...containerOf(registry, ids, 'card'), regions: [{ id: grid.regions[0]!.id, props: {}, children: [] }] }
    expect(errorCode(() => applyOperation(document, { type: 'insertNode', parent: null, index: 0, node: clash }))).toBe('XH_FORM_OP_DUPLICATE_ID')
  })

  it('位置越界、区域或节点不存在', () => {
    const { registry, ids, document, name } = sample()
    const node = fieldOf(registry, ids, 'text', 'x')
    expect(errorCode(() => applyOperation(document, { type: 'insertNode', parent: null, index: 4, node }))).toBe('XH_FORM_OP_INDEX_OUT_OF_RANGE')
    expect(errorCode(() => applyOperation(document, { type: 'insertNode', parent: null, index: -1, node }))).toBe('XH_FORM_OP_INDEX_OUT_OF_RANGE')
    expect(errorCode(() => applyOperation(document, { type: 'insertNode', parent: 'nope', index: 0, node }))).toBe('XH_FORM_OP_REGION_NOT_FOUND')
    expect(errorCode(() => applyOperation(document, { type: 'removeNode', nodeId: 'nope' }))).toBe('XH_FORM_OP_NODE_NOT_FOUND')
    expect(errorCode(() => applyOperation(document, { type: 'moveNode', nodeId: name.id, parent: null, index: 3 }))).toBe('XH_FORM_OP_INDEX_OUT_OF_RANGE')
  })
})

describe('编辑操作：属性、键与设置', () => {
  it('设置与删除属性，逆操作还原旧值或删掉新加的属性', () => {
    const { document, name } = sample()
    const result = applyOperation(document, { type: 'setProperty', nodeId: name.id, group: 'basic', name: 'label', value: '姓名' })
    expect(result.inverse).toEqual([{ type: 'setProperty', nodeId: name.id, group: 'basic', name: 'label', value: '' }])
    expect((result.document.children[0] as FieldNode).basic.label).toBe('姓名')
    const added = applyOperation(document, { type: 'setProperty', nodeId: name.id, group: 'basic', name: 'placeholder', value: '请输入' })
    expect(added.inverse).toEqual([{ type: 'setProperty', nodeId: name.id, group: 'basic', name: 'placeholder' }])
    roundTrip(document, [
      { type: 'setProperty', nodeId: name.id, group: 'basic', name: 'placeholder', value: '请输入' },
      { type: 'setProperty', nodeId: name.id, group: 'basic', name: 'hidden' },
      { type: 'setProperty', nodeId: name.id, group: 'data', name: 'inputType', value: 'email' },
    ])
  })

  it('区域属性与表单设置', () => {
    const { document, grid } = sample()
    roundTrip(document, [
      { type: 'setRegionProperty', regionId: grid.regions[0]!.id, name: 'span', value: 8 },
      { type: 'setRegionProperty', regionId: grid.regions[1]!.id, name: 'offset', value: 2 },
      { type: 'setSetting', name: 'size', value: 'lg' },
      { type: 'setSetting', name: 'readOnly' },
    ])
  })

  it('设置的值与原值相同时返回同一个文档，逆操作为空', () => {
    const { document, name, grid } = sample()
    for (const operation of [
      { type: 'setProperty', nodeId: name.id, group: 'basic', name: 'label', value: '' },
      { type: 'setProperty', nodeId: name.id, group: 'basic', name: 'missing' },
      { type: 'setRegionProperty', regionId: grid.regions[0]!.id, name: 'span', value: 6 },
      { type: 'setSetting', name: 'size', value: 'md' },
      { type: 'setKey', nodeId: name.id, key: 'name' },
      { type: 'moveNode', nodeId: name.id, parent: null, index: 0 },
    ] as FormOperation[]) {
      const result = applyOperation(document, operation)
      expect(result.document).toBe(document)
      expect(result.inverse).toEqual([])
    }
  })

  it('改数据键只对带键的节点', () => {
    const { document, name, grid } = sample()
    roundTrip(document, [{ type: 'setKey', nodeId: name.id, key: 'fullName' }])
    expect(errorCode(() => applyOperation(document, { type: 'setKey', nodeId: grid.id, key: 'x' }))).toBe('XH_FORM_OP_NO_KEY')
  })

  it('属性分组、名字与取值必须合法', () => {
    const { document, name } = sample()
    expect(errorCode(() => applyOperation(document, { type: 'setProperty', nodeId: name.id, group: 'style' as never, name: 'x', value: 1 }))).toBe('XH_FORM_OP_INVALID_PAYLOAD')
    expect(errorCode(() => applyOperation(document, { type: 'setProperty', nodeId: name.id, group: 'basic', name: '', value: 1 }))).toBe('XH_FORM_OP_INVALID_PAYLOAD')
    expect(errorCode(() => applyOperation(document, { type: 'setProperty', nodeId: name.id, group: 'basic', name: 'x', value: Number.NaN }))).toBe('XH_FORM_OP_INVALID_PAYLOAD')
  })
})

describe('编辑操作：规则', () => {
  it('插入、替换、移动、删除规则都能精确撤销', () => {
    const { document, name } = sample()
    const withRules = roundTrip(document, [
      { type: 'insertRule', nodeId: name.id, list: 'validation', index: 0, rule: { id: 'v1', kind: 'required' } },
      { type: 'insertRule', nodeId: name.id, list: 'validation', index: 1, rule: { id: 'v2', kind: 'length', max: 10 } },
      { type: 'insertRule', nodeId: name.id, list: 'linkage', index: 0, rule: { id: 'l1', action: 'hide', when: 'x' } },
    ])
    roundTrip(withRules, [
      { type: 'replaceRule', nodeId: name.id, list: 'validation', rule: { id: 'v2', kind: 'length', max: 20 } },
      { type: 'moveRule', nodeId: name.id, list: 'validation', ruleId: 'v2', index: 0 },
      { type: 'removeRule', nodeId: name.id, list: 'linkage', ruleId: 'l1' },
    ])
    const moved = applyOperation(withRules, { type: 'moveRule', nodeId: name.id, list: 'validation', ruleId: 'v2', index: 0 })
    expect((moved.document.children[0] as FieldNode).validation.map(rule => rule.id)).toEqual(['v2', 'v1'])
    expect(applyOperation(withRules, { type: 'replaceRule', nodeId: name.id, list: 'validation', rule: { id: 'v1', kind: 'required' } }).document).toBe(withRules)
  })

  it('静态元素没有校验规则列表，规则 id 不得重复，找不到规则时报错', () => {
    const { document, name, note } = sample()
    expect(errorCode(() => applyOperation(document, { type: 'insertRule', nodeId: note.id, list: 'validation', index: 0, rule: { id: 'v', kind: 'required' } }))).toBe('XH_FORM_OP_NO_RULE_LIST')
    expect(errorCode(() => applyOperation(document, { type: 'insertRule', nodeId: name.id, list: 'linkage', index: 0, rule: { id: name.id, action: 'hide' } }))).toBe('XH_FORM_OP_DUPLICATE_ID')
    expect(errorCode(() => applyOperation(document, { type: 'removeRule', nodeId: name.id, list: 'validation', ruleId: 'nope' }))).toBe('XH_FORM_OP_RULE_NOT_FOUND')
    expect(errorCode(() => applyOperation(document, { type: 'removeRule', nodeId: name.id, list: 'other' as never, ruleId: 'x' }))).toBe('XH_FORM_OP_INVALID_PAYLOAD')
  })
})

describe('编辑操作：区域', () => {
  it('插入、移动、删除区域都能精确撤销', () => {
    const { document, grid } = sample()
    const region = { id: 'r-new', props: { span: 4 }, children: [] }
    const added = roundTrip(document, [{ type: 'insertRegion', containerId: grid.id, index: 2, region }])
    roundTrip(added, [{ type: 'moveRegion', regionId: 'r-new', index: 0 }, { type: 'removeRegion', regionId: grid.regions[0]!.id }])
  })

  it('只有容器能插入区域', () => {
    const { document, name } = sample()
    expect(errorCode(() => applyOperation(document, { type: 'insertRegion', containerId: name.id, index: 0, region: { id: 'r', props: {}, children: [] } }))).toBe('XH_FORM_OP_NOT_A_CONTAINER')
  })
})

describe('编辑操作：批量与不可变', () => {
  it('批量的逆操作是各操作逆操作按反序拼接', () => {
    const { document, name } = sample()
    const result = applyOperations(document, [
      { type: 'setProperty', nodeId: name.id, group: 'basic', name: 'label', value: 'A' },
      { type: 'setKey', nodeId: name.id, key: 'a' },
    ])
    expect(result.inverse).toEqual([
      { type: 'setKey', nodeId: name.id, key: 'name' },
      { type: 'setProperty', nodeId: name.id, group: 'basic', name: 'label', value: '' },
    ])
  })

  it('批量中途失败时整体抛出，输入文档不变', () => {
    const { document, name } = sample()
    const before = JSON.stringify(document)
    expect(errorCode(() => applyOperations(document, [
      { type: 'setProperty', nodeId: name.id, group: 'basic', name: 'label', value: 'A' },
      { type: 'removeNode', nodeId: 'nope' },
    ]))).toBe('XH_FORM_OP_NODE_NOT_FOUND')
    expect(JSON.stringify(document)).toBe(before)
  })

  it('结果冻结，没被改到的分支保持同一引用', () => {
    const { document, name, grid } = sample()
    const result = applyOperation(document, { type: 'setProperty', nodeId: name.id, group: 'basic', name: 'label', value: 'A' })
    expect(Object.isFrozen(result.document)).toBe(true)
    expect(Object.isFrozen(result.document.children[0])).toBe(true)
    expect(result.document.children[1]).toBe(grid)
  })

  it('插入的载荷被复制，调用方事后改它不影响文档', () => {
    const { registry, ids, document } = sample()
    const node = { ...fieldOf(registry, ids, 'text', 'x'), basic: { label: 'before' } }
    const result = applyOperation(document, { type: 'insertNode', parent: null, index: 0, node })
    node.basic = { label: 'after' }
    expect((result.document.children[0] as FieldNode).basic.label).toBe('before')
  })

  it('未知的操作类型与不是对象的操作', () => {
    const { document } = sample()
    expect(errorCode(() => applyOperation(document, { type: 'explode' } as never))).toBe('XH_FORM_OP_UNKNOWN_TYPE')
    expect(errorCode(() => applyOperation(document, null as never))).toBe('XH_FORM_OP_INVALID_PAYLOAD')
    const error = new FormOperationError('XH_FORM_OP_CYCLE', { nodeId: 'n1' })
    expect(error.message).toBe('XH_FORM_OP_CYCLE')
    expect(error.data).toEqual({ nodeId: 'n1' })
  })
})
