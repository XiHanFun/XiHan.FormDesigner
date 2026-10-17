/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 规则里的表达式参数：用 <xh-expression-input> 编辑，按规则所在节点即时检查，补全可引用的名字与 `$row.` 之后的行内键。

import type { FormDocument, FormNode } from '@xihan-form/core'
import type { FormDesignerTranslations } from '@xihan-form/runtime'
import type { ExpressionCompletion, ExpressionCompletionQuery, ExpressionInputIssue } from '@xihan-ui/core'
import type { JsonValue } from '@xihan-ui/core/json'
import type { DesignerPropertyEditor } from '@xihan-ui/designer-shell'
import type { ExpressionEngine } from '@xihan-ui/expression'
import type { XhExpressionInputElement } from '@xihan-ui/web-components/define'
import { findNode, identifiersAt, listBindings, RUNTIME_VARIABLES } from '@xihan-form/core'
import { createExpressionCheck } from '@xihan-ui/expression'
import { createAuthoredElement } from '@xihan-ui/web-components/authoring'

/** 规则参数里表达式的编辑方式。 */
export const EXPRESSION_CONTROL = 'expression'

/** 表达式编辑器需要的上下文：都是取值函数，编辑器在每次补全与更新时现取。 */
export interface ExpressionEditorSource {
  readonly ownerDocument: Document
  readonly document: () => FormDocument | undefined
  /** 规则所在的节点。 */
  readonly node: () => FormNode | undefined
  readonly engine: () => ExpressionEngine
  readonly translations: () => FormDesignerTranslations
}

function labelOf(node: FormNode): string | undefined {
  const label = node.type === 'field' ? node.basic.label : node.basic.title
  return typeof label === 'string' && label !== '' ? label : undefined
}

/** 某个作用域里的数据键，带上字段标签或列表标题作说明。 */
function scopeCompletions(document: FormDocument, scope: string | null): ExpressionCompletion[] {
  return listBindings(document)
    .filter(binding => binding.scope === scope)
    .map((binding) => {
      const description = labelOf(binding.node)
      return { label: binding.node.key as string, kind: 'variable' as const, ...(description === undefined ? {} : { description }) }
    })
}

/** 节点处可引用的名字：数据键与运行时变量；`$row.` 之后列出所在行的键。 */
export function expressionCompletions(document: FormDocument, nodeId: string, t: FormDesignerTranslations, query: ExpressionCompletionQuery): ExpressionCompletion[] {
  const found = findNode(document, nodeId)
  if (found === undefined)
    return []
  const list = [...found.ancestors].reverse().find(ancestor => ancestor.type === 'container' && typeof ancestor.key === 'string')
  const matches = (item: ExpressionCompletion): boolean => item.label.startsWith(query.word)
  if (query.member !== null)
    return query.member === RUNTIME_VARIABLES.row && list !== undefined ? scopeCompletions(document, list.id).filter(matches) : []
  const roots = scopeCompletions(document, null)
  const names = new Set(roots.map(item => item.label))
  const runtime: Readonly<Record<string, string>> = {
    [RUNTIME_VARIABLES.value]: t.variableValue,
    [RUNTIME_VARIABLES.row]: t.variableRow,
    [RUNTIME_VARIABLES.index]: t.variableIndex,
  }
  const extra = (identifiersAt(document, nodeId) ?? [])
    .filter(name => !names.has(name))
    .map(name => ({ label: name, kind: 'variable' as const, ...(runtime[name] === undefined ? {} : { description: runtime[name] }) }))
  return [...roots, ...extra].filter(matches)
}

function textOf(value: JsonValue | undefined): string {
  return typeof value === 'string' ? value : ''
}

/**
 * 表达式参数的编辑器：非受控的 <xh-expression-input>，输入写回参数，空串写成 undefined；失焦时结束这一步。
 * 外部改了值（如撤销）时把新值写进输入框。检查函数按节点处的名字生成，名字不变时复用。
 */
export function createExpressionEditor(source: ExpressionEditorSource): DesignerPropertyEditor {
  return (context) => {
    const element = createAuthoredElement(source.ownerDocument, 'xh-expression-input', { 'data-xh-part': 'control' }) as XhExpressionInputElement
    element.defaultValue = textOf(context.value)
    element.completions = (query) => {
      const document = source.document()
      const node = source.node()
      return document === undefined || node === undefined ? [] : expressionCompletions(document, node.id, source.translations(), query)
    }
    let current = context
    let syncing = false
    let checkKey: string | undefined
    let checkEngine: ExpressionEngine | undefined
    element.addEventListener('value-change', (event) => {
      event.stopPropagation()
      if (syncing)
        return
      const value = (event as CustomEvent<{ value: string }>).detail.value
      current.setValue(value === '' ? undefined : value)
    })
    for (const type of ['issues-change', 'completion-select', 'open-change'])
      element.addEventListener(type, event => event.stopPropagation())
    element.addEventListener('focusout', (event) => {
      if (!element.contains((event as FocusEvent).relatedTarget as Node | null))
        current.commit()
    })
    const update: NonNullable<ReturnType<DesignerPropertyEditor>['update']> = (next) => {
      current = next
      element.readOnly = next.readonly ? true : undefined
      const document = source.document()
      const node = source.node()
      const names = document === undefined || node === undefined ? [] : identifiersAt(document, node.id) ?? []
      const engine = source.engine()
      const key = names.join('\u0000')
      if (key !== checkKey || engine !== checkEngine) {
        checkKey = key
        checkEngine = engine
        const check = createExpressionCheck(engine, { identifiers: names })
        element.check = (text: string): readonly ExpressionInputIssue[] => check(text)
      }
      const text = textOf(next.value)
      if (!element.isConnected) {
        element.defaultValue = text
      }
      else if (element.currentValue !== text) {
        syncing = true
        try {
          element.setValue(text)
        }
        finally {
          syncing = false
        }
      }
    }
    update(context)
    return { element, update }
  }
}
