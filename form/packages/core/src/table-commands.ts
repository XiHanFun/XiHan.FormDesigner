/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表格布局的命令：合并、拆分单元格与插入、删除行列。几何由 @xihan-ui/designer-kit 算出，这里只把结果写成编辑操作，由 applyOperations 执行。

import type { IdAllocator, TableAxis, TableCell, TableLinePlan } from '@xihan-ui/designer-kit'
import type { FormOperation } from './operations'
import type { ContainerNode, FormDocument, Region } from './schema'
import { planCellMerge, planCellSplit, planTableLineInsert, planTableLineRemove } from '@xihan-ui/designer-kit'
import { FormOperationError } from './operations'
import { tableCells, tableSize } from './registry/builtin-containers'
import { findNode } from './traverse'

const COUNT_PROPERTY: Readonly<Record<TableAxis, 'rows' | 'columns'>> = { row: 'rows', column: 'columns' }
const GEOMETRY: readonly ('row' | 'column' | 'rowSpan' | 'columnSpan')[] = ['row', 'column', 'rowSpan', 'columnSpan']

function requireTable(document: FormDocument, containerId: string): ContainerNode {
  const node = findNode(document, containerId)?.node
  if (node === undefined)
    throw new FormOperationError('XH_FORM_OP_NODE_NOT_FOUND', { nodeId: containerId })
  if (node.type !== 'container' || node.kind !== 'table')
    throw new FormOperationError('XH_FORM_OP_NOT_A_TABLE', { nodeId: containerId })
  return node
}

function newCell(ids: IdAllocator, row: number, column: number): Region {
  return { id: ids.next(), props: { row, column, rowSpan: 1, columnSpan: 1 }, children: [] }
}

/** 把一个单元格从旧几何改成新几何所需的区域属性操作，只写变了的几项。 */
function geometryOperations(before: TableCell, after: TableCell): FormOperation[] {
  return GEOMETRY.filter(name => before[name] !== after[name])
    .map(name => ({ type: 'setRegionProperty', regionId: before.id, name, value: after[name] }))
}

/**
 * 合并单元格：所选单元格必须恰好拼成一个矩形，且矩形里没有未选的单元格。
 * 左上角的单元格扩成整个矩形，其余单元格的子节点依次移进它，再删除这些单元格。
 */
export function mergeTableCells(document: FormDocument, containerId: string, regionIds: readonly string[]): FormOperation[] {
  const table = requireTable(document, containerId)
  const plan = planCellMerge(tableCells(table), regionIds)
  if (!plan.ok) {
    if (plan.code === 'unknown-cell')
      throw new FormOperationError('XH_FORM_OP_REGION_NOT_FOUND', { regionId: plan.id })
    throw new FormOperationError('XH_FORM_OP_INVALID_MERGE')
  }
  const operations: FormOperation[] = [
    { type: 'setRegionProperty', regionId: plan.anchor, name: 'rowSpan', value: plan.rowSpan },
    { type: 'setRegionProperty', regionId: plan.anchor, name: 'columnSpan', value: plan.columnSpan },
  ]
  let filled = table.regions.find(region => region.id === plan.anchor)!.children.length
  for (const regionId of plan.absorbed) {
    for (const child of table.regions.find(region => region.id === regionId)!.children) {
      operations.push({ type: 'moveNode', nodeId: child.id, parent: plan.anchor, index: filled })
      filled += 1
    }
    operations.push({ type: 'removeRegion', regionId })
  }
  return operations
}

/** 拆分单元格：跨行跨列都还原成 1，空出来的位置按行优先补上新的空单元格，紧跟在原单元格之后。 */
export function splitTableCell(document: FormDocument, containerId: string, regionId: string, ids: IdAllocator): FormOperation[] {
  const table = requireTable(document, containerId)
  const index = table.regions.findIndex(region => region.id === regionId)
  if (index === -1)
    throw new FormOperationError('XH_FORM_OP_REGION_NOT_FOUND', { regionId })
  const cell = tableCells(table)[index]!
  const positions = planCellSplit(cell)
  if (positions.length === 0)
    throw new FormOperationError('XH_FORM_OP_INVALID_SPLIT', { regionId })
  const operations = geometryOperations(cell, { ...cell, rowSpan: 1, columnSpan: 1 })
  positions.forEach((position, offset) => {
    operations.push({ type: 'insertRegion', containerId, index: index + offset + 1, region: newCell(ids, position.row, position.column) })
  })
  return operations
}

/** 把增删行列的计划按单元格原有顺序写成区域操作：改几何、删区域。 */
function lineOperations(cells: readonly TableCell[], plan: TableLinePlan): FormOperation[] {
  const updates = new Map(plan.updates.map(cell => [cell.id, cell]))
  const removed = new Set(plan.removed)
  return cells.flatMap((cell): FormOperation[] => {
    if (removed.has(cell.id))
      return [{ type: 'removeRegion', regionId: cell.id }]
    const next = updates.get(cell.id)
    return next === undefined ? [] : geometryOperations(cell, next)
  })
}

/**
 * 在第 `at` 行（或列）之前插入一整行（列），`at` 等于行数时追加在末尾。
 * 跨过插入位置的单元格随之加长，其后的单元格整体后移，没被覆盖的位置补上新的空单元格。
 */
export function insertTableLine(document: FormDocument, containerId: string, axis: TableAxis, at: number, ids: IdAllocator): FormOperation[] {
  const table = requireTable(document, containerId)
  const size = tableSize(table)
  const count = size[COUNT_PROPERTY[axis]]
  if (!Number.isSafeInteger(at) || at < 0 || at > count)
    throw new FormOperationError('XH_FORM_OP_INDEX_OUT_OF_RANGE', { index: String(at), max: count })
  const cells = tableCells(table)
  const plan = planTableLineInsert(size, cells, axis, at)
  const operations: FormOperation[] = [
    { type: 'setProperty', nodeId: containerId, group: 'appearance', name: COUNT_PROPERTY[axis], value: count + 1 },
    ...lineOperations(cells, plan),
  ]
  plan.added.forEach((position, offset) => {
    operations.push({ type: 'insertRegion', containerId, index: table.regions.length + offset, region: newCell(ids, position.row, position.column) })
  })
  return operations
}

/** 删除第 `at` 行（或列）：只占这一行（列）的单元格删除，跨过它的单元格缩短，其后的单元格前移；表格至少保留一行（列）。 */
export function removeTableLine(document: FormDocument, containerId: string, axis: TableAxis, at: number): FormOperation[] {
  const table = requireTable(document, containerId)
  const size = tableSize(table)
  const count = size[COUNT_PROPERTY[axis]]
  if (!Number.isSafeInteger(at) || at < 0 || at >= count || count <= 1)
    throw new FormOperationError('XH_FORM_OP_INDEX_OUT_OF_RANGE', { index: String(at), max: count - 1 })
  const cells = tableCells(table)
  const plan = planTableLineRemove(size, cells, axis, at)
  return [
    ...lineOperations(cells, plan),
    { type: 'setProperty', nodeId: containerId, group: 'appearance', name: COUNT_PROPERTY[axis], value: count - 1 },
  ]
}
