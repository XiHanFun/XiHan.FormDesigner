import type { ContainerNode, FieldNode, FormDocument } from '@xihan-form/core'
import { applyOperations, createBuiltinKindRegistry, createDocument, createNode, validateDocument } from '@xihan-form/core'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS } from '@xihan-form/runtime'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { createExpressionEngine } from '@xihan-ui/expression'
import { describe, expect, it } from 'vitest'
import { issueFocus, issueItems } from '../src/issues'

const registry = createBuiltinKindRegistry()
const t = DEFAULT_FORM_DESIGNER_TRANSLATIONS

function broken(): { document: FormDocument, name: FieldNode, grid: ContainerNode } {
  const ids = createIdAllocator('i')
  const name = createNode(registry, 'text', ids, { key: 'name' }) as FieldNode
  const grid = createNode(registry, 'grid', ids) as ContainerNode
  const document = applyOperations({ ...createDocument(), children: [name, grid] }, [
    { type: 'setKey', nodeId: name.id, key: '1bad' },
    { type: 'insertRule', nodeId: name.id, list: 'linkage', index: 0, rule: { id: 'r1', action: 'hide', when: 'name +' } },
    { type: 'setRegionProperty', regionId: grid.regions[0]!.id, name: 'span', value: 99 },
    { type: 'setSetting', name: 'size', value: 'huge' },
  ]).document
  return { document, name, grid }
}

function issuesOf(document: FormDocument): ReturnType<typeof validateDocument> {
  return validateDocument(document, registry, { expressionEngine: createExpressionEngine() })
}

describe('issueItems', () => {
  it('说明取文案；对象名：节点用种类与键，区域与规则用所在节点的', () => {
    const { document, grid } = broken()
    const items = issueItems(document, issuesOf(document), t)
    const subject = (kind: string): (string | undefined)[] => items.filter(item => item.issue.target?.kind === kind).map(item => item.subject)
    expect(subject('node')).toEqual([t.nodeTag('text', '1bad')])
    expect(subject('rule')).toEqual([t.nodeTag('text', '1bad')])
    expect(subject('region')).toEqual([t.nodeTag(grid.kind, undefined)])
    expect(items.find(item => item.issue.target === undefined)).toMatchObject({ message: t.issue(issuesOf(document).find(issue => issue.target === undefined)!) })
    expect(items.every(item => item.message !== '')).toBe(true)
  })
})

describe('issueFocus', () => {
  it('点开问题时选中所在对象，并给出属性面板上的路径', () => {
    const { document, name, grid } = broken()
    const issues = issuesOf(document)
    const of = (kind: string | undefined): ReturnType<typeof issueFocus> => issueFocus(document, issues.find(issue => issue.target?.kind === kind)!)
    expect(of('node')).toEqual({ selection: { nodes: [name.id] }, path: ['key'] })
    expect(of('rule')).toEqual({ selection: { nodes: [name.id] }, path: undefined })
    expect(of('region')).toEqual({ selection: { nodes: [], regions: [grid.regions[0]!.id] }, path: ['span'] })
    expect(of(undefined)).toEqual({ selection: { nodes: [] }, path: ['size'] })
  })

  it('问题指向的对象已不在文档里时为 undefined', () => {
    expect(issueFocus(createDocument(), { code: 'invalid-value', path: ['children', 0, 'key'], target: { kind: 'node', id: 'gone' } })).toBeUndefined()
  })
})
