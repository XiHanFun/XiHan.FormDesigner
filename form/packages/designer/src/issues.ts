/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 问题列表的数据：把模板结构问题换成 <xh-designer-issues> 的条目，并算出点开一条问题时要选中什么、聚焦哪个属性。

import type { FormDocument, FormNode, FormSchemaIssue, RuleList } from '@xihan-form/core'
import type { FormDesignerTranslations } from '@xihan-form/runtime'
import type { JsonPath } from '@xihan-ui/core/json'
import type { SchemaIssue } from '@xihan-ui/designer-kit/schema'
import type { DesignerIssueItem } from '@xihan-ui/designer-shell'
import type { FormSelection } from './editor'
import type { PropertyScope } from './properties'
import { findNode, findRegion, walkNodes } from '@xihan-form/core'
import { fieldPath, locations } from './properties'

/**
 * 点开一条问题：选中它所在的节点、区域或表单设置，path 是属性面板上要聚焦的字段；
 * 落在规则上时 rule 给出规则所在的列表、规则 id 与要聚焦的参数。
 */
export interface IssueFocus {
  readonly selection: FormSelection
  readonly path: JsonPath | undefined
  readonly rule?: { readonly list: RuleList, readonly id: string, readonly path: JsonPath | undefined }
}

/** 规则所在的节点。 */
function ruleOwner(document: FormDocument, ruleId: string): FormNode | undefined {
  let owner: FormNode | undefined
  walkNodes(document, (node) => {
    if (owner !== undefined)
      return false
    const rules = [...(node.type === 'static' ? [] : node.validation), ...node.linkage]
    if (rules.some(rule => rule.id === ruleId))
      owner = node
    return owner === undefined
  })
  return owner
}

function tagOf(node: FormNode | undefined, t: FormDesignerTranslations): string | undefined {
  return node === undefined ? undefined : t.nodeTag(node.kind, node.type === 'static' ? undefined : node.key)
}

/** 问题所在对象的名字：节点用种类与键，区域与规则用所在节点的。 */
function subjectOf(document: FormDocument, issue: FormSchemaIssue, t: FormDesignerTranslations): string | undefined {
  const target = issue.target
  switch (target?.kind) {
    case 'node':
      return tagOf(findNode(document, target.id)?.node, t)
    case 'region':
      return tagOf(findRegion(document, target.id)?.container, t)
    case 'rule':
      return tagOf(ruleOwner(document, target.id), t)
    default:
      return undefined
  }
}

/** 问题列表的条目：说明取文案，对象名取种类与键。 */
export function issueItems(document: FormDocument, issues: readonly FormSchemaIssue[], t: FormDesignerTranslations): DesignerIssueItem[] {
  return issues.map((issue) => {
    const subject = subjectOf(document, issue, t)
    return subject === undefined ? { issue, message: t.issue(issue) } : { issue, message: t.issue(issue), subject }
  })
}

/** 落在属性上的问题换成属性面板上的路径；落在别处（如子节点列表）时为 undefined。 */
function focusPath(document: FormDocument, scope: PropertyScope, id: string | undefined, path: JsonPath): JsonPath | undefined {
  const base = scope === 'settings' ? ['settings'] : id === undefined ? undefined : locations(document).get(id)
  if (base === undefined || base.length > path.length || base.some((segment, index) => path[index] !== segment))
    return undefined
  return fieldPath(scope, path.slice(base.length))
}

/** 点开一条问题时要选中什么、聚焦哪个属性；问题指向的对象已不在文档里时为 undefined。 */
export function issueFocus(document: FormDocument, issue: SchemaIssue): IssueFocus | undefined {
  const target = issue.target
  switch (target?.kind) {
    case 'node':
      return findNode(document, target.id) === undefined ? undefined : { selection: { nodes: [target.id] }, path: focusPath(document, 'nodes', target.id, issue.path) }
    case 'region':
      return findRegion(document, target.id) === undefined ? undefined : { selection: { nodes: [], regions: [target.id] }, path: focusPath(document, 'regions', target.id, issue.path) }
    case 'rule': {
      const owner = ruleOwner(document, target.id)
      if (owner === undefined)
        return undefined
      const list: RuleList = owner.linkage.some(rule => rule.id === target.id) ? 'linkage' : 'validation'
      const index = (list === 'linkage' ? owner.linkage : owner.type === 'static' ? [] : owner.validation).findIndex(rule => rule.id === target.id)
      const base = locations(document).get(owner.id)
      const prefix = base === undefined ? undefined : [...base, list, index]
      const field = prefix !== undefined && prefix.every((segment, at) => issue.path[at] === segment) ? issue.path[prefix.length] : undefined
      return { selection: { nodes: [owner.id] }, path: undefined, rule: { list, id: target.id, path: typeof field === 'string' ? [field] : undefined } }
    }
    default:
      return { selection: { nodes: [] }, path: issue.path[0] === 'settings' ? focusPath(document, 'settings', undefined, issue.path) : undefined }
  }
}
