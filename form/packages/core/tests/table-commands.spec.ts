import type { ContainerNode, FormDocument } from '../src'
import { describe, expect, it } from 'vitest'
import { applyOperations, FormOperationError, insertTableLine, mergeTableCells, removeTableLine, splitTableCell, tableCells, validateDocument } from '../src'
import { containerOf, documentOf, fieldOf, setup, withChildren } from './helpers'

function sample() {
  const { registry, ids } = setup()
  const a = fieldOf(registry, ids, 'text', 'a')
  const b = fieldOf(registry, ids, 'text', 'b')
  const table = withChildren(withChildren(containerOf(registry, ids, 'table'), 0, [a]), 1, [b])
  return { registry, ids, document: documentOf([table]), table, a, b }
}

function tableOf(document: FormDocument): ContainerNode {
  return document.children[0] as ContainerNode
}

/** 单元格的 [行, 列, 跨行, 跨列] 按位置排序。 */
function layout(document: FormDocument): number[][] {
  return tableCells(tableOf(document))
    .map(cell => [cell.row, cell.column, cell.rowSpan, cell.columnSpan])
    .sort((x, y) => x[0]! - y[0]! || x[1]! - y[1]!)
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

describe('表格布局：合并与拆分', () => {
  it('合并一行两格：子节点移进左上角，结构仍然合法，能精确撤销', () => {
    const { document, table, a, b } = sample()
    const [first, second] = table.regions
    const result = applyOperations(document, mergeTableCells(document, table.id, [first!.id, second!.id]))
    expect(layout(result.document)).toEqual([[0, 0, 1, 2], [1, 0, 1, 1], [1, 1, 1, 1]])
    expect(tableOf(result.document).regions[0]!.children.map(child => child.id)).toEqual([a.id, b.id])
    expect(validateDocument(result.document)).toEqual([])
    expect(applyOperations(result.document, result.inverse).document).toEqual(document)
  })

  it('合并整张表格后再拆分，回到四个单元格', () => {
    const { ids, document, table } = sample()
    const merged = applyOperations(document, mergeTableCells(document, table.id, table.regions.map(region => region.id))).document
    expect(layout(merged)).toEqual([[0, 0, 2, 2]])
    const anchor = tableOf(merged).regions[0]!.id
    const split = applyOperations(merged, splitTableCell(merged, table.id, anchor, ids))
    expect(layout(split.document)).toEqual([[0, 0, 1, 1], [0, 1, 1, 1], [1, 0, 1, 1], [1, 1, 1, 1]])
    expect(validateDocument(split.document)).toEqual([])
    expect(applyOperations(split.document, split.inverse).document).toEqual(merged)
  })

  it('选中的单元格拼不成矩形时拒绝合并', () => {
    const { document, table } = sample()
    const [first, , , fourth] = table.regions
    expect(errorCode(() => mergeTableCells(document, table.id, [first!.id, fourth!.id]))).toBe('XH_FORM_OP_INVALID_MERGE')
    expect(errorCode(() => mergeTableCells(document, table.id, [first!.id]))).toBe('XH_FORM_OP_INVALID_MERGE')
    expect(errorCode(() => mergeTableCells(document, table.id, [first!.id, 'nope']))).toBe('XH_FORM_OP_REGION_NOT_FOUND')
  })

  it('合并区域里夹着跨格的单元格时拒绝', () => {
    const { ids, document, table } = sample()
    const [first, second] = table.regions
    const wide = applyOperations(document, mergeTableCells(document, table.id, [first!.id, second!.id])).document
    const third = tableOf(wide).regions[1]!
    expect(errorCode(() => mergeTableCells(wide, table.id, [first!.id, third.id]))).toBe('XH_FORM_OP_INVALID_MERGE')
    expect(errorCode(() => splitTableCell(wide, table.id, third.id, ids))).toBe('XH_FORM_OP_INVALID_SPLIT')
  })

  it('只对表格布局生效', () => {
    const { registry, ids } = setup()
    const grid = containerOf(registry, ids, 'grid')
    const document = documentOf([grid])
    expect(errorCode(() => mergeTableCells(document, grid.id, []))).toBe('XH_FORM_OP_NOT_A_TABLE')
    expect(errorCode(() => mergeTableCells(document, 'nope', []))).toBe('XH_FORM_OP_NODE_NOT_FOUND')
  })
})

describe('表格布局：插入与删除行列', () => {
  it('在开头、中间、末尾插入行，结构都合法', () => {
    const { ids, document, table } = sample()
    for (const at of [0, 1, 2]) {
      const result = applyOperations(document, insertTableLine(document, table.id, 'row', at, ids))
      expect(tableOf(result.document).appearance.rows).toBe(3)
      expect(validateDocument(result.document)).toEqual([])
      expect(applyOperations(result.document, result.inverse).document).toEqual(document)
    }
  })

  it('插入位置被跨行单元格覆盖时，该单元格加长，不再补格', () => {
    const { ids, document, table } = sample()
    const [first, , third] = table.regions
    const tall = applyOperations(document, mergeTableCells(document, table.id, [first!.id, third!.id])).document
    const result = applyOperations(tall, insertTableLine(tall, table.id, 'row', 1, ids)).document
    expect(layout(result)).toEqual([[0, 0, 3, 1], [0, 1, 1, 1], [1, 1, 1, 1], [2, 1, 1, 1]])
    expect(validateDocument(result)).toEqual([])
  })

  it('插入列与插入行对称', () => {
    const { ids, document, table } = sample()
    const result = applyOperations(document, insertTableLine(document, table.id, 'column', 1, ids)).document
    expect(layout(result)).toEqual([[0, 0, 1, 1], [0, 1, 1, 1], [0, 2, 1, 1], [1, 0, 1, 1], [1, 1, 1, 1], [1, 2, 1, 1]])
    expect(validateDocument(result)).toEqual([])
  })

  it('删除行：只占这一行的单元格连同节点删除，跨行单元格缩短，能精确撤销', () => {
    const { document, table, b } = sample()
    const result = applyOperations(document, removeTableLine(document, table.id, 'row', 0))
    expect(layout(result.document)).toEqual([[0, 0, 1, 1], [0, 1, 1, 1]])
    expect(JSON.stringify(result.document)).not.toContain(b.id)
    expect(validateDocument(result.document)).toEqual([])
    expect(applyOperations(result.document, result.inverse).document).toEqual(document)
    const [first, , third] = table.regions
    const tall = applyOperations(document, mergeTableCells(document, table.id, [first!.id, third!.id])).document
    expect(layout(applyOperations(tall, removeTableLine(tall, table.id, 'row', 1)).document)).toEqual([[0, 0, 1, 1], [0, 1, 1, 1]])
  })

  it('删除列；表格至少保留一行一列，位置越界时报错', () => {
    const { ids, document, table } = sample()
    const narrow = applyOperations(document, removeTableLine(document, table.id, 'column', 1)).document
    expect(layout(narrow)).toEqual([[0, 0, 1, 1], [1, 0, 1, 1]])
    expect(validateDocument(narrow)).toEqual([])
    expect(errorCode(() => removeTableLine(narrow, table.id, 'column', 0))).toBe('XH_FORM_OP_INDEX_OUT_OF_RANGE')
    expect(errorCode(() => removeTableLine(document, table.id, 'row', 2))).toBe('XH_FORM_OP_INDEX_OUT_OF_RANGE')
    expect(errorCode(() => insertTableLine(document, table.id, 'row', 3, ids))).toBe('XH_FORM_OP_INDEX_OUT_OF_RANGE')
  })
})
