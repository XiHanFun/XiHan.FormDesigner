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
  /** 画布的可访问名。 */
  readonly canvas: string
  /** 物料面板的标题。 */
  readonly palette: string
  /** 属性面板的标题。 */
  readonly properties: string
  /** 问题列表的标题。 */
  readonly issues: string
  /** 物料面板头的帮助。 */
  readonly paletteHelp: string
  /** 属性面板头的帮助。 */
  readonly propertiesHelp: string
  /** 问题列表面板头的帮助。 */
  readonly issuesHelp: string
  /** 选中上一级命令。 */
  readonly selectParent: string
  /** 上移命令。 */
  readonly moveUp: string
  /** 下移命令。 */
  readonly moveDown: string
  /** 保存命令。 */
  readonly save: string
  /** 清空命令。 */
  readonly clear: string
  /** 预览宽度这组按钮的可访问名。 */
  readonly previewWidth: string
  /** 全宽。 */
  readonly widthFull: string
  /** 平板宽度。 */
  readonly widthTablet: string
  /** 手机宽度。 */
  readonly widthPhone: string
  /** 状态栏：什么都没选中时写表单里的字段数。 */
  readonly statusFields: (count: number) => string
  /** 状态栏：选中多项时写已选的个数。 */
  readonly statusSelected: (count: number) => string
  /** 顶栏插入钮那一条工具栏的可访问名。 */
  readonly insertToolbar: string
  /** 顶栏插入钮的名字与提示，label 是字段种类的名字。 */
  readonly insertField: (label: string) => string
  /** 属性区的「属性」页签。 */
  readonly propertiesTab: string
  /** 属性区的「校验」页签。 */
  readonly validationTab: string
  /** 属性区的「联动」页签。 */
  readonly linkageTab: string
  /** 画布为空时的提示。 */
  readonly emptyCanvas: string
  /** 区域为空时的提示。 */
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
  /** 新增规则的按钮。 */
  readonly addRule: string
  /** 删除规则的按钮。 */
  readonly removeRule: string
  /** 规则的「提示」输入框。 */
  readonly ruleMessage: string
  /** 联动规则的「条件」输入框。 */
  readonly ruleWhen: string
  /** 联动赋值的「取值」输入框。 */
  readonly ruleValue: string
  /** 规则的「最小值」输入框。 */
  readonly ruleMin: string
  /** 规则的「最大值」输入框。 */
  readonly ruleMax: string
  /** 正则规则的「正则」输入框。 */
  readonly rulePattern: string
  /** 正则规则的「标志」输入框。 */
  readonly ruleFlags: string
  /** 表达式规则的「表达式」输入框。 */
  readonly ruleExpression: string
  /** 联动规则的「动作」选择框。 */
  readonly ruleAction: string
  /** 还没有规则时的提示。 */
  readonly noRules: string
  /** 表达式补全里运行时变量 `$value` 的说明。 */
  readonly variableValue: string
  /** 表达式补全里运行时变量 `$row` 的说明。 */
  readonly variableRow: string
  /** 表达式补全里运行时变量 `$index` 的说明。 */
  readonly variableIndex: string
  /** 表格布局右键菜单：合并单元格。 */
  readonly mergeCells: string
  /** 表格布局右键菜单：拆分单元格。 */
  readonly splitCell: string
  /** 表格布局右键菜单：在上方插入行。 */
  readonly insertRowAbove: string
  /** 表格布局右键菜单：在下方插入行。 */
  readonly insertRowBelow: string
  /** 表格布局右键菜单：在左侧插入列。 */
  readonly insertColumnLeft: string
  /** 表格布局右键菜单：在右侧插入列。 */
  readonly insertColumnRight: string
  /** 表格布局右键菜单：删除行。 */
  readonly removeRow: string
  /** 表格布局右键菜单：删除列。 */
  readonly removeColumn: string
  /** 问题列表里结构问题的来源小标签。 */
  readonly sourceStructure: string
  /** 问题列表里数据绑定问题的来源小标签。 */
  readonly sourceBinding: string
  /** 数据键不在宿主数据模型里。 */
  readonly unboundKey: (key: string) => string
  /** 模板结构问题的说明，按问题码与参数；扩展给出的问题码先取扩展的 issueText，都没有时显示问题码本身。 */
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
    default:
      return issue.code
  }
}

/** 表单设计器的缺省文案。 */
export const DEFAULT_FORM_DESIGNER_TRANSLATIONS: FormDesignerTranslations = Object.freeze({
  label: 'Form designer',
  canvas: 'Canvas',
  palette: 'Components',
  properties: 'Properties',
  issues: 'Issues',
  paletteHelp: 'Drag a component onto the canvas, or click it to add it after the selection.',
  propertiesHelp: 'Edit the selected component or region, with its validation and linkage rules. With nothing selected, edit the form settings.',
  issuesHelp: 'Problems found when checking the form template. Click one to select where it is.',
  selectParent: 'Select parent',
  moveUp: 'Move up',
  moveDown: 'Move down',
  save: 'Save',
  clear: 'Clear',
  previewWidth: 'Preview width',
  widthFull: 'Full',
  widthTablet: 'Tablet',
  widthPhone: 'Phone',
  statusFields: (count: number) => (count === 1 ? '1 field' : `${count} fields`),
  statusSelected: (count: number) => `${count} selected`,
  insertToolbar: 'Insert fields',
  insertField: (label: string) => `Add ${label}`,
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
  variableValue: 'Value of this field or list',
  variableRow: 'Data of the current row',
  variableIndex: 'Index of the current row, from 0',
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
