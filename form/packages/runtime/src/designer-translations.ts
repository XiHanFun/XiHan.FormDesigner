/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单设计器的文案键与缺省英文文案：类型放在 runtime，与渲染器的文案同一份语言包，并补进 UI 的 XhTranslationOverrides。

import type { FormSchemaIssue } from '@xihan-form/core'
import { ENGLISH_DESIGNER_LOCALE } from './designer-english'
import { formDesignerTranslations } from './locale/types'

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

/** 表单设计器的缺省文案：英文，与其余语言同一张表组出，种类、属性与选项写可读的名字。 */
export const DEFAULT_FORM_DESIGNER_TRANSLATIONS: FormDesignerTranslations = /* @__PURE__ */ Object.freeze(formDesignerTranslations(ENGLISH_DESIGNER_LOCALE))

declare module '@xihan-ui/web-components' {
  interface XhTranslationOverrides {
    'xh-form-designer'?: Partial<FormDesignerTranslations>
  }
}
