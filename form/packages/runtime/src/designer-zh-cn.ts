/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单设计器的中文文案：种类、分类、属性、选项、规则与模板结构问题的说法。

import type { FormSchemaIssue } from '@xihan-form/core'
import type { FormDesignerTranslations } from './designer-translations'

const CATEGORIES: Readonly<Record<string, string>> = {
  input: '输入',
  choice: '选择',
  datetime: '日期时间',
  advanced: '高级',
  layout: '布局',
  data: '数据',
  static: '静态',
}

const KINDS: Readonly<Record<string, string>> = {
  'text': '单行文本',
  'textarea': '多行文本',
  'password': '密码',
  'number': '数字',
  'pin': '验证码',
  'select': '下拉选择',
  'combobox': '可输入下拉',
  'cascader': '级联选择',
  'tree-select': '树选择',
  'radio-group': '单选组',
  'checkbox-group': '多选组',
  'toggle-group': '按钮组',
  'transfer': '穿梭框',
  'checkbox': '勾选框',
  'switch': '开关',
  'date': '日期',
  'date-range': '日期范围',
  'time': '时间',
  'time-range': '时间范围',
  'slider': '滑块',
  'rating': '评分',
  'color': '颜色',
  'tags': '标签',
  'file': '文件',
  'signature': '签名',
  'grid': '栅格',
  'tabs': '标签页',
  'card': '卡片',
  'collapse': '折叠面板',
  'fieldset': '分组',
  'table': '表格布局',
  'subform': '子表单',
  'subtable': '子表',
  'divider': '分隔线',
  'paragraph': '段落',
}

const GROUPS: Readonly<Record<string, string>> = {
  basic: '基础',
  data: '数据',
  appearance: '外观',
  region: '区域',
  settings: '表单',
}

const PROPERTIES: Readonly<Record<string, string>> = {
  key: '数据键',
  label: '标签',
  hint: '提示',
  placeholder: '占位符',
  initialValue: '初始值',
  hidden: '隐藏',
  disabled: '禁用',
  readOnly: '只读',
  labelHidden: '隐藏标签',
  size: '尺寸',
  options: '选项',
  optionSource: '选项来源',
  optionDependencies: '选项依赖',
  multiple: '多选',
  orientation: '排列方向',
  inputType: '输入类型',
  minRows: '最少行数',
  maxRows: '最多行数',
  step: '步长',
  precision: '小数位数',
  length: '位数',
  mask: '遮挡输入',
  withTime: '带时间',
  withSeconds: '带秒',
  min: '最小值',
  max: '最大值',
  range: '区间',
  count: '星数',
  allowHalf: '允许半星',
  format: '格式',
  accept: '允许的类型',
  maxFiles: '最多文件数',
  uploadTarget: '上传位置',
  title: '标题',
  legend: '分组标题',
  content: '内容',
  gap: '间距',
  span: '跨列',
  offset: '左侧留空',
  expanded: '默认展开',
  rows: '行数',
  columns: '列数',
  bordered: '显示格线',
  row: '行',
  column: '列',
  rowSpan: '跨行',
  columnSpan: '跨列',
  initialRows: '初始行数',
  movable: '可调整行序',
  labelPlacement: '标签位置',
}

const OPTIONS: Readonly<Record<string, string>> = {
  'size.sm': '小',
  'size.md': '中',
  'size.lg': '大',
  'gap.xs': '极小',
  'gap.sm': '小',
  'gap.md': '中',
  'gap.lg': '大',
  'gap.xl': '极大',
  'orientation.horizontal': '横排',
  'orientation.vertical': '竖排',
  'labelPlacement.top': '上方',
  'labelPlacement.start': '左侧',
  'inputType.text': '文本',
  'inputType.email': '邮箱',
  'inputType.tel': '电话',
  'inputType.url': '网址',
}

const RULE_KINDS: Readonly<Record<string, string>> = {
  required: '必填',
  accepted: '必须勾选',
  length: '长度',
  range: '范围',
  pattern: '正则',
  expression: '表达式',
}

const LINKAGE_ACTIONS: Readonly<Record<string, string>> = {
  show: '显示',
  hide: '隐藏',
  enable: '启用',
  disable: '禁用',
  require: '必填',
  optional: '选填',
  assign: '赋值',
}

function param(issue: FormSchemaIssue, key: string): string {
  const value = issue.params?.[key]
  return value === undefined ? '' : String(value)
}

function kindName(kind: string): string {
  return KINDS[kind] ?? kind
}

function issue(found: FormSchemaIssue): string {
  switch (found.code) {
    case 'required':
      return '缺少必填的值'
    case 'invalid-type':
      return '取值类型不对'
    case 'invalid-value':
      return '取值无效'
    case 'out-of-range':
      return '取值超出范围'
    case 'not-integer':
      return '必须是整数'
    case 'invalid-option':
      return '不是可选的值'
    case 'invalid-color':
      return '颜色无效'
    case 'empty':
      return '不能为空'
    case 'unknown-key':
      return '未定义的属性'
    case 'duplicate-key':
      return `数据键 ${param(found, 'key')} 重复`
    case 'duplicate-id':
      return `id ${param(found, 'id')} 重复`
    case 'document.unsupportedVersion':
      return `不支持的模板版本 ${param(found, 'version')}`
    case 'document.tooDeep':
      return `嵌套超过 ${param(found, 'max')} 层`
    case 'node.unknownKind':
      return `未登记的种类 ${param(found, 'kind')}`
    case 'node.kindTypeMismatch':
      return `种类 ${kindName(param(found, 'kind'))} 与节点类型不符`
    case 'region.childNotAllowed':
      return `这里不能放${kindName(param(found, 'kind'))}`
    case 'table.cellOutOfBounds':
      return '单元格超出表格'
    case 'table.cellOverlap':
      return '单元格与其它单元格重叠'
    case 'table.cellGap':
      return `表格第 ${Number(param(found, 'row')) + 1} 行第 ${Number(param(found, 'column')) + 1} 列空着`
    case 'rule.notApplicable':
      return `${RULE_KINDS[param(found, 'kind')] ?? param(found, 'kind')}规则不适用于这个字段`
    case 'rule.boundsMissing':
      return '最小值、最大值至少给一个'
    case 'rule.invalidRange':
      return '最小值大于最大值'
    case 'rule.invalidPattern':
      return '正则表达式无效'
    case 'linkage.actionNotApplicable':
      return `「${LINKAGE_ACTIONS[param(found, 'action')] ?? param(found, 'action')}」不适用于这里`
    case 'expression.invalid':
      return '表达式有误'
    case 'field.dependencyWithoutSource':
      return '声明了选项依赖，但没有选项来源'
    case 'field.unknownDependency':
      return `找不到依赖的字段 ${param(found, 'key')}`
    case 'field.selfDependency':
      return '字段不能依赖自己'
  }
}

/** 表单设计器的中文文案。 */
export const formDesignerZhCN: FormDesignerTranslations = {
  label: '表单设计器',
  toolbar: '设计器操作',
  canvas: '画布',
  palette: '物料',
  properties: '属性',
  issues: '问题',
  undo: '撤销',
  redo: '重做',
  cut: '剪切',
  copy: '复制',
  paste: '粘贴',
  duplicate: '再制',
  delete: '删除',
  selectParent: '选中上一级',
  moveUp: '上移',
  moveDown: '下移',
  clear: '清空',
  design: '设计',
  preview: '预览',
  previewWidth: '预览宽度',
  widthFull: '全宽',
  widthTablet: '平板',
  widthPhone: '手机',
  propertiesTab: '属性',
  validationTab: '校验规则',
  linkageTab: '联动规则',
  emptyCanvas: '从物料拖入字段，或选中物料后按回车',
  emptyRegion: '拖到这里',
  settings: '表单设置',
  nodeTag: (kind: string, key: string | undefined) => (key === undefined ? kindName(kind) : `${kindName(kind)} · ${key}`),
  category: (category: string) => CATEGORIES[category] ?? category,
  kind: kindName,
  group: (group: string) => GROUPS[group] ?? group,
  property: (kind: string, group: string, name: string) => PROPERTIES[`${kind}:${group}.${name}`] ?? PROPERTIES[`${group}.${name}`] ?? PROPERTIES[name] ?? name,
  option: (name: string, value: string) => OPTIONS[`${name}.${value}`] ?? value,
  ruleKind: (kind: string) => RULE_KINDS[kind] ?? kind,
  linkageAction: (action: string) => LINKAGE_ACTIONS[action] ?? action,
  addRule: '添加规则',
  removeRule: '删除规则',
  ruleMessage: '提示文案',
  ruleWhen: '条件',
  ruleValue: '赋值表达式',
  ruleMin: '最小值',
  ruleMax: '最大值',
  rulePattern: '正则',
  ruleFlags: '修饰符',
  ruleExpression: '表达式',
  ruleAction: '动作',
  noRules: '还没有规则',
  mergeCells: '合并单元格',
  splitCell: '拆分单元格',
  insertRowAbove: '上方插入行',
  insertRowBelow: '下方插入行',
  insertColumnLeft: '左侧插入列',
  insertColumnRight: '右侧插入列',
  removeRow: '删除行',
  removeColumn: '删除列',
  sourceStructure: '结构',
  sourceBinding: '绑定',
  unboundKey: (key: string) => `数据键 ${key} 不在数据模型里`,
  issue,
}
