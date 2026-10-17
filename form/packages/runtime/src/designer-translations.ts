/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单设计器的文案键与缺省英文文案：类型放在 runtime，与渲染器的文案同一份语言包，并补进 UI 的 XhTranslationOverrides。

import type { FormSchemaIssue } from '@xihan-form/core'

/** 表单设计器的文案：无参的是字符串，带参的是函数。 */
export interface FormDesignerTranslations {
  /** 设计器的可访问名。 */
  readonly label: string
  readonly toolbar: string
  readonly canvas: string
  readonly palette: string
  readonly properties: string
  readonly issues: string
  readonly undo: string
  readonly redo: string
  readonly cut: string
  readonly copy: string
  readonly paste: string
  readonly duplicate: string
  readonly delete: string
  readonly selectParent: string
  readonly moveUp: string
  readonly moveDown: string
  readonly clear: string
  readonly design: string
  readonly preview: string
  readonly previewWidth: string
  readonly widthFull: string
  readonly widthTablet: string
  readonly widthPhone: string
  /** 属性区的三个页签。 */
  readonly propertiesTab: string
  readonly validationTab: string
  readonly linkageTab: string
  /** 画布与区域为空时的提示。 */
  readonly emptyCanvas: string
  readonly emptyRegion: string
  /** 什么都没选时属性区的标题。 */
  readonly settings: string
  /** 画布上选中节点的标签，如「单行文本 · name」。 */
  readonly nodeTag: (kind: string, key: string | undefined) => string
  /** 物料分类名，按种类的 category。 */
  readonly category: (category: string) => string
  /** 种类名，按 kind。 */
  readonly kind: (kind: string) => string
  /** 属性分组名：basic / data / appearance / region / settings。 */
  readonly group: (group: string) => string
  /** 属性名：先按「种类:分组.名」，再按「分组.名」，最后按名查。 */
  readonly property: (kind: string, group: string, name: string) => string
  /** select 选项的文案，按属性名与选项值。 */
  readonly option: (name: string, value: string) => string
  /** 校验规则种类名。 */
  readonly ruleKind: (kind: string) => string
  /** 联动动作名。 */
  readonly linkageAction: (action: string) => string
  readonly addRule: string
  readonly removeRule: string
  readonly ruleMessage: string
  readonly ruleWhen: string
  readonly ruleValue: string
  readonly ruleMin: string
  readonly ruleMax: string
  readonly rulePattern: string
  readonly ruleFlags: string
  readonly ruleExpression: string
  readonly ruleAction: string
  readonly noRules: string
  /** 表格布局的右键菜单。 */
  readonly mergeCells: string
  readonly splitCell: string
  readonly insertRowAbove: string
  readonly insertRowBelow: string
  readonly insertColumnLeft: string
  readonly insertColumnRight: string
  readonly removeRow: string
  readonly removeColumn: string
  /** 问题列表的来源小标签。 */
  readonly sourceStructure: string
  readonly sourceBinding: string
  /** 数据键不在宿主数据模型里。 */
  readonly unboundKey: (key: string) => string
  /** 模板结构问题的说明，按问题码与参数。 */
  readonly issue: (issue: FormSchemaIssue) => string
}

function words(name: string): string {
  const spaced = name.replace(/-/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function param(issue: FormSchemaIssue, key: string): string {
  const value = issue.params?.[key]
  return value === undefined ? '' : String(value)
}

function englishIssue(issue: FormSchemaIssue): string {
  switch (issue.code) {
    case 'required':
      return 'A required value is missing'
    case 'invalid-type':
      return 'The value has the wrong type'
    case 'invalid-value':
      return 'The value is not valid'
    case 'out-of-range':
      return 'The value is out of range'
    case 'not-integer':
      return 'The value must be a whole number'
    case 'invalid-option':
      return 'The value is not one of the allowed options'
    case 'invalid-color':
      return 'The color is not valid'
    case 'empty':
      return 'The value must not be empty'
    case 'unknown-key':
      return 'Unknown property'
    case 'duplicate-key':
      return `The data key ${param(issue, 'key')} is used more than once`
    case 'duplicate-id':
      return `The id ${param(issue, 'id')} is used more than once`
    case 'unknown-control':
      return 'This kind of editor is not registered'
    case 'document.unsupportedVersion':
      return `Unsupported schema version ${param(issue, 'version')}`
    case 'document.tooDeep':
      return `Nodes are nested deeper than ${param(issue, 'max')} levels`
    case 'node.unknownKind':
      return `Unknown kind ${param(issue, 'kind')}`
    case 'node.kindTypeMismatch':
      return `The kind ${param(issue, 'kind')} is not a ${param(issue, 'type')}`
    case 'region.childNotAllowed':
      return `This region does not accept ${param(issue, 'kind')}`
    case 'table.cellOutOfBounds':
      return 'The cell lies outside the table'
    case 'table.cellOverlap':
      return 'The cell overlaps another cell'
    case 'table.cellGap':
      return `The table has an empty slot at row ${param(issue, 'row')}, column ${param(issue, 'column')}`
    case 'rule.notApplicable':
      return `The ${param(issue, 'kind')} rule does not apply to this field`
    case 'rule.boundsMissing':
      return 'Give a minimum, a maximum or both'
    case 'rule.invalidRange':
      return 'The minimum is greater than the maximum'
    case 'rule.invalidPattern':
      return 'The regular expression is not valid'
    case 'linkage.actionNotApplicable':
      return `The ${param(issue, 'action')} action does not apply here`
    case 'expression.invalid':
      return 'The expression is not valid'
    case 'field.dependencyWithoutSource':
      return 'Option dependencies need an option source'
    case 'field.unknownDependency':
      return `No field named ${param(issue, 'key')} to depend on`
    case 'field.selfDependency':
      return 'A field cannot depend on itself'
  }
}

/** 表单设计器的缺省文案。 */
export const DEFAULT_FORM_DESIGNER_TRANSLATIONS: FormDesignerTranslations = Object.freeze({
  label: 'Form designer',
  toolbar: 'Designer actions',
  canvas: 'Canvas',
  palette: 'Components',
  properties: 'Properties',
  issues: 'Issues',
  undo: 'Undo',
  redo: 'Redo',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  duplicate: 'Duplicate',
  delete: 'Delete',
  selectParent: 'Select parent',
  moveUp: 'Move up',
  moveDown: 'Move down',
  clear: 'Clear',
  design: 'Design',
  preview: 'Preview',
  previewWidth: 'Preview width',
  widthFull: 'Full',
  widthTablet: 'Tablet',
  widthPhone: 'Phone',
  propertiesTab: 'Properties',
  validationTab: 'Validation',
  linkageTab: 'Linkage',
  emptyCanvas: 'Drag a component here, or select one and press Enter',
  emptyRegion: 'Drop here',
  settings: 'Form settings',
  nodeTag: (kind: string, key: string | undefined) => (key === undefined ? kind : `${kind} · ${key}`),
  category: words,
  kind: words,
  group: words,
  property: (_kind: string, _group: string, name: string) => words(name),
  option: (_name: string, value: string) => words(value),
  ruleKind: words,
  linkageAction: words,
  addRule: 'Add rule',
  removeRule: 'Remove rule',
  ruleMessage: 'Message',
  ruleWhen: 'When',
  ruleValue: 'Value',
  ruleMin: 'Minimum',
  ruleMax: 'Maximum',
  rulePattern: 'Pattern',
  ruleFlags: 'Flags',
  ruleExpression: 'Expression',
  ruleAction: 'Action',
  noRules: 'No rules',
  mergeCells: 'Merge cells',
  splitCell: 'Split cell',
  insertRowAbove: 'Insert row above',
  insertRowBelow: 'Insert row below',
  insertColumnLeft: 'Insert column left',
  insertColumnRight: 'Insert column right',
  removeRow: 'Delete row',
  removeColumn: 'Delete column',
  sourceStructure: 'Structure',
  sourceBinding: 'Binding',
  unboundKey: (key: string) => `${key} is not in the data model`,
  issue: englishIssue,
})

declare module '@xihan-ui/web-components' {
  interface XhTranslationOverrides {
    'xh-form-designer'?: Partial<FormDesignerTranslations>
  }
}
