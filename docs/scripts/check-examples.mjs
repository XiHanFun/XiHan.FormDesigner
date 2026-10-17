/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 校验 examples/templates/ 下的示例模板：每个文件导出 schema 与 values，模板不能有任何模板问题，
// 字段的种类都要在内置渲染器的渲染表里（示例要真实渲染），values 里的键都要是模板里的数据键，
// 按模板校验这份数据不能抛错（数据可以不完整，问题照常列出）。

import { readdir, readFile } from 'node:fs/promises'
import process from 'node:process'
import { createFormModel, createInitialValues, scopeKeys, validateDocument, validateValues, walkNodes } from '@xihan-form/core'
import { createExpressionEngine } from '@xihan-ui/expression'

const templatesDir = new URL('../examples/templates/', import.meta.url)

/** 内置字段渲染表 FORM_FIELD_RENDERERS 里的种类名。 */
const renderersSource = await readFile(new URL('../../form/packages/runtime/src/renderer/fields/index.ts', import.meta.url), 'utf8')
const renderable = new Set([...renderersSource.matchAll(/^ {2}'([\w-]+)': /gm)].map(match => match[1]))
if (renderable.size === 0)
  throw new Error('读不出内置字段渲染表')

const failures = []
const files = (await readdir(templatesDir)).filter(name => name.endsWith('.ts')).sort()
for (const name of files) {
  const { schema, values, variables } = await import(new URL(name, templatesDir).href)
  const expressionEngine = createExpressionEngine()
  const issues = validateDocument(schema, { expressionEngine, identifiers: Object.keys(variables ?? {}) })
  if (issues.length > 0) {
    failures.push(`${name}：模板问题 ${issues.map(issue => `${issue.code} @ ${issue.path.join('.')}`).join('，')}`)
    continue
  }
  const unrendered = []
  walkNodes(schema, (node) => {
    if (node.type === 'field' && !renderable.has(node.kind))
      unrendered.push(node.kind)
    return true
  })
  if (unrendered.length > 0) {
    failures.push(`${name}：内置渲染器不渲染的种类 ${[...new Set(unrendered)].join('、')}`)
    continue
  }
  const keys = new Set(scopeKeys(schema, null))
  const unknown = Object.keys(values ?? {}).filter(key => !keys.has(key))
  if (unknown.length > 0) {
    failures.push(`${name}：示例数据里有模板没有的键 ${unknown.join('、')}`)
    continue
  }
  const data = { ...createInitialValues(schema, createFormModel().registry), ...values }
  const found = validateValues(schema, data, { expressionEngine, variables })
  console.log(`${name}：模板无问题，示例数据校验出 ${found.length} 处问题`)
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}
