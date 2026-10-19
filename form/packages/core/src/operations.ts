/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 编辑操作：对文档做最小粒度的不可变修改，并给出能精确撤销的逆操作。

import type { JsonObject, JsonValue } from '@xihan-ui/core/json'
import type { ContainerNode, ExtensionData, FormDocument, FormNode, LinkageRule, PropertyBag, PropertyGroup, Region, ValidationRule } from './schema'
import { cloneJson, deepFreeze, isJsonValue, isPlainObject, jsonEquals } from '@xihan-ui/core/json'
import { applyInSequence } from '@xihan-ui/designer-kit'
import { PROPERTY_GROUPS } from './schema'
import { collectDocumentIds, collectIds } from './traverse'

/** 规则所在的列表。 */
export type RuleList = 'validation' | 'linkage'

/**
 * 编辑操作。`parent` 是区域 id，`null` 表示文档顶层；`index` 是操作完成后的位置。
 * `value` 缺省表示删除该属性。所有操作都是普通数据，可以 JSON 序列化。
 * `setExtensionData` 写某个扩展在文档（`nodeId` 为 `null`）或节点上的数据，`data` 缺省表示去掉这一块。
 * `replaceDocument` 整份换上另一份文档（如在 JSON 编辑框里改完应用），逆操作是换回原来那一份；换上的文档只查形状与 id 不重复，
 * 内容由调用方先用 `validateDocument` 校验。
 */
export type FormOperation
  = | { readonly type: 'insertNode', readonly parent: string | null, readonly index: number, readonly node: FormNode }
    | { readonly type: 'removeNode', readonly nodeId: string }
    | { readonly type: 'moveNode', readonly nodeId: string, readonly parent: string | null, readonly index: number }
    | { readonly type: 'setProperty', readonly nodeId: string, readonly group: PropertyGroup, readonly name: string, readonly value?: JsonValue }
    | { readonly type: 'setRegionProperty', readonly regionId: string, readonly name: string, readonly value?: JsonValue }
    | { readonly type: 'setSetting', readonly name: string, readonly value?: JsonValue }
    | { readonly type: 'setKey', readonly nodeId: string, readonly key: string }
    | { readonly type: 'insertRule', readonly nodeId: string, readonly list: RuleList, readonly index: number, readonly rule: ValidationRule | LinkageRule }
    | { readonly type: 'removeRule', readonly nodeId: string, readonly list: RuleList, readonly ruleId: string }
    | { readonly type: 'replaceRule', readonly nodeId: string, readonly list: RuleList, readonly rule: ValidationRule | LinkageRule }
    | { readonly type: 'moveRule', readonly nodeId: string, readonly list: RuleList, readonly ruleId: string, readonly index: number }
    | { readonly type: 'insertRegion', readonly containerId: string, readonly index: number, readonly region: Region }
    | { readonly type: 'removeRegion', readonly regionId: string }
    | { readonly type: 'moveRegion', readonly regionId: string, readonly index: number }
    | { readonly type: 'setExtensionData', readonly nodeId: string | null, readonly id: string, readonly data?: JsonObject }
    | { readonly type: 'replaceDocument', readonly document: FormDocument }

/** 操作的结果：新文档与逆操作；没有带来变化时返回同一个文档、逆操作为空。 */
export interface OperationResult {
  readonly document: FormDocument
  readonly inverse: readonly FormOperation[]
}

/** 编辑操作的错误码。 */
export type FormOperationErrorCode
  = | 'XH_FORM_OP_UNKNOWN_TYPE'
    | 'XH_FORM_OP_INVALID_PAYLOAD'
    | 'XH_FORM_OP_NODE_NOT_FOUND'
    | 'XH_FORM_OP_REGION_NOT_FOUND'
    | 'XH_FORM_OP_RULE_NOT_FOUND'
    | 'XH_FORM_OP_NOT_A_CONTAINER'
    | 'XH_FORM_OP_NO_KEY'
    | 'XH_FORM_OP_NO_RULE_LIST'
    | 'XH_FORM_OP_INDEX_OUT_OF_RANGE'
    | 'XH_FORM_OP_DUPLICATE_ID'
    | 'XH_FORM_OP_CYCLE'
    | 'XH_FORM_OP_NOT_A_TABLE'
    | 'XH_FORM_OP_INVALID_MERGE'
    | 'XH_FORM_OP_INVALID_SPLIT'

/** 编辑操作无法应用时抛出；`message` 就是错误码，不带文案。 */
export class FormOperationError extends Error {
  readonly code: FormOperationErrorCode
  readonly data: Readonly<Record<string, string | number>>

  constructor(code: FormOperationErrorCode, data: Record<string, string | number> = {}) {
    super(code)
    this.name = 'FormOperationError'
    this.code = code
    this.data = Object.freeze({ ...data })
  }
}

function fail(code: FormOperationErrorCode, data?: Record<string, string | number>): never {
  throw new FormOperationError(code, data)
}

function unchanged(document: FormDocument): OperationResult {
  return { document, inverse: [] }
}

/** 节点的位置：所在区域（顶层为 `null`）与下标。 */
interface Location {
  readonly parent: string | null
  readonly index: number
  readonly node: FormNode
}

function locateNode(children: readonly FormNode[], parent: string | null, nodeId: string): Location | undefined {
  for (let index = 0; index < children.length; index += 1) {
    const node = children[index]!
    if (node.id === nodeId)
      return { parent, index, node }
    if (node.type === 'container') {
      for (const region of node.regions) {
        const found = locateNode(region.children, region.id, nodeId)
        if (found !== undefined)
          return found
      }
    }
  }
  return undefined
}

function requireNode(document: FormDocument, nodeId: unknown): Location {
  if (typeof nodeId !== 'string')
    fail('XH_FORM_OP_INVALID_PAYLOAD')
  return locateNode(document.children, null, nodeId) ?? fail('XH_FORM_OP_NODE_NOT_FOUND', { nodeId })
}

interface RegionLocation {
  readonly container: ContainerNode
  readonly region: Region
  readonly index: number
}

function locateRegion(children: readonly FormNode[], regionId: string): RegionLocation | undefined {
  for (const node of children) {
    if (node.type !== 'container')
      continue
    const index = node.regions.findIndex(region => region.id === regionId)
    if (index !== -1)
      return { container: node, region: node.regions[index]!, index }
    for (const region of node.regions) {
      const found = locateRegion(region.children, regionId)
      if (found !== undefined)
        return found
    }
  }
  return undefined
}

function requireRegion(document: FormDocument, regionId: unknown): RegionLocation {
  if (typeof regionId !== 'string')
    fail('XH_FORM_OP_INVALID_PAYLOAD')
  return locateRegion(document.children, regionId) ?? fail('XH_FORM_OP_REGION_NOT_FOUND', { regionId })
}

function childrenAt(document: FormDocument, parent: string | null): readonly FormNode[] {
  return parent === null ? document.children : requireRegion(document, parent).region.children
}

function requireIndex(index: unknown, max: number): number {
  if (!Number.isSafeInteger(index) || (index as number) < 0 || (index as number) > max)
    fail('XH_FORM_OP_INDEX_OUT_OF_RANGE', { index: String(index), max })
  return index as number
}

function requireFreshIds(document: FormDocument, payload: unknown): void {
  const incoming: string[] = []
  collectIds(payload, incoming)
  const existing = collectDocumentIds(document)
  const seen = new Set<string>()
  for (const id of incoming) {
    if (existing.has(id) || seen.has(id))
      fail('XH_FORM_OP_DUPLICATE_ID', { id })
    seen.add(id)
  }
}

/** 换上的整份文档：普通 JSON 对象、children 是数组、里面的 id 不重复；返回冻结的副本。 */
function requireDocument(value: unknown): FormDocument {
  if (!isJsonValue(value) || !isPlainObject(value) || !Array.isArray(value.children))
    fail('XH_FORM_OP_INVALID_PAYLOAD')
  const ids: string[] = []
  for (const child of value.children)
    collectIds(child, ids)
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id))
      fail('XH_FORM_OP_DUPLICATE_ID', { id })
    seen.add(id)
  }
  return deepFreeze(cloneJson(value)) as unknown as FormDocument
}

function clonePayload<T>(value: T): T {
  if (!isJsonValue(value) || !isPlainObject(value) || typeof value.id !== 'string' || value.id === '')
    fail('XH_FORM_OP_INVALID_PAYLOAD')
  return deepFreeze(cloneJson(value) as T)
}

/** 在节点树里替换一个节点；找不到返回 `null`。 */
function replaceNodeIn(children: readonly FormNode[], nodeId: string, update: (node: FormNode) => FormNode): readonly FormNode[] | null {
  for (let index = 0; index < children.length; index += 1) {
    const node = children[index]!
    if (node.id === nodeId)
      return Object.freeze(children.map((child, at) => (at === index ? update(child) : child)))
    if (node.type !== 'container')
      continue
    for (let regionIndex = 0; regionIndex < node.regions.length; regionIndex += 1) {
      const region = node.regions[regionIndex]!
      const next = replaceNodeIn(region.children, nodeId, update)
      if (next !== null) {
        const regions = node.regions.map((item, at) => (at === regionIndex ? Object.freeze({ ...item, children: next }) : item))
        const container = Object.freeze({ ...node, regions: Object.freeze(regions) })
        return Object.freeze(children.map((child, at) => (at === index ? container : child)))
      }
    }
  }
  return null
}

/** 在节点树里替换一个区域；找不到返回 `null`。 */
function replaceRegionIn(children: readonly FormNode[], regionId: string, update: (region: Region) => Region): readonly FormNode[] | null {
  for (let index = 0; index < children.length; index += 1) {
    const node = children[index]!
    if (node.type !== 'container')
      continue
    const own = node.regions.findIndex(region => region.id === regionId)
    let regions: readonly Region[] | null = null
    if (own !== -1) {
      regions = node.regions.map((region, at) => (at === own ? update(region) : region))
    }
    else {
      for (let regionIndex = 0; regionIndex < node.regions.length && regions === null; regionIndex += 1) {
        const region = node.regions[regionIndex]!
        const next = replaceRegionIn(region.children, regionId, update)
        if (next !== null)
          regions = node.regions.map((item, at) => (at === regionIndex ? Object.freeze({ ...item, children: next }) : item))
      }
    }
    if (regions !== null) {
      const container = Object.freeze({ ...node, regions: Object.freeze(regions) })
      return Object.freeze(children.map((child, at) => (at === index ? container : child)))
    }
  }
  return null
}

function withChildren(document: FormDocument, children: readonly FormNode[]): FormDocument {
  return Object.freeze({ ...document, children })
}

function updateNode(document: FormDocument, nodeId: string, update: (node: FormNode) => FormNode): FormDocument {
  return withChildren(document, replaceNodeIn(document.children, nodeId, update) ?? fail('XH_FORM_OP_NODE_NOT_FOUND', { nodeId }))
}

function updateRegion(document: FormDocument, regionId: string, update: (region: Region) => Region): FormDocument {
  return withChildren(document, replaceRegionIn(document.children, regionId, update) ?? fail('XH_FORM_OP_REGION_NOT_FOUND', { regionId }))
}

function updateList(document: FormDocument, parent: string | null, update: (children: readonly FormNode[]) => readonly FormNode[]): FormDocument {
  if (parent === null)
    return withChildren(document, Object.freeze(update(document.children)))
  return updateRegion(document, parent, region => Object.freeze({ ...region, children: Object.freeze(update(region.children)) }))
}

function insertAt<T>(list: readonly T[], index: number, item: T): T[] {
  return [...list.slice(0, index), item, ...list.slice(index)]
}

function removeAt<T>(list: readonly T[], index: number): T[] {
  return [...list.slice(0, index), ...list.slice(index + 1)]
}

function setBag(bag: PropertyBag, name: string, value: JsonValue | undefined): PropertyBag {
  const next: Record<string, JsonValue> = { ...bag }
  if (value === undefined)
    delete next[name]
  else
    next[name] = value
  return Object.freeze(next)
}

function readBag(bag: PropertyBag, name: string): JsonValue | undefined {
  return Object.hasOwn(bag, name) ? bag[name] : undefined
}

function requireName(name: unknown): string {
  return typeof name === 'string' && name !== '' ? name : fail('XH_FORM_OP_INVALID_PAYLOAD')
}

function requireValue(value: unknown): JsonValue | undefined {
  if (value !== undefined && !isJsonValue(value))
    fail('XH_FORM_OP_INVALID_PAYLOAD')
  return value === undefined ? undefined : deepFreeze(cloneJson(value))
}

/** 写入或去掉一个扩展的数据后的扩展数据；去完为空时为 `undefined`（即去掉 extensions 字段）。 */
function setExtension(current: ExtensionData | undefined, id: string, data: JsonObject | undefined): ExtensionData | undefined {
  const next: Record<string, JsonObject> = { ...current }
  if (data === undefined)
    delete next[id]
  else
    next[id] = data
  return Object.keys(next).length === 0 ? undefined : Object.freeze(next)
}

/** 换上扩展数据：为 `undefined` 时去掉 extensions 字段。 */
function withExtensions<T extends { readonly extensions?: ExtensionData }>(owner: T, extensions: ExtensionData | undefined): T {
  const { extensions: _previous, ...rest } = owner
  return Object.freeze(extensions === undefined ? rest : { ...rest, extensions }) as T
}

function propertyOperation<T extends Record<string, unknown>>(base: T, previous: JsonValue | undefined): T & { value?: JsonValue } {
  return previous === undefined ? base : { ...base, value: previous }
}

function rulesOf(node: FormNode, list: unknown): readonly (ValidationRule | LinkageRule)[] {
  if (list === 'linkage')
    return node.linkage
  if (list !== 'validation')
    fail('XH_FORM_OP_INVALID_PAYLOAD')
  if (node.type === 'static')
    fail('XH_FORM_OP_NO_RULE_LIST', { nodeId: node.id })
  return node.validation
}

function withRules(node: FormNode, list: RuleList, rules: readonly (ValidationRule | LinkageRule)[]): FormNode {
  return Object.freeze({ ...node, [list]: Object.freeze(rules) }) as FormNode
}

function requireRuleIndex(rules: readonly { id: string }[], ruleId: unknown): number {
  const index = typeof ruleId === 'string' ? rules.findIndex(rule => rule.id === ruleId) : -1
  return index === -1 ? fail('XH_FORM_OP_RULE_NOT_FOUND', { ruleId: String(ruleId) }) : index
}

function isInside(node: FormNode, regionId: string): boolean {
  if (node.type !== 'container')
    return false
  return node.regions.some(region => region.id === regionId || region.children.some(child => isInside(child, regionId)))
}

/** 对文档应用一个操作，返回新文档与逆操作。不修改输入；操作无法应用时抛 `FormOperationError`。 */
export function applyOperation(document: FormDocument, operation: FormOperation): OperationResult {
  if (!isPlainObject(operation))
    fail('XH_FORM_OP_INVALID_PAYLOAD')
  switch (operation.type) {
    case 'insertNode': {
      const siblings = childrenAt(document, operation.parent)
      const index = requireIndex(operation.index, siblings.length)
      const node = clonePayload(operation.node)
      requireFreshIds(document, node)
      return {
        document: updateList(document, operation.parent, children => insertAt(children, index, node)),
        inverse: [{ type: 'removeNode', nodeId: node.id }],
      }
    }
    case 'removeNode': {
      const { parent, index, node } = requireNode(document, operation.nodeId)
      return {
        document: updateList(document, parent, children => removeAt(children, index)),
        inverse: [{ type: 'insertNode', parent, index, node }],
      }
    }
    case 'moveNode': {
      const from = requireNode(document, operation.nodeId)
      const target = operation.parent
      if (target !== null && (typeof target !== 'string' || isInside(from.node, target)))
        fail(typeof target === 'string' ? 'XH_FORM_OP_CYCLE' : 'XH_FORM_OP_INVALID_PAYLOAD', { nodeId: from.node.id })
      const targetLength = childrenAt(document, target).length - (target === from.parent ? 1 : 0)
      const index = requireIndex(operation.index, targetLength)
      if (target === from.parent && index === from.index)
        return unchanged(document)
      const removed = updateList(document, from.parent, children => removeAt(children, from.index))
      return {
        document: updateList(removed, target, children => insertAt(children, index, from.node)),
        inverse: [{ type: 'moveNode', nodeId: from.node.id, parent: from.parent, index: from.index }],
      }
    }
    case 'setProperty': {
      const { node } = requireNode(document, operation.nodeId)
      const group = operation.group
      if (!PROPERTY_GROUPS.includes(group))
        fail('XH_FORM_OP_INVALID_PAYLOAD')
      const name = requireName(operation.name)
      const value = requireValue(operation.value)
      const previous = readBag(node[group], name)
      if (jsonEquals(previous, value))
        return unchanged(document)
      return {
        document: updateNode(document, node.id, current => Object.freeze({ ...current, [group]: setBag(current[group], name, value) })),
        inverse: [propertyOperation({ type: 'setProperty', nodeId: node.id, group, name }, previous)],
      }
    }
    case 'setRegionProperty': {
      const { region } = requireRegion(document, operation.regionId)
      const name = requireName(operation.name)
      const value = requireValue(operation.value)
      const previous = readBag(region.props, name)
      if (jsonEquals(previous, value))
        return unchanged(document)
      return {
        document: updateRegion(document, region.id, current => Object.freeze({ ...current, props: setBag(current.props, name, value) })),
        inverse: [propertyOperation({ type: 'setRegionProperty', regionId: region.id, name }, previous)],
      }
    }
    case 'setSetting': {
      const name = requireName(operation.name)
      const value = requireValue(operation.value)
      const previous = readBag(document.settings, name)
      if (jsonEquals(previous, value))
        return unchanged(document)
      return {
        document: Object.freeze({ ...document, settings: setBag(document.settings, name, value) }),
        inverse: [propertyOperation({ type: 'setSetting', name }, previous)],
      }
    }
    case 'setKey': {
      const { node } = requireNode(document, operation.nodeId)
      const key = requireName(operation.key)
      if (node.type === 'static' || typeof node.key !== 'string')
        fail('XH_FORM_OP_NO_KEY', { nodeId: node.id })
      if (node.key === key)
        return unchanged(document)
      return {
        document: updateNode(document, node.id, current => Object.freeze({ ...current, key }) as FormNode),
        inverse: [{ type: 'setKey', nodeId: node.id, key: node.key }],
      }
    }
    case 'insertRule': {
      const { node } = requireNode(document, operation.nodeId)
      const rules = rulesOf(node, operation.list)
      const index = requireIndex(operation.index, rules.length)
      const rule = clonePayload(operation.rule)
      requireFreshIds(document, rule)
      return {
        document: updateNode(document, node.id, current => withRules(current, operation.list, insertAt(rulesOf(current, operation.list), index, rule))),
        inverse: [{ type: 'removeRule', nodeId: node.id, list: operation.list, ruleId: rule.id }],
      }
    }
    case 'removeRule': {
      const { node } = requireNode(document, operation.nodeId)
      const rules = rulesOf(node, operation.list)
      const index = requireRuleIndex(rules, operation.ruleId)
      return {
        document: updateNode(document, node.id, current => withRules(current, operation.list, removeAt(rules, index))),
        inverse: [{ type: 'insertRule', nodeId: node.id, list: operation.list, index, rule: rules[index]! }],
      }
    }
    case 'replaceRule': {
      const { node } = requireNode(document, operation.nodeId)
      const rules = rulesOf(node, operation.list)
      const rule = clonePayload(operation.rule)
      const index = requireRuleIndex(rules, rule.id)
      const previous = rules[index]!
      if (jsonEquals(previous as never, rule as never))
        return unchanged(document)
      return {
        document: updateNode(document, node.id, current => withRules(current, operation.list, rules.map((item, at) => (at === index ? rule : item)))),
        inverse: [{ type: 'replaceRule', nodeId: node.id, list: operation.list, rule: previous }],
      }
    }
    case 'moveRule': {
      const { node } = requireNode(document, operation.nodeId)
      const rules = rulesOf(node, operation.list)
      const from = requireRuleIndex(rules, operation.ruleId)
      const index = requireIndex(operation.index, rules.length - 1)
      if (index === from)
        return unchanged(document)
      const rule = rules[from]!
      return {
        document: updateNode(document, node.id, current => withRules(current, operation.list, insertAt(removeAt(rules, from), index, rule))),
        inverse: [{ type: 'moveRule', nodeId: node.id, list: operation.list, ruleId: rule.id, index: from }],
      }
    }
    case 'insertRegion': {
      const { node } = requireNode(document, operation.containerId)
      if (node.type !== 'container')
        fail('XH_FORM_OP_NOT_A_CONTAINER', { nodeId: node.id })
      const index = requireIndex(operation.index, node.regions.length)
      const region = clonePayload(operation.region)
      requireFreshIds(document, region)
      return {
        document: updateNode(document, node.id, current => Object.freeze({ ...current, regions: Object.freeze(insertAt((current as ContainerNode).regions, index, region)) }) as FormNode),
        inverse: [{ type: 'removeRegion', regionId: region.id }],
      }
    }
    case 'removeRegion': {
      const { container, region, index } = requireRegion(document, operation.regionId)
      return {
        document: updateNode(document, container.id, current => Object.freeze({ ...current, regions: Object.freeze(removeAt((current as ContainerNode).regions, index)) }) as FormNode),
        inverse: [{ type: 'insertRegion', containerId: container.id, index, region }],
      }
    }
    case 'moveRegion': {
      const { container, region, index: from } = requireRegion(document, operation.regionId)
      const index = requireIndex(operation.index, container.regions.length - 1)
      if (index === from)
        return unchanged(document)
      return {
        document: updateNode(document, container.id, current => Object.freeze({ ...current, regions: Object.freeze(insertAt(removeAt((current as ContainerNode).regions, from), index, region)) }) as FormNode),
        inverse: [{ type: 'moveRegion', regionId: region.id, index: from }],
      }
    }
    case 'setExtensionData': {
      const id = requireName(operation.id)
      const value = requireValue(operation.data)
      if (value !== undefined && !isPlainObject(value))
        fail('XH_FORM_OP_INVALID_PAYLOAD')
      const data = value as JsonObject | undefined
      const owner: { readonly id?: string, readonly extensions?: ExtensionData } = operation.nodeId === null ? document : requireNode(document, operation.nodeId).node
      const previous = owner.extensions !== undefined && Object.hasOwn(owner.extensions, id) ? owner.extensions[id] : undefined
      if (jsonEquals(previous, data))
        return unchanged(document)
      const next = setExtension(owner.extensions, id, data)
      const inverse: FormOperation = { type: 'setExtensionData', nodeId: operation.nodeId, id, ...(previous === undefined ? {} : { data: previous }) }
      return {
        document: operation.nodeId === null ? withExtensions(document, next) : updateNode(document, operation.nodeId, current => withExtensions(current, next)),
        inverse: [inverse],
      }
    }
    case 'replaceDocument': {
      const next = requireDocument(operation.document)
      if (jsonEquals(document as unknown as JsonValue, next as unknown as JsonValue))
        return unchanged(document)
      return { document: next, inverse: [{ type: 'replaceDocument', document }] }
    }
    default:
      return fail('XH_FORM_OP_UNKNOWN_TYPE', { type: String((operation as { type?: unknown }).type) })
  }
}

/** 依次应用一组操作；逆操作是各操作逆操作按反序拼接。任一操作失败时抛出，输入文档不变。 */
export function applyOperations(document: FormDocument, operations: readonly FormOperation[]): OperationResult {
  return applyInSequence(applyOperation, document, operations)
}
