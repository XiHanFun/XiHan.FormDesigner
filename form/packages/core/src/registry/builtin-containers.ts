/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 内置容器与静态元素种类：栅格、标签页、卡片、折叠面板、字段组、表格布局、子表单、子表，以及分隔线与说明文字。

import type { TableCell, TableSize } from '@xihan-ui/designer-kit'
import type { ContainerNode } from '../schema'
import type { ContainerKindDefinition, StaticKindDefinition, StructureProblem } from './kinds'
import type { PropertyDescriptor } from './properties'
import { checkTableCells } from '@xihan-ui/designer-kit'

const TITLE: PropertyDescriptor = { name: 'title', type: 'string', default: '' }
const HIDDEN: PropertyDescriptor = { name: 'hidden', type: 'boolean', default: false }
const DISABLED: PropertyDescriptor = { name: 'disabled', type: 'boolean', default: false }

/** 读表格布局的行数与列数。 */
export function tableSize(node: ContainerNode): TableSize {
  return { rows: node.appearance.rows as number, columns: node.appearance.columns as number }
}

/** 读表格布局的全部单元格，`id` 是单元格区域的 id。 */
export function tableCells(node: ContainerNode): TableCell[] {
  return node.regions.map(region => ({
    id: region.id,
    row: region.props.row as number,
    column: region.props.column as number,
    rowSpan: region.props.rowSpan as number,
    columnSpan: region.props.columnSpan as number,
  }))
}

/** 单元格必须落在表格内、互不重叠且铺满整张表格；位置或跨度不是整数的单元格由属性校验报出，这里跳过。 */
function checkTable(node: ContainerNode): StructureProblem[] {
  const cells = tableCells(node)
  const problems: StructureProblem[] = []
  for (const issue of checkTableCells(tableSize(node), cells)) {
    switch (issue.code) {
      case 'invalid-size':
        return []
      case 'invalid-cell': {
        const cell = cells.find(item => item.id === issue.id)!
        if ([cell.row, cell.column, cell.rowSpan, cell.columnSpan].every(Number.isSafeInteger))
          problems.push({ code: 'XH_FORM_TABLE_CELL_OUT_OF_BOUNDS', regionId: issue.id })
        break
      }
      case 'out-of-bounds':
        problems.push({ code: 'XH_FORM_TABLE_CELL_OUT_OF_BOUNDS', regionId: issue.id })
        break
      case 'overlap':
        problems.push({ code: 'XH_FORM_TABLE_CELL_OVERLAP', regionId: issue.id })
        break
      case 'gap':
        problems.push({ code: 'XH_FORM_TABLE_CELL_GAP', data: { row: issue.row, column: issue.column } })
        break
    }
  }
  return problems
}

const LIST_DATA: readonly PropertyDescriptor[] = [
  { name: 'initialRows', type: 'integer', min: 0, max: 100, default: 0 },
  { name: 'movable', type: 'boolean', default: true },
]

/** 内置容器种类。 */
export const BUILTIN_CONTAINERS: readonly ContainerKindDefinition[] = [
  {
    type: 'container',
    kind: 'grid',
    category: 'layout',
    element: 'xh-grid',
    scope: 'none',
    properties: {
      basic: [HIDDEN, DISABLED],
      data: [],
      appearance: [{ name: 'gap', type: 'enum', choices: ['xs', 'sm', 'md', 'lg', 'xl'], default: 'md' }],
    },
    regionProperties: [
      { name: 'span', type: 'integer', min: 1, max: 12, default: 6 },
      { name: 'offset', type: 'integer', min: 0, max: 11 },
    ],
    regions: { min: 1, max: 12, initial: [{ span: 6 }, { span: 6 }] },
    accepts: 'any',
    validations: [],
  },
  {
    type: 'container',
    kind: 'tabs',
    category: 'layout',
    element: 'xh-tabs',
    scope: 'none',
    properties: { basic: [HIDDEN, DISABLED], data: [], appearance: [] },
    regionProperties: [TITLE],
    regions: { min: 1, max: null, initial: [{ title: '' }, { title: '' }] },
    accepts: 'any',
    validations: [],
  },
  {
    type: 'container',
    kind: 'card',
    category: 'layout',
    element: 'xh-card',
    scope: 'none',
    properties: { basic: [TITLE, HIDDEN, DISABLED], data: [], appearance: [] },
    regionProperties: [],
    regions: { min: 1, max: 1, initial: [{}] },
    accepts: 'any',
    validations: [],
  },
  {
    type: 'container',
    kind: 'collapse',
    category: 'layout',
    element: 'xh-accordion',
    scope: 'none',
    properties: {
      basic: [HIDDEN, DISABLED],
      data: [],
      appearance: [{ name: 'multiple', type: 'boolean', default: true }],
    },
    regionProperties: [TITLE, { name: 'expanded', type: 'boolean', default: true }],
    regions: { min: 1, max: null, initial: [{ title: '', expanded: true }] },
    accepts: 'any',
    validations: [],
  },
  {
    type: 'container',
    kind: 'fieldset',
    category: 'layout',
    element: 'xh-fieldset',
    scope: 'none',
    properties: { basic: [{ name: 'legend', type: 'string', default: '' }, HIDDEN, DISABLED], data: [], appearance: [] },
    regionProperties: [],
    regions: { min: 1, max: 1, initial: [{}] },
    accepts: 'any',
    validations: [],
  },
  {
    type: 'container',
    kind: 'table',
    category: 'layout',
    element: 'xh-grid',
    scope: 'none',
    properties: {
      basic: [HIDDEN, DISABLED],
      data: [],
      appearance: [
        { name: 'rows', type: 'integer', min: 1, max: 100, default: 2 },
        { name: 'columns', type: 'integer', min: 1, max: 12, default: 2 },
        { name: 'bordered', type: 'boolean', default: true },
      ],
    },
    regionProperties: [
      { name: 'row', type: 'integer', min: 0, max: 99, default: 0 },
      { name: 'column', type: 'integer', min: 0, max: 11, default: 0 },
      { name: 'rowSpan', type: 'integer', min: 1, max: 100, default: 1 },
      { name: 'columnSpan', type: 'integer', min: 1, max: 12, default: 1 },
    ],
    regions: {
      min: 1,
      max: null,
      initial: [
        { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
        { row: 0, column: 1, rowSpan: 1, columnSpan: 1 },
        { row: 1, column: 0, rowSpan: 1, columnSpan: 1 },
        { row: 1, column: 1, rowSpan: 1, columnSpan: 1 },
      ],
    },
    accepts: 'any',
    validations: [],
    check: checkTable,
  },
  {
    type: 'container',
    kind: 'subform',
    category: 'data',
    element: 'xh-field-array',
    scope: 'list',
    properties: { basic: [TITLE, HIDDEN, DISABLED], data: LIST_DATA, appearance: [] },
    regionProperties: [],
    regions: { min: 1, max: 1, initial: [{}] },
    accepts: 'any',
    validations: ['required', 'length', 'expression'],
  },
  {
    type: 'container',
    kind: 'subtable',
    category: 'data',
    element: 'xh-field-array',
    scope: 'list',
    properties: { basic: [TITLE, HIDDEN, DISABLED], data: LIST_DATA, appearance: [] },
    regionProperties: [],
    regions: { min: 1, max: 1, initial: [{}] },
    accepts: 'fields',
    validations: ['required', 'length', 'expression'],
  },
]

/** 内置静态元素种类。 */
export const BUILTIN_STATICS: readonly StaticKindDefinition[] = [
  {
    type: 'static',
    kind: 'divider',
    category: 'static',
    element: 'xh-separator',
    properties: { basic: [{ name: 'label', type: 'string' }, HIDDEN], data: [], appearance: [] },
  },
  {
    type: 'static',
    kind: 'paragraph',
    category: 'static',
    element: 'xh-typography',
    properties: {
      basic: [{ name: 'content', type: 'text', default: '' }, HIDDEN],
      data: [],
      appearance: [{ name: 'size', type: 'enum', choices: ['sm', 'md', 'lg'], default: 'md' }],
    },
  },
]
