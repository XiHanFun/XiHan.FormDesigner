import type { ContainerNode, FieldNode, FormDocument } from '@xihan-form/core'
import { createBuiltinKindRegistry, createDocument, createNode } from '@xihan-form/core'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS } from '@xihan-form/runtime'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { describe, expect, it } from 'vitest'
import { expressionCompletions } from '../src/expression-editor'

const registry = createBuiltinKindRegistry()
const t = DEFAULT_FORM_DESIGNER_TRANSLATIONS

function labelled<N extends FieldNode | ContainerNode>(node: N, basic: Record<string, string>): N {
  return { ...node, basic: { ...node.basic, ...basic } }
}

function sample(): { document: FormDocument, total: FieldNode, price: FieldNode } {
  const ids = createIdAllocator('e')
  const total = labelled(createNode(registry, 'number', ids, { key: 'total' }) as FieldNode, { label: '合计' })
  const price = labelled(createNode(registry, 'number', ids, { key: 'price' }) as FieldNode, { label: '单价' })
  const qty = createNode(registry, 'number', ids, { key: 'qty' }) as FieldNode
  const lines = labelled(createNode(registry, 'subtable', ids, { key: 'lines' }) as ContainerNode, { title: '明细' })
  const filled: ContainerNode = { ...lines, regions: [{ ...lines.regions[0]!, children: [price, qty] }] }
  return { document: { ...createDocument(), children: [total, filled] }, total, price }
}

function query(word: string, member: string | null = null): { source: string, caret: number, word: string, member: string | null } {
  return { source: '', caret: 0, word, member }
}

describe('表达式补全', () => {
  it('顶层字段：数据键带上标签或标题，外加 $value；按光标前的名字筛', () => {
    const { document, total } = sample()
    expect(expressionCompletions(document, total.id, t, query(''))).toEqual([
      { label: 'total', kind: 'variable', description: '合计' },
      { label: 'lines', kind: 'variable', description: '明细' },
      { label: '$value', kind: 'variable', description: t.variableValue },
    ])
    expect(expressionCompletions(document, total.id, t, query('li')).map(item => item.label)).toEqual(['lines'])
  })

  it('行内字段另有 $row 与 $index；$row. 之后列出所在行的键', () => {
    const { document, price } = sample()
    expect(expressionCompletions(document, price.id, t, query('$')).map(item => item.label)).toEqual(['$value', '$row', '$index'])
    expect(expressionCompletions(document, price.id, t, query('', '$row'))).toEqual([
      { label: 'price', kind: 'variable', description: '单价' },
      { label: 'qty', kind: 'variable' },
    ])
    expect(expressionCompletions(document, price.id, t, query('', 'total'))).toEqual([])
  })
})
