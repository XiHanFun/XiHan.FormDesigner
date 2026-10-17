import { createFormModel } from '@xihan-form/core'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS } from '@xihan-form/runtime'
import { describe, expect, it } from 'vitest'
import { dragSubject, paletteGroups, paletteKind, paletteSubject } from '../src/palette'

const registry = createFormModel().registry
const t = DEFAULT_FORM_DESIGNER_TRANSLATIONS

describe('paletteGroups', () => {
  it('按 category 分组，组与组内都按登记顺序；名称取文案', () => {
    const groups = paletteGroups(registry, t)
    expect(groups.map(group => group.id)).toEqual([...new Set(registry.list().map(definition => definition.category))])
    for (const group of groups) {
      expect(group.label).toBe(t.category(group.id))
      expect(group.items.map(item => item.id)).toEqual(registry.list().filter(definition => definition.category === group.id).map(definition => definition.kind))
      expect(group.items.every(item => item.label === t.kind(item.id) && paletteKind(item.payload) === item.id)).toBe(true)
    }
  })
})

describe('dragSubject', () => {
  const owner = {}

  it('物料给出种类；不是表单物料时不认', () => {
    expect(dragSubject({ source: 'palette', id: 'text', payload: { kind: 'text' } }, owner)).toEqual({ kind: 'text' })
    expect(dragSubject({ source: 'palette', id: 'shape', payload: { shape: 'rect' } }, owner)).toBeUndefined()
    expect(dragSubject(null, owner)).toBeUndefined()
  })

  it('物料与 form-clipboard 拖来的片段交出未经检查的内容', () => {
    const clipboard = { nodes: [] }
    expect(paletteSubject({ clipboard })).toEqual({ clipboard })
    expect(dragSubject({ source: 'palette', id: 'contact', payload: { clipboard } }, owner)).toEqual({ clipboard })
    expect(dragSubject({ source: 'form-clipboard', clipboard }, owner)).toEqual({ clipboard })
  })

  it('画布上的节点只在同一个设计器里认', () => {
    expect(dragSubject({ source: 'form-canvas', owner, nodes: ['a', 'b'] }, owner)).toEqual({ nodes: ['a', 'b'] })
    expect(dragSubject({ source: 'form-canvas', owner: {}, nodes: ['a'] }, owner)).toBeUndefined()
  })
})
