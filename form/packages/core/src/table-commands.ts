/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表格布局的命令：合并、拆分单元格与插入、删除行列，只产出编辑操作，由 applyOperations 执行。

import type { IdSource } from './ids'
import type { FormOperation } from './operations'
import type { TableCell } from './registry/builtin-containers'
import type { ContainerNode, FormDocument, Region } from './schema'
import { FormOperationError } from './operations'
import { tableCells, tableSize } from './registry/builtin-containers'
import { findNode } from './traverse'

/** 表格的方向：行或列。 */
export type TableAxis = 'row' | 'column'

interface AxisKeys {
  readonly position: 'row' | 'column'
  readonly span: 'rowSpan' | 'columnSpan'
  readonly count: 'rows' | 'columns'
}

const AXES: Readonly<Record<TableAxis, AxisKeys>> = {
  row: { position: 'row', span: 'rowSpan', count: 'rows' },
  column: { position: 'column', span: 'columnSpan', count: 'columns' },
}

function requireTable(document: FormDocument, containerId: string): ContainerNode {
  const node = findNode(document, containerId)?.node
  if (node === undefined)
    throw new FormOperationError('XH_FORM_OP_NODE_NOT_FOUND', { nodeId: containerId })
  if (node.type !== 'container' || node.kind !== 'table')
    throw new FormOperationError('XH_FORM_OP_NOT_A_TABLE', { nodeId: containerId })
  return node
}

function newCell(ids: IdSource, row: number, column: number): Region {
  return { id: ids.nextId(), props: { row, column, rowSpan: 1, columnSpan: 1 }, children: [] }
}

/**
 * 合并单元格：所选单元格必须恰好拼成一个矩形，且矩形里没有未选的单元格。
 * 左上角的单元格扩成整个矩形，其余单元格的子节点依次移进它，再删除这些单元格。
 */
export function mergeTableCells(document: FormDocument, containerId: string, regionIds: readonly string[]): FormOperation[] {
  const table = requireTable(document, containerId)
  const cells = tableCells(table)
  const chosen = new Set(regionIds)
  const selected = cells.filter(cell => chosen.has(cell.regionId))
  if (selected.length !== chosen.size)
    throw new FormOperationError('XH_FORM_OP_REGION_NOT_FOUND', { regionId: [...chosen].find(id => !cells.some(cell => cell.regionId === id)) ?? '' })
  if (selected.length < 2)
    throw new FormOperationError('XH_FORM_OP_INVALID_MERGE')
  const top = Math.min(...selected.map(cell => cell.row))
  const left = Math.min(...selected.map(cell => cell.column))
  const bottom = Math.max(...selected.map(cell => cell.row + cell.rowSpan))
  const right = Math.max(...selected.map(cell => cell.column + cell.columnSpan))
  const area = selected.reduce((sum, cell) => sum + cell.rowSpan * cell.columnSpan, 0)
  const intrudes = (cell: TableCell): boolean => !chosen.has(cell.regionId)
    && cell.row < bottom && cell.row + cell.rowSpan > top && cell.column < right && cell.column + cell.columnSpan > left
  const anchor = selected.find(cell => cell.row === top && cell.column === left)
  if (anchor === undefined || area !== (bottom - top) * (right - left) || cells.some(intrudes))
    throw new FormOperationError('XH_FORM_OP_INVALID_MERGE')
  const operations: FormOperation[] = [
    { type: 'setRegionProperty', regionId: anchor.regionId, name: 'rowSpan', value: bottom - top },
    { type: 'setRegionProperty', regionId: anchor.regionId, name: 'columnSpan', value: right - left },
  ]
  let filled = table.regions.find(region => region.id === anchor.regionId)!.children.length
  for (const region of table.regions) {
    if (region.id === anchor.regionId || !chosen.has(region.id))
      continue
    for (const child of region.children) {
      operations.push({ type: 'moveNode', nodeId: child.id, parent: anchor.regionId, index: filled })
      filled += 1
    }
    operations.push({ type: 'removeRegion', regionId: region.id })
  }
  return operations
}

/** 拆分单元格：跨行跨列都还原成 1，空出来的位置按行优先补上新的空单元格，紧跟在原单元格之后。 */
export function splitTableCell(document: FormDocument, containerId: string, regionId: string, ids: IdSource): FormOperation[] {
  const table = requireTable(document, containerId)
  const index = table.regions.findIndex(region => region.id === regionId)
  if (index === -1)
    throw new FormOperationError('XH_FORM_OP_REGION_NOT_FOUND', { regionId })
  const cell = tableCells(table)[index]!
  if (cell.rowSpan === 1 && cell.columnSpan === 1)
    throw new FormOperationError('XH_FORM_OP_INVALID_SPLIT', { regionId })
  const operations: FormOperation[] = []
  if (cell.rowSpan !== 1)
    operations.push({ type: 'setRegionProperty', regionId, name: 'rowSpan', value: 1 })
  if (cell.columnSpan !== 1)
    operations.push({ type: 'setRegionProperty', regionId, name: 'columnSpan', value: 1 })
  let offset = 1
  for (let row = cell.row; row < cell.row + cell.rowSpan; row += 1) {
    for (let column = cell.column; column < cell.column + cell.columnSpan; column += 1) {
      if (row === cell.row && column === cell.column)
        continue
      operations.push({ type: 'insertRegion', containerId, index: index + offset, region: newCell(ids, row, column) })
      offset += 1
    }
  }
  return operations
}

/**
 * 在第 `at` 行（或列）之前插入一整行（列），`at` 等于行数时追加在末尾。
 * 跨过插入位置的单元格随之加长，其后的单元格整体后移，没被覆盖的位置补上新的空单元格。
 */
export function insertTableLine(document: FormDocument, containerId: string, axis: TableAxis, at: number, ids: IdSource): FormOperation[] {
  const table = requireTable(document, containerId)
  const keys = AXES[axis]
  const other = AXES[axis === 'row' ? 'column' : 'row']
  const size = tableSize(table)
  const count = size[keys.count]
  if (!Number.isSafeInteger(at) || at < 0 || at > count)
    throw new FormOperationError('XH_FORM_OP_INDEX_OUT_OF_RANGE', { index: String(at), max: count })
  const operations: FormOperation[] = [{ type: 'setProperty', nodeId: containerId, group: 'appearance', name: keys.count, value: count + 1 }]
  const covered = new Set<number>()
  for (const cell of tableCells(table)) {
    const position = cell[keys.position]
    if (position >= at) {
      operations.push({ type: 'setRegionProperty', regionId: cell.regionId, name: keys.position, value: position + 1 })
    }
    else if (at < position + cell[keys.span]) {
      operations.push({ type: 'setRegionProperty', regionId: cell.regionId, name: keys.span, value: cell[keys.span] + 1 })
      for (let offset = 0; offset < cell[other.span]; offset += 1)
        covered.add(cell[other.position] + offset)
    }
  }
  let index = table.regions.length
  for (let line = 0; line < size[other.count]; line += 1) {
    if (covered.has(line))
      continue
    const region = axis === 'row' ? newCell(ids, at, line) : newCell(ids, line, at)
    operations.push({ type: 'insertRegion', containerId, index, region })
    index += 1
  }
  return operations
}

/**
 * 删除第 `at` 行（或列）：只占这一行（列）的单元格连同其中的节点一起删除，
 * 跨过它的单元格缩短一格，其后的单元格整体前移。表格至少保留一行一列。
 */
export function removeTableLine(document: FormDocument, containerId: string, axis: TableAxis, at: number): FormOperation[] {
  const table = requireTable(document, containerId)
  const keys = AXES[axis]
  const count = tableSize(table)[keys.count]
  if (!Number.isSafeInteger(at) || at < 0 || at >= count || count <= 1)
    throw new FormOperationError('XH_FORM_OP_INDEX_OUT_OF_RANGE', { index: String(at), max: count - 1 })
  const operations: FormOperation[] = []
  for (const cell of tableCells(table)) {
    const position = cell[keys.position]
    const span = cell[keys.span]
    if (position === at && span === 1)
      operations.push({ type: 'removeRegion', regionId: cell.regionId })
    else if (position <= at && at < position + span)
      operations.push({ type: 'setRegionProperty', regionId: cell.regionId, name: keys.span, value: span - 1 })
    else if (position > at)
      operations.push({ type: 'setRegionProperty', regionId: cell.regionId, name: keys.position, value: position - 1 })
  }
  operations.push({ type: 'setProperty', nodeId: containerId, group: 'appearance', name: keys.count, value: count - 1 })
  return operations
}
