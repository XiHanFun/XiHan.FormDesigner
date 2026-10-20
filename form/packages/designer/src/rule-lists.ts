/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 校验规则与联动规则两个页签的内容：每条规则一张 <xh-designer-properties>，标题是规则种类或联动动作，
// 头部带删除钮；列表末尾是「添加规则」菜单。规则卡片按规则 id 复用，编辑中的字段不丢焦点。
// 表达式参数用 <xh-expression-input> 编辑，各卡片共用同一张编辑器表。

import type { FormDocument, FormNode, FormSchemaIssue, KindRegistry, RuleList } from '@xihan-form/core'
import type { FormDesignerTranslations } from '@xihan-form/runtime'
import type { IconRecord } from '@xihan-ui/core'
import type { PropertyEditorTable } from '@xihan-ui/designer-kit/properties'
import type { DesignerPropertiesEventMap, DesignerPropertyEditor, XhDesignerPropertiesElement } from '@xihan-ui/designer-shell'
import type { ExpressionEngine } from '@xihan-ui/expression'
import type { FormEditor } from './editor'
import { PlusIcon, TrashIcon } from '@xihan-ui/icons'
import { createAuthoredElement, setAttributes, setText, SVG_NS } from '@xihan-ui/web-components/authoring'
import { createExpressionEditor, EXPRESSION_CONTROL } from './expression-editor'
import { hasRuleList, newRule, nextRule, ruleChoices, ruleErrors, ruleFieldLabel, rulesOf, ruleTarget, ruleTitle } from './rules'

/** 规则列表需要设计器提供的能力。 */
export interface RuleListsHost {
  readonly ownerDocument: Document
  readonly editor: FormEditor
  readonly registry: () => KindRegistry
  readonly translations: () => FormDesignerTranslations
  readonly readonly: () => boolean
  /** 检查规则里的表达式用。 */
  readonly expressionEngine: () => ExpressionEngine
  /** 等设计器把这一轮更新做完，规则卡片才建好。 */
  readonly settled: () => Promise<unknown>
}

interface ListParts {
  readonly element: HTMLElement
  readonly empty: HTMLElement
  readonly add: HTMLElement
  readonly addLabel: HTMLElement
  readonly addMenu: HTMLElement
  readonly addItems: HTMLElement
  readonly panels: Map<string, XhDesignerPropertiesElement>
}

const LISTS: readonly RuleList[] = ['validation', 'linkage']

/** 一个只放图标的按钮，可及名由调用方写上。 */
export function iconElement(doc: Document, icon: IconRecord): HTMLElement {
  const svg = doc.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('data-xh-part', 'root')
  const glyph = doc.createElementNS(SVG_NS, 'g')
  glyph.setAttribute('data-xh-part', 'glyph')
  svg.append(glyph)
  const mark: HTMLElement & { icon?: IconRecord } = createAuthoredElement(doc, 'xh-icon', { size: 'sm' }, [svg])
  mark.icon = icon
  return mark
}

/** 把 children 依次放进 parent，已经在位的节点不动，避免移走正在编辑的字段。 */
function place(parent: HTMLElement, children: readonly HTMLElement[]): void {
  children.forEach((child, index) => {
    const current = parent.children[index]
    if (current !== child)
      parent.insertBefore(child, current ?? null)
  })
  while (parent.children.length > children.length)
    parent.lastElementChild!.remove()
}

export class RuleLists {
  readonly #host: RuleListsHost
  readonly #lists: Readonly<Record<RuleList, ListParts>>
  readonly #editors: PropertyEditorTable<DesignerPropertyEditor>
  #document: FormDocument | undefined
  #node: FormNode | undefined

  constructor(host: RuleListsHost) {
    this.#host = host
    this.#editors = {
      byControl: {
        [EXPRESSION_CONTROL]: createExpressionEditor({
          ownerDocument: host.ownerDocument,
          document: () => this.#document,
          node: () => this.#node,
          engine: host.expressionEngine,
          translations: host.translations,
        }),
      },
    }
    this.#lists = { validation: this.#build('validation'), linkage: this.#build('linkage') }
  }

  /** 页签内容：一个规则列表的根节点。 */
  element(list: RuleList): HTMLElement {
    return this.#lists[list].element
  }

  /** 按选中的节点重排两个列表；node 为 undefined 时清空。 */
  sync(document: FormDocument, node: FormNode | undefined, issues: readonly FormSchemaIssue[]): void {
    this.#document = document
    this.#node = node
    const t = this.#host.translations()
    for (const list of LISTS) {
      const parts = this.#lists[list]
      const rules = node === undefined ? [] : rulesOf(node, list)
      const choices = node === undefined || !hasRuleList(node, list, this.#host.registry()) ? [] : ruleChoices(node, list, this.#host.registry())
      const errors = node === undefined ? new Map() : ruleErrors(document, node, list, issues, issue => t.issue(issue))
      const used = new Set<string>()
      const panels = rules.map((rule) => {
        used.add(rule.id)
        let panel = parts.panels.get(rule.id)
        if (panel === undefined) {
          panel = this.#panel(list)
          parts.panels.set(rule.id, panel)
        }
        panel.editors = this.#editors
        panel.targets = [ruleTarget(node!, list, rule)]
        panel.translations = { title: ruleTitle(list, rule, t) }
        panel.labelOf = descriptor => ruleFieldLabel(descriptor, t)
        panel.optionLabel = (_descriptor, option) => t.linkageAction(String(option.value))
        panel.readonly = this.#host.readonly()
        panel.errors = errors.get(rule.id) ?? []
        const remove = panel.querySelector<HTMLElement>('[data-part="rule-remove"] button')
        if (remove !== null)
          setAttributes(remove, { 'aria-label': t.removeRule, 'title': t.removeRule })
        return panel
      })
      for (const [id, panel] of parts.panels) {
        if (!used.has(id)) {
          panel.remove()
          parts.panels.delete(id)
        }
      }
      setText(parts.empty, t.noRules)
      parts.empty.hidden = rules.length > 0
      setText(parts.addLabel, t.addRule)
      parts.add.hidden = this.#host.readonly() || choices.length === 0
      if (choices.length > 0) {
        const label = (choice: string): string => list === 'validation' ? t.ruleKind(choice) : t.linkageAction(choice)
        const key = choices.map(choice => `${choice}\u0000${label(choice)}`).join('\u0001')
        if (parts.addItems.dataset.key !== key) {
          parts.addItems.dataset.key = key
          parts.addItems.replaceChildren(...choices.map(choice => createAuthoredElement(this.#host.ownerDocument, 'div', { 'data-xh-part': 'item', 'value': choice }, [
            createAuthoredElement(this.#host.ownerDocument, 'span', { 'data-xh-part': 'item-text' }, [label(choice)]),
          ])))
        }
      }
      place(parts.element, [parts.empty, ...panels, parts.add])
    }
  }

  /** 把焦点交给某条规则的某个参数；找不到时返回 false。 */
  async focusRule(list: RuleList, ruleId: string, path: readonly (string | number)[] | undefined): Promise<boolean> {
    await this.#host.settled()
    const panel = this.#lists[list].panels.get(ruleId)
    if (panel === undefined)
      return false
    await panel.updateComplete
    const first = panel.targets?.[0]?.descriptors[0]?.path
    const target = path ?? first
    return target === undefined ? false : panel.focusField(target)
  }

  #build(list: RuleList): ListParts {
    const doc = this.#host.ownerDocument
    const empty = createAuthoredElement(doc, 'p', { 'data-part': 'rule-empty' })
    const addLabel = createAuthoredElement(doc, 'span', {})
    const addItems = createAuthoredElement(doc, 'div', { 'data-xh-part': 'content' }, [
      createAuthoredElement(doc, 'div', { 'data-xh-part': 'item', 'value': '' }, [createAuthoredElement(doc, 'span', { 'data-xh-part': 'item-text' })]),
    ])
    const trigger = createAuthoredElement(doc, 'xh-button', { 'data-xh-part': 'trigger', 'variant': 'subtle', 'size': 'sm' }, [
      createAuthoredElement(doc, 'button', { 'data-xh-part': 'root', 'type': 'button' }, [iconElement(doc, PlusIcon), addLabel]),
    ])
    const addMenu = createAuthoredElement(doc, 'xh-menu', { size: 'sm' }, [trigger, createAuthoredElement(doc, 'div', { 'data-xh-part': 'positioner' }, [addItems])])
    addMenu.addEventListener('item-select', (event) => {
      event.stopPropagation()
      const node = this.#node
      const choice = (event as CustomEvent<{ value: string }>).detail.value
      if (node === undefined || choice === '' || this.#host.readonly())
        return
      const created = this.#host.editor.addRule(node.id, list, newRule(list, choice))
      void this.focusRule(list, created.id, undefined)
    })
    const add = createAuthoredElement(doc, 'div', { 'data-part': 'rule-add' }, [addMenu])
    const element = createAuthoredElement(doc, 'div', { 'data-part': 'rule-list', 'data-list': list }, [empty, add])
    return { element, empty, add, addLabel, addMenu, addItems, panels: new Map() }
  }

  /** 一条规则的卡片：参数写入换成整条规则，删除钮删掉这条规则。 */
  #panel(list: RuleList): XhDesignerPropertiesElement {
    const doc = this.#host.ownerDocument
    const removeButton = createAuthoredElement(doc, 'button', { 'data-xh-part': 'root', 'type': 'button' }, [iconElement(doc, TrashIcon)])
    const remove = createAuthoredElement(doc, 'xh-button', { 'slot': 'header', 'data-part': 'rule-remove', 'variant': 'ghost', 'size': 'sm', 'icon-only': true, 'tone': 'danger' }, [removeButton])
    const panel = createAuthoredElement(doc, 'xh-designer-properties', { 'data-part': 'rule' }, [remove])
    const ruleId = (): string | undefined => panel.targets?.[0]?.id
    panel.addEventListener('property-change', (event) => {
      event.stopPropagation()
      const node = this.#node
      const id = ruleId()
      const { path, value } = (event as DesignerPropertiesEventMap['property-change']).detail
      const rule = node === undefined ? undefined : rulesOf(node, list).find(item => item.id === id)
      if (node === undefined || rule === undefined || this.#host.readonly() || path.length !== 1 || typeof path[0] !== 'string')
        return
      this.#host.editor.updateRule(node.id, list, nextRule(list, rule, path[0], value), { mergeWithin: Number.POSITIVE_INFINITY })
    })
    panel.addEventListener('property-commit', (event) => {
      event.stopPropagation()
      this.#host.editor.seal()
    })
    removeButton.addEventListener('click', () => {
      const node = this.#node
      const id = ruleId()
      if (node !== undefined && id !== undefined && !this.#host.readonly())
        this.#host.editor.removeRule(node.id, list, id)
    })
    return panel
  }
}
