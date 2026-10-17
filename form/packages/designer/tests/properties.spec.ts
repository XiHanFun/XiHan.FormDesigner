import type { ContainerNode, FieldNode, FormDocument } from '@xihan-form/core'
import { applyOperations, createDocument, createFormModel, createNode, validateDocument } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { describe, expect, it } from 'vitest'
import { propertyErrors, propertyOperations, propertyView } from '../src/properties'

const registry = createFormModel().registry

function sample(): { document: FormDocument, name: FieldNode, age: FieldNode, grid: ContainerNode } {
  const ids = createIdAllocator('p')
  const name = createNode(registry, 'text', ids, { key: 'name' }) as FieldNode
  const age = createNode(registry, 'number', ids, { key: 'age' }) as FieldNode
  const grid = createNode(registry, 'grid', ids) as ContainerNode
  return { document: { ...createDocument(), children: [name, age, grid] }, name, age, grid }
}

describe('propertyView', () => {
  it('什么都没选时编辑表单设置', () => {
    const { document } = sample()
    const view = propertyView(document, registry, { nodes: [] })
    expect(view.scope).toBe('settings')
    expect(view.targets).toHaveLength(1)
    expect(view.targets[0]!.value).toBe(document.settings)
    expect(view.targets[0]!.descriptors.map(descriptor => descriptor.path)).toContainEqual(['labelPlacement'])
    expect(view.names.get(view.targets[0]!.descriptors[0]!)).toEqual({ kind: '', group: 'settings', name: 'labelPlacement' })
  })

  it('选中一个节点：数据键排在最前，其余路径带分组前缀', () => {
    const { document, name } = sample()
    const view = propertyView(document, registry, { nodes: [name.id] })
    const [target] = view.targets
    expect(view.scope).toBe('nodes')
    expect(view.node).toEqual({ kind: 'text', key: 'name' })
    expect(target!.kind).toBe('text')
    expect(target!.descriptors[0]).toMatchObject({ path: ['key'], group: 'basic', required: true })
    const label = target!.descriptors.find(descriptor => descriptor.path.join('.') === 'basic.label')!
    expect(label.group).toBe('basic')
    expect(view.names.get(label)).toEqual({ kind: 'text', group: 'basic', name: 'label' })
    expect(target!.value).toMatchObject({ key: 'name', basic: name.basic, data: name.data, appearance: name.appearance })
  })

  it('选中多个节点时不列数据键', () => {
    const { document, name, age } = sample()
    const view = propertyView(document, registry, { nodes: [name.id, age.id] })
    expect(view.node).toBeUndefined()
    expect(view.targets.every(target => target.descriptors.every(descriptor => descriptor.path[0] !== 'key'))).toBe(true)
  })

  it('选中区域时编辑区域属性，对象种类为 region', () => {
    const { document, grid } = sample()
    const view = propertyView(document, registry, { nodes: [], regions: [grid.regions[0]!.id] })
    expect(view.scope).toBe('regions')
    expect(view.container).toBe('grid')
    expect(view.targets[0]).toMatchObject({ kind: 'region', id: grid.regions[0]!.id, value: grid.regions[0]!.props })
    expect(view.targets[0]!.descriptors.map(descriptor => descriptor.path)).toEqual([['span'], ['offset']])
  })
})

describe('propertyOperations', () => {
  it('节点：数据键写 setKey，分组路径对每个节点写 setProperty', () => {
    const refs = [{ kind: 'text', id: 'a' }, { kind: 'number', id: 'b' }]
    expect(propertyOperations('nodes', ['key'], 'x', refs.slice(0, 1))).toEqual([{ type: 'setKey', nodeId: 'a', key: 'x' }])
    expect(propertyOperations('nodes', ['basic', 'label'], '名', refs)).toEqual([
      { type: 'setProperty', nodeId: 'a', group: 'basic', name: 'label', value: '名' },
      { type: 'setProperty', nodeId: 'b', group: 'basic', name: 'label', value: '名' },
    ])
    expect(propertyOperations('nodes', ['label'], 'x', refs)).toEqual([])
    expect(propertyOperations('nodes', ['style', 'label'], 'x', refs)).toEqual([])
  })

  it('区域写 setRegionProperty，表单设置写 setSetting', () => {
    expect(propertyOperations('regions', ['span'], 4, [{ kind: 'region', id: 'r' }])).toEqual([{ type: 'setRegionProperty', regionId: 'r', name: 'span', value: 4 }])
    expect(propertyOperations('settings', ['size'], 'lg', [{ kind: 'settings', id: 'settings' }])).toEqual([{ type: 'setSetting', name: 'size', value: 'lg' }])
  })
})

describe('propertyErrors', () => {
  const message = (issue: { code: string }): string => issue.code

  it('节点属性的问题落在带分组的路径上；落在属性值里面的取到属性这一层', () => {
    const { document, name } = sample()
    const next = applyOperations(document, [
      { type: 'setKey', nodeId: name.id, key: '1bad' },
      { type: 'setProperty', nodeId: name.id, group: 'basic', name: 'hidden', value: 'yes' },
    ]).document
    const view = propertyView(next, registry, { nodes: [name.id] })
    const errors = propertyErrors(next, view, validateDocument(next), message)
    expect(errors).toContainEqual({ target: { kind: 'text', id: name.id }, path: ['key'], message: 'invalid-value' })
    expect(errors).toContainEqual({ target: { kind: 'text', id: name.id }, path: ['basic', 'hidden'], message: 'invalid-type' })
  })

  it('依赖键的问题取到 data.optionDependencies；别的节点的问题不算', () => {
    const ids = createIdAllocator('q')
    const select = createNode(registry, 'select', ids, { key: 'city' }) as FieldNode
    const other = createNode(registry, 'text', ids, { key: '2bad' }) as FieldNode
    const document = applyOperations({ ...createDocument(), children: [select, other] }, [
      { type: 'setProperty', nodeId: select.id, group: 'data', name: 'optionSource', value: 'cities' },
      { type: 'setProperty', nodeId: select.id, group: 'data', name: 'optionDependencies', value: ['missing'] },
    ]).document
    const view = propertyView(document, registry, { nodes: [select.id] })
    const errors = propertyErrors(document, view, validateDocument(document), message)
    expect(errors).toEqual([{ target: { kind: 'select', id: select.id }, path: ['data', 'optionDependencies'], message: 'field.unknownDependency' }])
  })

  it('区域与表单设置的问题去掉前缀后落在属性名上', () => {
    const { document, grid } = sample()
    const region = grid.regions[0]!.id
    const next = applyOperations(document, [
      { type: 'setRegionProperty', regionId: region, name: 'span', value: 99 },
      { type: 'setSetting', name: 'size', value: 'huge' },
    ]).document
    const issues = validateDocument(next)
    const regionView = propertyView(next, registry, { nodes: [], regions: [region] })
    expect(propertyErrors(next, regionView, issues, message)).toEqual([{ target: { kind: 'region', id: region }, path: ['span'], message: 'out-of-range' }])
    const settingsView = propertyView(next, registry, { nodes: [] })
    expect(propertyErrors(next, settingsView, issues, message)).toEqual([{ target: { kind: 'settings', id: 'settings' }, path: ['size'], message: 'invalid-option' }])
  })
})
