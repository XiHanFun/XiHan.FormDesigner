/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单产品的中文文案，渲染器与设计器共用，内含设计器零件的中文文案：与 UI 的语言包一起交给 mergeXhConfig，再经 setXhConfig 或 <xh-config> 生效。

import type { XhConfig } from '@xihan-ui/web-components'
import type {} from './designer-translations'
import type {} from './translations'
import { designerShellZhCN } from '@xihan-ui/designer-shell/locale'
import { mergeXhConfig } from '@xihan-ui/web-components'
import { formDesignerZhCN } from './designer-zh-cn'

/** 表单渲染器与设计器的中文文案，含 designerShellZhCN。 */
export const formZhCN: XhConfig = /* @__PURE__ */ mergeXhConfig(designerShellZhCN, {
  translations: {
    'xh-form-designer': formDesignerZhCN,
    'xh-form-renderer': {
      errorSummary: (count: number) => `共 ${count} 处需要修改`,
      errorSummaryItem: (label: string, message: string) => `${label}：${message}`,
      optionsEmpty: '暂无选项',
      addRow: '添加一行',
      fileDropzone: '把文件拖到这里，或点击选择',
      fileTrigger: '选择文件',
      valueRequired: '此项必填',
      valueNotAccepted: '请勾选此项',
      valueTooShort: (min: number) => `至少输入 ${min} 个字符`,
      valueTooLong: (max: number) => `最多输入 ${max} 个字符`,
      valueTooSmall: (min: number) => `不能小于 ${min}`,
      valueTooLarge: (max: number) => `不能大于 ${max}`,
      valuePatternMismatch: '格式不正确',
      valueExpressionFalse: '取值不符合要求',
      valueTypeMismatch: '取值类型不正确',
      invalidPattern: '校验用的正则表达式无效',
      expressionFailed: '校验表达式求值失败',
      conditionNotBoolean: '校验表达式的结果不是真或假',
    },
  },
})
