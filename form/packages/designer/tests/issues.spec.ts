import type { ContainerNode, FieldNode, FormDocument } from '@xihan-form/core'
import { applyOperations, createDocument, createFormModel, createNode, validateDocument } from '@xihan-form/core'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS } from '@xihan-form/runtime'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { createExpressionEngine } from '@xihan-ui/expression'
import { describe, expect, it } from 'vitest'
import { issueFocus, issueItems, issueMarks } from '../src/issues'

const registry = createFormModel().registry
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
  return validateDocument(document, { expressionEngine: createExpressionEngine() })
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
    expect(of('rule')).toEqual({ selection: { nodes: [name.id] }, path: undefined, rule: { list: 'linkage', id: 'r1', path: ['when'] } })
    expect(of('region')).toEqual({ selection: { nodes: [], regions: [grid.regions[0]!.id] }, path: ['span'] })
    expect(of(undefined)).toEqual({ selection: { nodes: [] }, path: ['size'] })
  })

  it('问题指向的对象已不在文档里时为 undefined', () => {
    expect(issueFocus(createDocument(), { code: 'invalid-value', path: ['children', 0, 'key'], target: { kind: 'node', id: 'gone' } })).toBeUndefined()
  })
})

describe('issueMarks', () => {
  it('节点、区域上的问题标在它自己身上，规则上的问题标在规则所在的节点上；没有对象的问题不标', () => {
    const { document, name, grid } = broken()
    const marks = issueMarks(document, issuesOf(document))
    expect([...marks.nodes]).toEqual([[name.id, 'error']])
    expect([...marks.regions]).toEqual([[grid.regions[0]!.id, 'error']])
    const ruleOnly = issueMarks(document, issuesOf(document).filter(issue => issue.target?.kind === 'rule'))
    expect([...ruleOnly.nodes]).toEqual([[name.id, 'error']])
  })

  it('同一个对象取最严重的一级，先报警告后报错误也是错误；对象已不在文档里的规则不标', () => {
    const { document, name, grid } = broken()
    const region = grid.regions[0]!.id
    const marks = issueMarks(document, [
      { code: 'a', path: [], target: { kind: 'node', id: name.id }, severity: 'warning' },
      { code: 'b', path: [], target: { kind: 'node', id: name.id } },
      { code: 'c', path: [], target: { kind: 'node', id: grid.id }, severity: 'warning' },
      { code: 'd', path: [], target: { kind: 'region', id: region }, severity: 'warning' },
      { code: 'e', path: [], target: { kind: 'rule', id: 'gone' } },
    ])
    expect([...marks.nodes]).toEqual([[name.id, 'error'], [grid.id, 'warning']])
    expect([...marks.regions]).toEqual([[region, 'warning']])
  })
})
