/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 撤销历史里一步的说明：按这一步的正向操作与应用前的文档写成「动作 + 对象名」。文案在读的时候现取、换语言跟着变，
// 节点的种类与数据键、属性名、规则种类与容器在这一步执行时取好。同一种操作的几处写个数，混合的操作没有说明。

import type { FormDocument, FormNode, FormOperation, LinkageRule, RuleList, ValidationRule } from '@xihan-form/core'
import type { FormDesignerTranslations, FormHistoryTranslations } from '@xihan-form/runtime'
import type { HistoryLabel } from '@xihan-ui/designer-kit'
import { findNode, findRegion } from '@xihan-form/core'

/** 说明里的一个节点：种类与数据键；文档里找不到时种类写 id。 */
interface NodeIdentity {
  readonly kind: string
  readonly key: string | undefined
}

/** 说明里的一条规则：所在列表与种类（校验规则）或动作（联动规则）；找不到时写 id。 */
interface RuleIdentity {
  readonly list: RuleList
  readonly name: string
}

type Operation<K extends FormOperation['type']> = Extract<FormOperation, { type: K }>

function identityOf(node: FormNode | undefined, id: string): NodeIdentity {
  if (node === undefined)
    return { kind: id, key: undefined }
  return { kind: node.kind, key: node.type === 'static' ? undefined : node.key }
}

function nodeIn(document: FormDocument, id: string): NodeIdentity {
  return identityOf(findNode(document, id)?.node, id)
}

function ruleIdentity(list: RuleList, rule: ValidationRule | LinkageRule | undefined, id: string): RuleIdentity {
  if (rule === undefined)
    return { list, name: id }
  return { list, name: list === 'validation' ? (rule as ValidationRule).kind : (rule as LinkageRule).action }
}

function ruleIn(document: FormDocument, nodeId: string, list: RuleList, ruleId: string): RuleIdentity {
  const node = findNode(document, nodeId)?.node
  const rules: readonly (ValidationRule | LinkageRule)[] = node === undefined ? [] : list === 'linkage' ? node.linkage : 'validation' in node ? node.validation : []
  return ruleIdentity(list, rules.find(rule => rule.id === ruleId), ruleId)
}

/** 一组操作是否都是同一种；是的话按那一种收窄。 */
function allOf<K extends FormOperation['type']>(operations: readonly FormOperation[], type: K): operations is readonly Operation<K>[] {
  return operations.every(operation => operation.type === type)
}

/** 几处操作改的是不是同一个名字。 */
function sameName(names: readonly string[]): boolean {
  return new Set(names).size === 1
}

/**
 * 表单编辑模型的 describe：按这一步的正向操作与应用前的文档给出说明，文案经 translations 现取。
 * 节点写「种类 · 数据键」，属性写属性名，规则写规则种类或联动动作，区域写所在容器；同一种操作的几个节点或区域写个数。
 * 几种操作混在一起、改了几个不同的属性或几条规则时返回 undefined。
 */
export function describeFormOperations(translations: () => FormDesignerTranslations): (operations: readonly FormOperation[], before: FormDocument) => HistoryLabel | undefined {
  const say = (pick: (history: FormHistoryTranslations, t: FormDesignerTranslations) => string): HistoryLabel => () => {
    const t = translations()
    return pick(t.history, t)
  }
  const node = ({ kind, key }: NodeIdentity) => (t: FormDesignerTranslations): string => t.nodeTag(kind, key)
  const rule = ({ list, name }: RuleIdentity) => (t: FormDesignerTranslations): string => (list === 'validation' ? t.ruleKind(name) : t.linkageAction(name))
  const nodes = (one: 'addNode' | 'removeNode' | 'moveNode', many: 'addNodes' | 'removeNodes' | 'moveNodes', identities: readonly NodeIdentity[]): HistoryLabel => {
    if (identities.length > 1)
      return say(history => history[many](identities.length))
    const name = node(identities[0]!)
    return say((history, t) => history[one](name(t)))
  }

  return (operations, before) => {
    if (operations.length === 0)
      return undefined
    if (allOf(operations, 'insertNode'))
      return nodes('addNode', 'addNodes', operations.map(operation => identityOf(operation.node, operation.node.id)))
    if (allOf(operations, 'removeNode'))
      return nodes('removeNode', 'removeNodes', operations.map(operation => nodeIn(before, operation.nodeId)))
    if (allOf(operations, 'moveNode'))
      return nodes('moveNode', 'moveNodes', operations.map(operation => nodeIn(before, operation.nodeId)))
    if (allOf(operations, 'setProperty')) {
      const [{ nodeId, group, name }] = operations as readonly [Operation<'setProperty'>]
      const { kind } = nodeIn(before, nodeId)
      return sameName(operations.map(operation => `${operation.group}.${operation.name}`)) ? say((history, t) => history.editProperty(t.property(kind, group, name))) : undefined
    }
    if (allOf(operations, 'setKey')) {
      const { kind } = nodeIn(before, operations[0]!.nodeId)
      return say((history, t) => history.editProperty(t.property(kind, 'basic', 'key')))
    }
    if (allOf(operations, 'setRegionProperty')) {
      const [{ regionId, name }] = operations as readonly [Operation<'setRegionProperty'>]
      const kind = findRegion(before, regionId)?.container.kind ?? ''
      return sameName(operations.map(operation => operation.name)) ? say((history, t) => history.editProperty(t.property(kind, 'region', name))) : undefined
    }
    if (allOf(operations, 'setSetting')) {
      const { name } = operations[0]!
      return sameName(operations.map(operation => operation.name)) ? say((history, t) => history.editProperty(t.property('', 'settings', name))) : undefined
    }
    if (allOf(operations, 'setExtensionData')) {
      const { id } = operations[0]!
      return sameName(operations.map(operation => operation.id)) ? say(history => history.editExtensionData(id)) : undefined
    }
    if (allOf(operations, 'removeRegion') && operations.length > 1)
      return say(history => history.removeRegions(operations.length))
    if (operations.length !== 1)
      return undefined
    const [operation] = operations as readonly [FormOperation]
    switch (operation.type) {
      case 'insertRule': {
        const name = rule(ruleIdentity(operation.list, operation.rule, operation.rule.id))
        return say((history, t) => history.addRule(name(t)))
      }
      case 'replaceRule': {
        const name = rule(ruleIdentity(operation.list, operation.rule, operation.rule.id))
        return say((history, t) => history.editRule(name(t)))
      }
      case 'removeRule': {
        const name = rule(ruleIn(before, operation.nodeId, operation.list, operation.ruleId))
        return say((history, t) => history.removeRule(name(t)))
      }
      case 'moveRule': {
        const name = rule(ruleIn(before, operation.nodeId, operation.list, operation.ruleId))
        return say((history, t) => history.moveRule(name(t)))
      }
      case 'insertRegion': {
        const name = node(nodeIn(before, operation.containerId))
        return say((history, t) => history.addRegion(name(t)))
      }
      case 'removeRegion':
      case 'moveRegion': {
        const container = findRegion(before, operation.regionId)?.container
        const name = node(identityOf(container, operation.regionId))
        return say((history, t) => (operation.type === 'removeRegion' ? history.removeRegion(name(t)) : history.moveRegion(name(t))))
      }
      default:
        return undefined
    }
  }
}
