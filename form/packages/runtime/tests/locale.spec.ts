import type { FormSchemaIssue, FormSchemaIssueCode } from '@xihan-form/core'
import type { FormDesignerTranslations, FormRendererTranslations } from '../src'
import { BUILTIN_KINDS, FORM_SETTING_PROPERTIES, PROPERTY_GROUPS, propertyName } from '@xihan-form/core'
import { describe, expect, it } from 'vitest'
import { DEFAULT_FORM_DESIGNER_TRANSLATIONS } from '../src'
import { formZhCN } from '../src/locale'

const translations = formZhCN.translations as Readonly<Record<string, unknown>>
const designer = translations['xh-form-designer'] as FormDesignerTranslations

const CODES: readonly FormSchemaIssueCode[] = [
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
]

function issue(code: FormSchemaIssueCode): FormSchemaIssue {
  return { code, path: [], params: { key: 'a', id: 'n1', kind: 'text', type: 'field', action: 'assign', row: 0, column: 1, max: 32, version: '2' } }
}

describe('表单语言包', () => {
  it('含渲染器、设计器两桶，并带上设计器零件的中文文案', () => {
    expect((translations['xh-form-renderer'] as FormRendererTranslations).valueRequired).toBe('此项必填')
    expect(designer.label).toBe('表单设计器')
    expect(translations['xh-designer-properties']).toMatchObject({ title: '属性' })
    expect(translations['xh-designer-issues']).toBeDefined()
  })

  it('内置种类、分类与属性名都有中文，不回落成键名', () => {
    for (const definition of BUILTIN_KINDS) {
      expect(designer.kind(definition.kind)).not.toBe(definition.kind)
      expect(designer.category(definition.category)).not.toBe(definition.category)
      const groups = PROPERTY_GROUPS.flatMap(group => definition.properties[group].map(descriptor => [group, propertyName(descriptor)] as const))
      const regions = definition.type === 'container' ? definition.regionProperties.map(descriptor => ['region', propertyName(descriptor)] as const) : []
      for (const [group, name] of [...groups, ...regions])
        expect(designer.property(definition.kind, group, name), `${definition.kind}:${group}.${name}`).not.toBe(name)
    }
    for (const descriptor of FORM_SETTING_PROPERTIES)
      expect(designer.property('', 'settings', propertyName(descriptor))).not.toBe(propertyName(descriptor))
  })

  it('全部模板结构问题码都有中文与英文说明', () => {
    for (const code of CODES) {
      expect(designer.issue(issue(code)), code).not.toBe('')
      expect(DEFAULT_FORM_DESIGNER_TRANSLATIONS.issue(issue(code)), code).not.toBe('')
    }
    expect(designer.issue(issue('table.cellGap'))).toBe('表格第 1 行第 2 列空着')
  })
})
