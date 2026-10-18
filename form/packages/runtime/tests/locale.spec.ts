import type { FormPropertyDescriptor, FormSchemaIssue, FormSchemaIssueCode } from '@xihan-form/core'
import type { FormDesignerTranslations, FormRendererTranslations } from '../src'
import { BUILTIN_KINDS, FORM_SETTING_PROPERTIES, LINKAGE_ACTIONS, PROPERTY_GROUPS, propertyName } from '@xihan-form/core'
import * as shells from '@xihan-ui/designer-shell/locale'
import * as uiLocales from '@xihan-ui/web-components/locale'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS, DEFAULT_FORM_RENDERER_TRANSLATIONS } from '../src'
import * as locales from '../src/locale'

type Bucket = Record<string, unknown>
type Translations = Record<string, Bucket>

const suffix = (name: string): string => `${name[0]!.toUpperCase()}${name.slice(1)}`
const packs = Object.entries(locales).map(([name, pack]) => [name, pack.translations as unknown as Translations] as const)
const translated = packs.filter(([name]) => name !== 'formEnUS')
const english = locales.formEnUS.translations as unknown as Translations
const zh = designerOf(locales.formZhCN.translations as unknown as Translations)

function designerOf(translations: Translations): FormDesignerTranslations {
  return translations['xh-form-designer'] as unknown as FormDesignerTranslations
}

function rendererOf(translations: Translations): FormRendererTranslations {
  return translations['xh-form-renderer'] as unknown as FormRendererTranslations
}

const CODES = [
  'required',
  'invalid-type',
  'invalid-value',
  'out-of-range',
  'not-integer',
  'invalid-option',
  'invalid-color',
  'empty',
  'unknown-key',
  'duplicate-key',
  'duplicate-id',
  'unknown-control',
  'document.unsupportedVersion',
  'document.tooDeep',
  'node.unknownKind',
  'node.kindTypeMismatch',
  'region.childNotAllowed',
  'table.cellOutOfBounds',
  'table.cellOverlap',
  'table.cellGap',
  'rule.notApplicable',
  'rule.boundsMissing',
  'rule.invalidRange',
  'rule.invalidPattern',
  'linkage.actionNotApplicable',
  'expression.invalid',
  'field.dependencyWithoutSource',
  'field.unknownDependency',
  'field.selfDependency',
] as const satisfies readonly FormSchemaIssueCode[]

function issue(code: string, params: FormSchemaIssue['params'] = {}): FormSchemaIssue {
  return { code, path: [], params: { key: 'a', id: 'n1', kind: 'text', type: 'field', action: 'assign', row: 0, column: 1, max: 32, version: '2', ...params } }
}

/** 内建种类的全部属性：三组属性、容器的区域属性，以及表单设置。 */
function builtinProperties(): readonly (readonly [kind: string, group: string, descriptor: FormPropertyDescriptor])[] {
  const entries = BUILTIN_KINDS.flatMap((definition) => {
    const groups = PROPERTY_GROUPS.flatMap(group => definition.properties[group].map(descriptor => [definition.kind, group, descriptor] as const))
    const regions = definition.type === 'container' ? definition.regionProperties.map(descriptor => [definition.kind, 'region', descriptor] as const) : []
    return [...groups, ...regions]
  })
  return [...entries, ...FORM_SETTING_PROPERTIES.map(descriptor => ['', 'settings', descriptor] as const)]
}

describe('formZhCN', () => {
  it('含渲染器、设计器两桶，并带上设计器零件的中文文案', () => {
    const translations = locales.formZhCN.translations as unknown as Translations
    expect(rendererOf(translations).valueRequired).toBe('此项必填')
    expect(zh.label).toBe('表单设计器')
    expect(zh.nodeTag('text', 'name')).toBe('单行文本 · name')
    expect(zh.property('qrcode', 'basic', 'value')).toBe('编码内容')
    expect(zh.option('display', 'swatches')).toBe('色板')
    expect(translations['xh-designer-properties']).toMatchObject({ title: '属性' })
    expect(translations['xh-designer-issues']).toBeDefined()
    expect(translations['xh-designer-commands']).toMatchObject({ duplicate: '创建副本', toolbar: '设计器操作' })
    expect([zh.insertRowAbove, zh.insertColumnLeft, zh.removeColumn]).toEqual(['在上方插入行', '在左侧插入列', '删除列'])
  })

  it('问题说明带上参数与内建名字，认不出的种类、属性与问题码原样显示', () => {
    expect(zh.issue(issue('table.cellGap'))).toBe('表格第 1 行第 2 列空着')
    expect(zh.issue(issue('region.childNotAllowed', { kind: 'subtable' }))).toBe('这里不能放子表')
    expect(zh.issue(issue('rule.notApplicable', { kind: 'length' }))).toBe('长度规则不适用于这个字段')
    expect(zh.issue(issue('linkage.actionNotApplicable'))).toBe('「赋值」不适用于这里')
    expect(zh.issue(issue('vendor.custom'))).toBe('vendor.custom')
    expect([zh.kind('vendor-kind'), zh.property('vendor-kind', 'data', 'extra'), zh.option('size', 'xxl'), zh.kind('constructor')]).toEqual(['vendor-kind', 'extra', 'xxl', 'constructor'])
  })
})

describe('各语言的语言包', () => {
  it('语言与 UI 的内建语言包一一对应，导出名是 form 加 UI 的语言包名', () => {
    const expected = Object.keys(uiLocales).map(name => `form${suffix(name)}`).sort()
    expect(packs.map(([name]) => name).sort()).toEqual(expected)
  })

  it('英文包与缺省文案相同', () => {
    expect(english['xh-form-renderer']).toBe(DEFAULT_FORM_RENDERER_TRANSLATIONS)
    expect(english['xh-form-designer']).toBe(DEFAULT_FORM_DESIGNER_TRANSLATIONS)
  })

  it.each(packs)('%s 并入 designer-shell 同一语言的那份，两个桶的键与缺省文案一致，文案都不空', (name, translations) => {
    const shell = (shells as unknown as Record<string, { translations: Translations }>)[`designerShell${name.slice('form'.length)}`]!.translations
    expect(Object.keys(translations).sort()).toEqual([...Object.keys(shell), 'xh-form-designer', 'xh-form-renderer'].sort())
    for (const tag of Object.keys(shell))
      expect(translations[tag], tag).toEqual(shell[tag])
    for (const [tag, reference] of [['xh-form-renderer', DEFAULT_FORM_RENDERER_TRANSLATIONS], ['xh-form-designer', DEFAULT_FORM_DESIGNER_TRANSLATIONS]] as const) {
      const bucket = translations[tag]!
      expect(Object.keys(bucket).sort(), tag).toEqual(Object.keys(reference).sort())
      for (const [key, value] of Object.entries(bucket)) {
        expect(typeof value, `${tag}.${key}`).toBe(typeof (reference as unknown as Bucket)[key])
        if (typeof value === 'string')
          expect(value.trim(), `${tag}.${key}`).not.toBe('')
      }
    }
  })

  it.each(packs)('%s 的带参文案把入参写进去', (_name, translations) => {
    const renderer = rendererOf(translations)
    const designer = designerOf(translations)
    for (const count of [1, 2, 5, 21])
      expect(renderer.errorSummary(count)).toContain(String(count))
    expect(renderer.errorSummaryItem('Lbl', 'Msg')).toMatch(/Lbl[\s\S]*Msg/)
    for (const text of [renderer.valueTooShort(7), renderer.valueTooLong(7), renderer.valueTooSmall(7), renderer.valueTooLarge(7)])
      expect(text).toContain('7')
    expect(designer.unboundKey('amount')).toContain('amount')
    expect(designer.nodeTag('text', 'amount')).toContain('amount')
    expect(designer.issue(issue('duplicate-key', { key: 'amount' }))).toContain('amount')
    expect(designer.issue(issue('duplicate-id', { id: 'n42' }))).toContain('n42')
    expect(designer.issue(issue('document.unsupportedVersion', { version: '9' }))).toContain('9')
    expect(designer.issue(issue('document.tooDeep'))).toContain('32')
    expect(designer.issue(issue('node.unknownKind', { kind: 'vendor-kind' }))).toContain('vendor-kind')
    expect(designer.issue(issue('field.unknownDependency', { key: 'amount' }))).toContain('amount')
  })

  it.each(translated)('%s 的问题说明用本语言的种类、规则与动作名，表格的行列从 1 数起', (_name, translations) => {
    const designer = designerOf(translations)
    expect(designer.issue(issue('node.kindTypeMismatch'))).toContain(designer.kind('text'))
    expect(designer.issue(issue('region.childNotAllowed', { kind: 'subtable' }))).toContain(designer.kind('subtable'))
    expect(designer.issue(issue('rule.notApplicable', { kind: 'length' }))).toContain(designer.ruleKind('length'))
    expect(designer.issue(issue('linkage.actionNotApplicable'))).toContain(designer.linkageAction('assign'))
    expect(designer.issue(issue('table.cellGap', { row: 2, column: 6 }))).toMatch(/3[\s\S]*7/)
  })
})

describe('问题说明', () => {
  it('问题码列全了', () => {
    expectTypeOf<Exclude<FormSchemaIssueCode, (typeof CODES)[number]>>().toEqualTypeOf<never>()
  })

  it.each(packs)('%s 给每个模板结构问题码写了自己的说明', (_name, translations) => {
    const designer = designerOf(translations)
    for (const code of CODES) {
      const text = designer.issue(issue(code))
      expect(text.trim(), code).not.toBe('')
      expect(text, code).not.toBe(code)
    }
  })
})

describe('内建名字', () => {
  it.each(translated)('%s 的内建种类、分类、属性、规则与联动动作都有名字，不回落成键', (_name, translations) => {
    const designer = designerOf(translations)
    for (const definition of BUILTIN_KINDS) {
      expect(designer.kind(definition.kind), definition.kind).not.toBe(definition.kind)
      expect(designer.nodeTag(definition.kind, undefined), definition.kind).toBe(designer.kind(definition.kind))
      expect(designer.category(definition.category), definition.category).not.toBe(definition.category)
      for (const action of LINKAGE_ACTIONS[definition.type])
        expect(designer.linkageAction(action), action).not.toBe(action)
      for (const rule of definition.type === 'static' ? [] : definition.validations)
        expect(designer.ruleKind(rule), rule).not.toBe(rule)
    }
    for (const group of [...PROPERTY_GROUPS, 'region', 'settings'])
      expect(designer.group(group), group).not.toBe(group)
    for (const [kind, group, descriptor] of builtinProperties()) {
      const name = propertyName(descriptor)
      expect(designer.property(kind, group, name), `${kind}:${group}.${name}`).not.toBe(name)
    }
  })

  it.each(translated)('%s 给选项起名的范围与中文一致：中文有名字的取值都有名字，中文原样显示的技术取值也原样显示', (_name, translations) => {
    const designer = designerOf(translations)
    let named = 0
    for (const [, , descriptor] of builtinProperties()) {
      const control = descriptor.control
      if (control.kind !== 'select' || !('options' in control))
        continue
      const name = propertyName(descriptor)
      for (const option of control.options) {
        const value = String(option.value)
        expect(designer.option(name, value) !== value, `${name}.${value}`).toBe(zh.option(name, value) !== value)
        named += zh.option(name, value) === value ? 0 : 1
      }
    }
    expect(named).toBeGreaterThan(20)
  })
})
