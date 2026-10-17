/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 表单设计器的编辑模型：在历史栈之上维护选择、剪贴板与编辑命令（增删、移动与嵌套、属性、规则、区域、栅格跨度、表格合并拆分）；不碰 DOM。

import type {
  ContainerKindDefinition,
  FormCoreExtension,
  FormDocument,
  FormNode,
  FormOperation,
  FormSchemaIssue,
  KindRegistry,
  LinkageRule,
  PropertyGroup,
  Region,
  RuleList,
  ValidationRule,
} from '@xihan-form/core'
import type { JsonValue } from '@xihan-ui/core/json'
import type { ExecuteOptions, History, HistoryChangeKind, IdAllocator, TableAxis } from '@xihan-ui/designer-kit'
import type { ExpressionEngine } from '@xihan-ui/expression'
import {
  applyOperation,
  cloneNodesForInsert,
  collectDocumentIds,
  createFormModel,
  createNode,
  createRegion,
  descendantsOf,
  findNode,
  findRegion,
  insertTableLine,
  mergeTableCells,
  numberControl,
  removeTableLine,
  splitTableCell,
  validateDocument,
  walkNodes,
} from '@xihan-form/core'
import { cloneJson } from '@xihan-ui/core/json'
import { createHistory, createIdAllocator } from '@xihan-ui/designer-kit'

/**
 * 选择：选中的节点，或同一个容器里的区域（栅格的列、标签页、折叠项、表格单元格），二者互斥，按选中的先后。
 * 选中区域时 nodes 为空。
 */
export interface FormSelection {
  /** 选中节点的 id。 */
  readonly nodes: readonly string[]
  /** 选中区域的 id，都在同一个容器里。 */
  readonly regions?: readonly string[]
}

/** 选择方式：替换、追加或切换。 */
export type FormSelectMode = 'replace' | 'add' | 'toggle'

/** 放置位置：区域 id（`null` 为文档顶层）与放在该区域现有子节点里的第几个之前，缺省放到末尾。 */
export interface FormDropTarget {
  /** 区域 id；`null` 为文档顶层。 */
  readonly parent: string | null
  /** 放在该区域现有子节点里的第几个之前，从 0 起；缺省放到末尾。 */
  readonly index?: number
}

/** 剪贴板内容：被复制的节点，按文档顺序，不含被选中节点的后代里重复选中的那些。 */
export interface FormClipboard {
  /** 被复制的节点，粘贴时 id 全部换新。 */
  readonly nodes: readonly FormNode[]
}

/** 校验规则或联动规则，不带 id；id 由编辑模型分配。 */
export type FormRuleInit = ValidationRule extends infer R ? R extends ValidationRule ? Omit<R, 'id'> : never : never

/** 编辑模型的变化：文档变化带上历史变化的种类与实际应用的操作；选择变化带上新的选择。 */
export type FormEditorChange
  = | { readonly kind: 'document', readonly cause: HistoryChangeKind, readonly document: FormDocument, readonly operations: readonly FormOperation[] }
    | { readonly kind: 'selection', readonly selection: FormSelection }

/** 创建编辑模型的选项。 */
export interface FormEditorOptions {
  /** 初始文档。 */
  readonly document: FormDocument
  /** 种类、编辑方式与规则从这组扩展来，内置扩展自动排在最前；与设计器的 extensions 是同一份。 */
  readonly extensions?: readonly FormCoreExtension[]
  /** 校验时检查表达式用的引擎，不给时不检查表达式内容。 */
  readonly expressionEngine?: ExpressionEngine
  /** 宿主提供给表达式的额外顶层名字。 */
  readonly identifiers?: readonly string[]
  /** 撤销步数上限，缺省 100。 */
  readonly historyLimit?: number
  /** 同一合并键相隔多少毫秒内并入上一步，缺省 1000。 */
  readonly mergeWithin?: number
  /** 取当前时间（毫秒），合并相邻修改时用；缺省 `Date.now`。 */
  readonly now?: () => number
}

/** 表单编辑模型：当前文档、撤销历史与选择，以及各种编辑操作；不碰 DOM。 */
export interface FormEditor {
  /** 当前文档。 */
  readonly document: FormDocument
  /** 按扩展合出的种类登记表。 */
  readonly registry: KindRegistry
  /** 撤销历史：能否撤销、重做，是否有未保存的修改。 */
  readonly history: History<FormDocument, FormOperation>
  /** 当前的选择。 */
  readonly selection: FormSelection
  /** 换一组扩展：之后新建、放置与校验都按它；冲突时抛 DesignerExtensionError、什么都不变。 */
  readonly setExtensions: (extensions: readonly FormCoreExtension[]) => void
  /** 装载新文档：清空历史与选择，剪贴板保留；文档变化的 cause 为 reset。 */
  readonly load: (document: FormDocument) => void
  /** 执行一组操作并记为一步撤销；返回新文档。 */
  readonly execute: (operations: readonly FormOperation[], options?: ExecuteOptions) => FormDocument
  /** 撤销一步；没有可撤销的时返回 false。 */
  readonly undo: () => boolean
  /** 重做一步；没有可重做的时返回 false。 */
  readonly redo: () => boolean
  /** 封口：此后带同一合并键的修改另起一步。 */
  readonly seal: () => void
  /** 把 run 里的全部修改合为一步撤销。 */
  readonly transact: <T>(run: () => T, label?: string) => T
  /** 把当前文档记为已保存，此后 `history.dirty` 为 false，直到再改。 */
  readonly markSaved: () => void
  /** 选中节点或区域：给了非空的 regions 就选区域（只留与第一个同一容器的），否则选 nodes。 */
  readonly select: (selection: Partial<FormSelection>, mode?: FormSelectMode) => void
  /** 清空选择。 */
  readonly clearSelection: () => void
  /** 节点能否放到目标位置：目标区域存在，不放进自己或自己的后代，目标区域收这种节点（如子表只收字段）。 */
  readonly canDrop: (nodeIds: readonly string[], target: FormDropTarget) => boolean
  /** 种类能否新建到目标位置；种类未登记时为 false。 */
  readonly canAdd: (kind: string, target: FormDropTarget) => boolean
  /** 一段剪贴板内容能否粘贴到目标位置：非空、目标区域收这些节点、种类都已登记。 */
  readonly canPasteAt: (clipboard: FormClipboard, target: FormDropTarget) => boolean
  /** 按种类新建节点并选中它；目标缺省为选中节点之后，没有选中时为顶层末尾。种类未登记时抛错；目标不收时返回 undefined。 */
  readonly addNode: (kind: string, target?: FormDropTarget, options?: ExecuteOptions) => FormNode | undefined
  /** 移动一组节点到目标位置，保持它们在文档里的先后；放不下时返回 false。 */
  readonly moveNodes: (nodeIds: readonly string[], target: FormDropTarget, options?: ExecuteOptions) => boolean
  /**
   * 删除选中的节点；选中区域时删除这些区域，删完要少于容器的区域下限或容器是表格布局时不删。
   * 什么都没删时返回 false。
   */
  readonly deleteSelection: (options?: ExecuteOptions) => boolean
  /** 写节点的属性；value 为 undefined 时删除该属性。连续写同一属性合为一步，直到 seal。 */
  readonly setProperty: (nodeId: string, group: PropertyGroup, name: string, value: JsonValue | undefined, options?: ExecuteOptions) => void
  /** 写区域的属性，合并规则同 setProperty。 */
  readonly setRegionProperty: (regionId: string, name: string, value: JsonValue | undefined, options?: ExecuteOptions) => void
  /** 写表单设置，合并规则同 setProperty。 */
  readonly setSetting: (name: string, value: JsonValue | undefined, options?: ExecuteOptions) => void
  /** 改数据键，合并规则同 setProperty。 */
  readonly setKey: (nodeId: string, key: string, options?: ExecuteOptions) => void
  /** 新增一条规则并返回它；index 缺省为末尾。 */
  readonly addRule: (nodeId: string, list: RuleList, rule: FormRuleInit | Omit<LinkageRule, 'id'>, index?: number, options?: ExecuteOptions) => ValidationRule | LinkageRule
  /** 整条替换规则，连续替换同一条规则合为一步。 */
  readonly updateRule: (nodeId: string, list: RuleList, rule: ValidationRule | LinkageRule, options?: ExecuteOptions) => void
  /** 删除一条规则。 */
  readonly removeRule: (nodeId: string, list: RuleList, ruleId: string, options?: ExecuteOptions) => void
  /** 把一条规则移到 index 处。 */
  readonly moveRule: (nodeId: string, list: RuleList, ruleId: string, index: number, options?: ExecuteOptions) => void
  /** 给容器新增一个区域并返回它；index 缺省为末尾，props 覆盖区域属性的缺省值。 */
  readonly addRegion: (containerId: string, index?: number, props?: Readonly<Record<string, JsonValue>>, options?: ExecuteOptions) => Region
  /** 删除一个区域，连同其中的节点。 */
  readonly removeRegion: (regionId: string, options?: ExecuteOptions) => void
  /** 把一个区域移到容器里的 index 处。 */
  readonly moveRegion: (regionId: string, index: number, options?: ExecuteOptions) => void
  /** 设栅格区域的跨度：取整并夹在属性描述的上下限之间。 */
  readonly setGridSpan: (regionId: string, span: number, options?: ExecuteOptions) => void
  /** 合并表格布局的单元格，所选单元格须恰好拼成一个矩形。 */
  readonly mergeCells: (containerId: string, regionIds: readonly string[], options?: ExecuteOptions) => void
  /** 拆分表格布局的单元格。 */
  readonly splitCell: (containerId: string, regionId: string, options?: ExecuteOptions) => void
  /** 在表格布局的第 at 行或列之前插入一行或一列。 */
  readonly insertTableLine: (containerId: string, axis: TableAxis, at: number, options?: ExecuteOptions) => void
  /** 删除表格布局的第 at 行或列。 */
  readonly removeTableLine: (containerId: string, axis: TableAxis, at: number, options?: ExecuteOptions) => void
  /** 复制选中的节点；没有选中时返回 undefined。 */
  readonly copy: () => FormClipboard | undefined
  /** 复制并删除选中的节点。 */
  readonly cut: (options?: ExecuteOptions) => FormClipboard | undefined
  /**
   * 粘贴并选中粘贴出的节点：id 全部换新，与目标作用域冲突的数据键改为派生键。
   * 内容缺省为最近一次 copy 的，目标缺省为选中节点之后、没有选中时为顶层末尾；目标不收时什么都不做，返回空选择。
   */
  readonly paste: (clipboard?: FormClipboard, target?: FormDropTarget, options?: ExecuteOptions) => FormSelection
  /** 复制选中节点并紧跟在原节点之后粘贴，不改动剪贴板。 */
  readonly duplicate: (options?: ExecuteOptions) => FormSelection
  /** 按当前登记表做 schema 自校验。 */
  readonly validate: () => readonly FormSchemaIssue[]
  /** 订阅文档与选择的变化，返回取消函数。 */
  readonly subscribe: (listener: (change: FormEditorChange) => void) => () => void
}

const EMPTY_SELECTION: FormSelection = { nodes: [] }
const ID_PREFIX = 'n'

/** 只保留最外层：祖先也在其中的节点去掉；按文档顺序。 */
function topmost(document: FormDocument, ids: readonly string[]): string[] {
  const wanted = new Set(ids)
  const out: string[] = []
  walkNodes(document, (node) => {
    if (!wanted.has(node.id))
      return true
    out.push(node.id)
    return false
  })
  return out
}

/** 创建表单编辑模型。 */
export function createFormEditor(options: FormEditorOptions): FormEditor {
  let extensions = options.extensions ?? []
  let registry = createFormModel(extensions).registry
  const history = createHistory<FormDocument, FormOperation>({
    document: options.document,
    apply: applyOperation,
    limit: options.historyLimit ?? 100,
    mergeWithin: options.mergeWithin ?? 1000,
    ...(options.now === undefined ? {} : { now: options.now }),
  })
  const listeners = new Set<(change: FormEditorChange) => void>()
  let selection: FormSelection = EMPTY_SELECTION
  let clipboard: FormClipboard | undefined

  const emit = (change: FormEditorChange): void => {
    for (const listener of listeners)
      listener(change)
  }

  const allocator = (): IdAllocator => createIdAllocator(ID_PREFIX, collectDocumentIds(history.document))

  const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((id, index) => id === b[index])

  /** 规整选择：去掉不存在的节点与区域，区域只留与第一个同一容器的；选了区域就不留节点。 */
  const setSelection = (next: Partial<FormSelection>): void => {
    const document = history.document
    const regions = [...new Set(next.regions ?? [])].map(id => findRegion(document, id)).filter(found => found !== undefined)
    const owner = regions[0]?.container.id
    const regionIds = regions.filter(found => found.container.id === owner).map(found => found.region.id)
    const nodes = regionIds.length > 0 ? [] : [...new Set(next.nodes ?? [])].filter(id => findNode(document, id) !== undefined)
    if (sameList(nodes, selection.nodes) && sameList(regionIds, selection.regions ?? []))
      return
    selection = regionIds.length > 0 ? { nodes: [], regions: regionIds } : nodes.length > 0 ? { nodes } : EMPTY_SELECTION
    emit({ kind: 'selection', selection })
  }

  history.subscribe((change) => {
    emit({ kind: 'document', cause: change.kind, document: change.document, operations: change.operations })
    setSelection(selection)
  })

  const execute = (operations: readonly FormOperation[], executeOptions?: ExecuteOptions): FormDocument =>
    history.execute(operations, executeOptions)

  const childrenAt = (parent: string | null): readonly FormNode[] | undefined =>
    parent === null ? history.document.children : findRegion(history.document, parent)?.region.children

  /** 目标区域收哪些节点：`any` 或只收字段；区域不存在时为 undefined。 */
  const acceptsAt = (parent: string | null): 'any' | 'fields' | undefined => {
    if (parent === null)
      return 'any'
    const found = findRegion(history.document, parent)
    if (found === undefined)
      return undefined
    const definition = registry.get(found.container.kind)
    return definition?.type === 'container' ? definition.accepts : 'any'
  }

  const fits = (type: FormNode['type'], accepts: 'any' | 'fields'): boolean => accepts === 'any' || type === 'field'

  /** 选中节点之后的位置；选中区域时为该区域末尾；都没有时为顶层末尾。 */
  const defaultTarget = (): FormDropTarget => {
    const region = selection.regions?.[0]
    if (region !== undefined)
      return { parent: region }
    const last = selection.nodes.at(-1)
    const found = last === undefined ? undefined : findNode(history.document, last)
    if (found === undefined)
      return { parent: null }
    return { parent: found.region?.id ?? null, index: found.index + 1 }
  }

  const canDrop = (nodeIds: readonly string[], target: FormDropTarget): boolean => {
    const accepts = acceptsAt(target.parent)
    if (accepts === undefined || nodeIds.length === 0)
      return false
    for (const id of nodeIds) {
      const found = findNode(history.document, id)
      if (found === undefined || !fits(found.node.type, accepts))
        return false
      if (target.parent !== null && found.node.type === 'container' && descendantsOf(found.node).some(node => node.type === 'container' && node.regions.some(region => region.id === target.parent)))
        return false
    }
    return true
  }

  const canAdd = (kind: string, target: FormDropTarget): boolean => {
    const definition = registry.get(kind)
    const accepts = acceptsAt(target.parent)
    return definition !== undefined && accepts !== undefined && fits(definition.type, accepts)
  }

  const canPasteAt = (content: FormClipboard, target: FormDropTarget): boolean => {
    const accepts = acceptsAt(target.parent)
    return accepts !== undefined && content.nodes.length > 0 && content.nodes.every(node => fits(node.type, accepts) && registry.get(node.kind) !== undefined)
  }

  /** 插入位置：缺省为末尾，夹在 0 与子节点个数之间。 */
  const insertIndex = (target: FormDropTarget): number => {
    const length = childrenAt(target.parent)?.length ?? 0
    return Math.min(Math.max(target.index ?? length, 0), length)
  }

  const insertNodes = (nodes: readonly FormNode[], target: FormDropTarget, executeOptions?: ExecuteOptions): void => {
    const index = insertIndex(target)
    execute(nodes.map((node, offset) => ({ type: 'insertNode', parent: target.parent, index: index + offset, node })), executeOptions)
  }

  const addNode = (kind: string, target?: FormDropTarget, executeOptions?: ExecuteOptions): FormNode | undefined => {
    if (registry.get(kind) === undefined)
      throw new RangeError(`[form-designer] kind ${JSON.stringify(kind)} is not registered`)
    const at = target ?? defaultTarget()
    if (!canAdd(kind, at))
      return undefined
    const node = createNode(registry, kind, allocator())
    insertNodes([node], at, executeOptions)
    setSelection({ nodes: [node.id] })
    return node
  }

  /**
   * 移动一组节点：移动的节点按文档顺序连成一串，接在放置点之前那个不移动的子节点后面（放置点在最前时放在开头），
   * 逐个 moveNode，每个节点紧跟在上一个之后。
   */
  const moveNodes = (nodeIds: readonly string[], target: FormDropTarget, executeOptions?: ExecuteOptions): boolean => {
    if (!canDrop(nodeIds, target))
      return false
    const moving = topmost(history.document, nodeIds)
    const movingSet = new Set(moving)
    const siblings = (childrenAt(target.parent) ?? []).map(node => node.id)
    const dropAt = Math.min(Math.max(target.index ?? siblings.length, 0), siblings.length)
    const staying = siblings.filter(id => !movingSet.has(id))
    const base = siblings.slice(0, dropAt).filter(id => !movingSet.has(id)).length
    const final = [...staying.slice(0, base), ...moving, ...staying.slice(base)]
    if (final.length === siblings.length && final.every((id, index) => id === siblings[index]))
      return true
    const current = [...siblings]
    const operations: FormOperation[] = []
    let anchor = base === 0 ? undefined : staying[base - 1]
    for (const id of moving) {
      const from = current.indexOf(id)
      if (from !== -1)
        current.splice(from, 1)
      const at = anchor === undefined ? 0 : current.indexOf(anchor) + 1
      current.splice(at, 0, id)
      operations.push({ type: 'moveNode', nodeId: id, parent: target.parent, index: at })
      anchor = id
    }
    execute(operations, executeOptions)
    return true
  }

  const deleteRegions = (regionIds: readonly string[], executeOptions?: ExecuteOptions): boolean => {
    const found = findRegion(history.document, regionIds[0]!)
    const definition = found === undefined ? undefined : registry.get(found.container.kind)
    if (found === undefined || definition?.type !== 'container' || found.container.kind === 'table')
      return false
    if (found.container.regions.length - regionIds.length < definition.regions.min)
      return false
    execute(regionIds.map(regionId => ({ type: 'removeRegion', regionId })), executeOptions)
    return true
  }

  const deleteSelection = (executeOptions?: ExecuteOptions): boolean => {
    if (selection.regions !== undefined)
      return deleteRegions(selection.regions, executeOptions)
    const ids = topmost(history.document, selection.nodes)
    if (ids.length === 0)
      return false
    execute(ids.map(nodeId => ({ type: 'removeNode', nodeId })), executeOptions)
    return true
  }

  const merged = (key: string, executeOptions?: ExecuteOptions): ExecuteOptions => ({ merge: key, ...executeOptions })

  const setProperty = (nodeId: string, group: PropertyGroup, name: string, value: JsonValue | undefined, executeOptions?: ExecuteOptions): void => {
    execute([{ type: 'setProperty', nodeId, group, name, ...(value === undefined ? {} : { value }) }], merged(`prop:${nodeId}:${group}.${name}`, executeOptions))
  }

  const setRegionProperty = (regionId: string, name: string, value: JsonValue | undefined, executeOptions?: ExecuteOptions): void => {
    execute([{ type: 'setRegionProperty', regionId, name, ...(value === undefined ? {} : { value }) }], merged(`region:${regionId}:${name}`, executeOptions))
  }

  const setSetting = (name: string, value: JsonValue | undefined, executeOptions?: ExecuteOptions): void => {
    execute([{ type: 'setSetting', name, ...(value === undefined ? {} : { value }) }], merged(`setting:${name}`, executeOptions))
  }

  const setKey = (nodeId: string, key: string, executeOptions?: ExecuteOptions): void => {
    execute([{ type: 'setKey', nodeId, key }], merged(`key:${nodeId}`, executeOptions))
  }

  const addRule = (nodeId: string, list: RuleList, rule: FormRuleInit | Omit<LinkageRule, 'id'>, index?: number, executeOptions?: ExecuteOptions): ValidationRule | LinkageRule => {
    const found = findNode(history.document, nodeId)
    const rules = found === undefined ? [] : (found.node as { readonly validation?: readonly unknown[], readonly linkage: readonly unknown[] })[list] ?? []
    const created = { ...cloneJson(rule as unknown as JsonValue) as object, id: allocator().next() } as ValidationRule | LinkageRule
    execute([{ type: 'insertRule', nodeId, list, index: index ?? rules.length, rule: created }], executeOptions)
    return created
  }

  const addRegion = (containerId: string, index?: number, props?: Readonly<Record<string, JsonValue>>, executeOptions?: ExecuteOptions): Region => {
    const found = findNode(history.document, containerId)
    const definition = found === undefined ? undefined : registry.get(found.node.kind)
    if (found?.node.type !== 'container' || definition?.type !== 'container')
      throw new RangeError(`[form-designer] ${JSON.stringify(containerId)} is not a container`)
    const region = createRegion(definition as ContainerKindDefinition, allocator(), props)
    execute([{ type: 'insertRegion', containerId, index: index ?? found.node.regions.length, region }], executeOptions)
    return region
  }

  const setGridSpan = (regionId: string, span: number, executeOptions?: ExecuteOptions): void => {
    const found = findRegion(history.document, regionId)
    const definition = found === undefined ? undefined : registry.get(found.container.kind)
    const descriptor = definition?.type === 'container' ? definition.regionProperties.find(item => item.path[0] === 'span') : undefined
    const control = descriptor === undefined ? undefined : numberControl(descriptor.control)
    const min = control?.min ?? 1
    const max = control?.max ?? Number.POSITIVE_INFINITY
    setRegionProperty(regionId, 'span', Math.min(Math.max(Math.round(span), min), max), executeOptions)
  }

  const copySelection = (): FormClipboard | undefined => {
    const document = history.document
    const ids = topmost(document, selection.nodes)
    if (ids.length === 0)
      return undefined
    return { nodes: ids.map(id => cloneJson(findNode(document, id)!.node as unknown as JsonValue) as unknown as FormNode) }
  }

  const paste = (content?: FormClipboard, target?: FormDropTarget, executeOptions?: ExecuteOptions): FormSelection => {
    const source = content ?? clipboard
    const at = target ?? defaultTarget()
    if (source === undefined || !canPasteAt(source, at))
      return EMPTY_SELECTION
    const nodes = cloneNodesForInsert(history.document, at.parent, source.nodes, allocator())
    insertNodes(nodes, at, executeOptions)
    setSelection({ nodes: nodes.map(node => node.id) })
    return selection
  }

  return {
    get document() {
      return history.document
    },
    get registry() {
      return registry
    },
    history,
    get selection() {
      return selection
    },
    setExtensions: (next) => {
      registry = createFormModel(next).registry
      extensions = next
    },
    load: (document) => {
      history.reset(document)
      setSelection(EMPTY_SELECTION)
    },
    execute,
    undo: () => history.undo(),
    redo: () => history.redo(),
    seal: () => history.seal(),
    transact: (run, label) => history.transact(run, label),
    markSaved: () => history.markSaved(),
    select: (next, mode = 'replace') => {
      const byRegion = (next.regions?.length ?? 0) > 0
      const incoming = (byRegion ? next.regions : next.nodes) ?? []
      const current = byRegion ? (selection.regions ?? []) : selection.nodes
      const combined = mode === 'replace'
        ? incoming
        : mode === 'add'
          ? [...current, ...incoming]
          : [...current.filter(id => !incoming.includes(id)), ...incoming.filter(id => !current.includes(id))]
      setSelection(byRegion ? { regions: combined } : { nodes: combined })
    },
    clearSelection: () => setSelection(EMPTY_SELECTION),
    canDrop,
    canAdd,
    canPasteAt,
    addNode,
    moveNodes,
    deleteSelection,
    setProperty,
    setRegionProperty,
    setSetting,
    setKey,
    addRule,
    updateRule: (nodeId, list, rule, executeOptions) => {
      execute([{ type: 'replaceRule', nodeId, list, rule }], merged(`rule:${rule.id}`, executeOptions))
    },
    removeRule: (nodeId, list, ruleId, executeOptions) => {
      execute([{ type: 'removeRule', nodeId, list, ruleId }], executeOptions)
    },
    moveRule: (nodeId, list, ruleId, index, executeOptions) => {
      execute([{ type: 'moveRule', nodeId, list, ruleId, index }], executeOptions)
    },
    addRegion,
    removeRegion: (regionId, executeOptions) => {
      execute([{ type: 'removeRegion', regionId }], executeOptions)
    },
    moveRegion: (regionId, index, executeOptions) => {
      execute([{ type: 'moveRegion', regionId, index }], executeOptions)
    },
    setGridSpan,
    mergeCells: (containerId, regionIds, executeOptions) => {
      execute(mergeTableCells(history.document, containerId, regionIds), executeOptions)
    },
    splitCell: (containerId, regionId, executeOptions) => {
      execute(splitTableCell(history.document, containerId, regionId, allocator()), executeOptions)
    },
    insertTableLine: (containerId, axis, at, executeOptions) => {
      execute(insertTableLine(history.document, containerId, axis, at, allocator()), executeOptions)
    },
    removeTableLine: (containerId, axis, at, executeOptions) => {
      execute(removeTableLine(history.document, containerId, axis, at), executeOptions)
    },
    copy: () => {
      const copied = copySelection()
      if (copied !== undefined)
        clipboard = copied
      return copied
    },
    cut: (executeOptions) => {
      const copied = copySelection()
      if (copied === undefined)
        return undefined
      clipboard = copied
      deleteSelection(executeOptions)
      return copied
    },
    paste,
    duplicate: (executeOptions) => {
      const copied = copySelection()
      if (copied === undefined)
        return EMPTY_SELECTION
      const last = findNode(history.document, topmost(history.document, selection.nodes).at(-1)!)!
      return paste(copied, { parent: last.region?.id ?? null, index: last.index + 1 }, executeOptions)
    },
    validate: () => validateDocument(history.document, {
      extensions,
      ...(options.expressionEngine === undefined ? {} : { expressionEngine: options.expressionEngine }),
      ...(options.identifiers === undefined ? {} : { identifiers: options.identifiers }),
    }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
