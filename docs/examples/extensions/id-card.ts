/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 扩展示例：新增「身份证号」字段种类，渲染沿用单行文本，规则提醒加上格式校验，工具栏加一条导出命令。

import type { FieldKindDefinition, FormNode, FormSchemaIssue } from '@xihan-form/core'
import type { FormDesignerExtension } from '@xihan-form/designer'
import type { JsonPath } from '@xihan-ui/core/json'
import { BUILTIN_FIELDS } from '@xihan-form/core'
import { FORM_FIELD_RENDERERS } from '@xihan-form/runtime'

const text = BUILTIN_FIELDS.find(definition => definition.kind === 'text')!

// #region kind
/** 身份证号：值是字符串，放在物料的「输入」分类里，属性沿用单行文本的基础与外观。 */
const idCardKind: FieldKindDefinition = {
  type: 'field',
  kind: 'id-card',
  category: 'input',
  element: 'xh-text-field',
  properties: { basic: text.properties.basic, data: [], appearance: text.properties.appearance },
  validations: ['required', 'pattern', 'expression'],
  valueKind: () => 'string',
  emptyValue: () => '',
}
// #endregion kind

// #region rule
/** 身份证号字段没有正则校验时给一条警告；问题码以扩展 id 的末段 `id-card.` 开头。 */
function patternMissing(nodes: readonly FormNode[], path: JsonPath, out: FormSchemaIssue[]): void {
  nodes.forEach((node, index) => {
    const at = [...path, index]
    if (node.type === 'field' && node.kind === 'id-card' && !node.validation.some(rule => rule.kind === 'pattern'))
      out.push({ code: 'id-card.pattern-missing', path: at, target: { kind: 'node', id: node.id }, severity: 'warning' })
    if (node.type === 'container')
      node.regions.forEach((region, r) => patternMissing(region.children, [...at, 'regions', r, 'children'], out))
  })
}
// #endregion rule

// #region extension
export const idCard: FormDesignerExtension = {
  id: 'acme/id-card',
  kinds: [idCardKind],
  // 渲染器按种类名找渲染方式：身份证号就用单行文本的
  fieldRenderers: { 'id-card': FORM_FIELD_RENDERERS.text! },
  rules: [(document) => {
    const issues: FormSchemaIssue[] = []
    patternMissing(document.children, ['children'], issues)
    return issues
  }],
  issueText: issue => (issue.code === 'id-card.pattern-missing' ? '身份证号字段建议加上正则校验' : undefined),
  commands: [{
    id: 'acme/id-card.copy-json',
    label: '复制 JSON',
    placement: ['toolbar'],
    run: ({ designer }) => void navigator.clipboard.writeText(JSON.stringify(designer.schema, null, 2)),
  }],
}
// #endregion extension
