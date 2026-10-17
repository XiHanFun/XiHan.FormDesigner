/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 内置容器与静态元素种类：栅格、标签页、卡片、折叠面板、字段组、表格布局、子表单、子表，以及分隔线与说明文字。

import type { TableCell, TableSize } from '@xihan-ui/designer-kit'
import type { ContainerNode } from '../schema'
import type { ContainerKindDefinition, StaticKindDefinition, StructureProblem } from './kinds'
import type { FormPropertyDescriptor } from './properties'
import { checkTableCells } from '@xihan-ui/designer-kit'

const TITLE: FormPropertyDescriptor = { path: ['title'], control: { kind: 'text' }, default: '' }
const HIDDEN: FormPropertyDescriptor = { path: ['hidden'], control: { kind: 'boolean' }, default: false }
const DISABLED: FormPropertyDescriptor = { path: ['disabled'], control: { kind: 'boolean' }, default: false }

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
          problems.push({ code: 'table.cellOutOfBounds', regionId: issue.id })
        break
      }
      case 'out-of-bounds':
        problems.push({ code: 'table.cellOutOfBounds', regionId: issue.id })
        break
      case 'overlap':
        problems.push({ code: 'table.cellOverlap', regionId: issue.id })
        break
      case 'gap':
        problems.push({ code: 'table.cellGap', params: { row: issue.row, column: issue.column } })
        break
    }
  }
  return problems
}

const LIST_DATA: readonly FormPropertyDescriptor[] = [
  { path: ['initialRows'], control: { kind: 'number', integer: true, min: 0, max: 100 }, default: 0 },
  { path: ['movable'], control: { kind: 'boolean' }, default: true },
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
      appearance: [{ path: ['gap'], control: { kind: 'select', options: [{ value: 'xs' }, { value: 'sm' }, { value: 'md' }, { value: 'lg' }, { value: 'xl' }] }, default: 'md' }],
    },
    regionProperties: [
      { path: ['span'], control: { kind: 'number', integer: true, min: 1, max: 12 }, default: 6 },
      { path: ['offset'], control: { kind: 'number', integer: true, min: 0, max: 11 } },
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
      appearance: [{ path: ['multiple'], control: { kind: 'boolean' }, default: true }],
    },
    regionProperties: [TITLE, { path: ['expanded'], control: { kind: 'boolean' }, default: true }],
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
    properties: { basic: [{ path: ['legend'], control: { kind: 'text' }, default: '' }, HIDDEN, DISABLED], data: [], appearance: [] },
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
        { path: ['rows'], control: { kind: 'number', integer: true, min: 1, max: 100 }, default: 2 },
        { path: ['columns'], control: { kind: 'number', integer: true, min: 1, max: 12 }, default: 2 },
        { path: ['bordered'], control: { kind: 'boolean' }, default: true },
      ],
    },
    regionProperties: [
      { path: ['row'], control: { kind: 'number', integer: true, min: 0, max: 99 }, default: 0 },
      { path: ['column'], control: { kind: 'number', integer: true, min: 0, max: 11 }, default: 0 },
      { path: ['rowSpan'], control: { kind: 'number', integer: true, min: 1, max: 100 }, default: 1 },
      { path: ['columnSpan'], control: { kind: 'number', integer: true, min: 1, max: 12 }, default: 1 },
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
    properties: { basic: [{ path: ['label'], control: { kind: 'text' } }, HIDDEN], data: [], appearance: [] },
  },
  {
    type: 'static',
    kind: 'paragraph',
    category: 'static',
    element: 'xh-typography',
    properties: {
      basic: [{ path: ['content'], control: { kind: 'text', multiline: true }, default: '' }, HIDDEN],
      data: [],
      appearance: [{ path: ['size'], control: { kind: 'select', options: [{ value: 'sm' }, { value: 'md' }, { value: 'lg' }] }, default: 'md' }],
    },
  },
  {
    type: 'static',
    kind: 'heading',
    category: 'static',
    element: 'xh-typography',
    properties: {
      basic: [{ path: ['content'], control: { kind: 'text' }, default: '' }, HIDDEN],
      data: [],
      appearance: [{ path: ['level'], control: { kind: 'select', options: [{ value: 2 }, { value: 3 }, { value: 4 }, { value: 5 }, { value: 6 }] }, default: 3 }],
    },
  },
  {
    type: 'static',
    kind: 'alert',
    category: 'static',
    element: 'xh-alert',
    properties: {
      basic: [TITLE, { path: ['content'], control: { kind: 'text', multiline: true }, default: '' }, HIDDEN],
      data: [],
      appearance: [{ path: ['tone'], control: { kind: 'select', options: [{ value: 'info' }, { value: 'success' }, { value: 'warning' }, { value: 'danger' }, { value: 'neutral' }] }, default: 'info' }],
    },
  },
  {
    type: 'static',
    kind: 'image',
    category: 'static',
    element: 'xh-image',
    properties: {
      basic: [{ path: ['src'], control: { kind: 'text' }, default: '' }, { path: ['alt'], control: { kind: 'text' }, default: '' }, HIDDEN],
      data: [],
      appearance: [{ path: ['width'], control: { kind: 'number', integer: true, min: 16, max: 4096, unit: 'px' } }],
    },
  },
  {
    type: 'static',
    kind: 'barcode',
    category: 'static',
    element: 'xh-bar-code',
    properties: {
      basic: [
        { path: ['value'], control: { kind: 'text' }, default: '' },
        { path: ['format'], control: { kind: 'select', options: [{ value: 'code128' }, { value: 'ean13' }, { value: 'ean8' }, { value: 'upca' }, { value: 'upce' }, { value: 'itf14' }, { value: 'code39' }] }, default: 'code128' },
        HIDDEN,
      ],
      data: [],
      appearance: [{ path: ['showText'], control: { kind: 'boolean' }, default: true }],
    },
  },
  {
    type: 'static',
    kind: 'qrcode',
    category: 'static',
    element: 'xh-matrix-code',
    properties: {
      basic: [
        { path: ['value'], control: { kind: 'text' }, default: '' },
        { path: ['format'], control: { kind: 'select', options: [{ value: 'qr' }, { value: 'data-matrix' }, { value: 'pdf417' }, { value: 'aztec' }] }, default: 'qr' },
        HIDDEN,
      ],
      data: [],
      appearance: [],
    },
  },
]
