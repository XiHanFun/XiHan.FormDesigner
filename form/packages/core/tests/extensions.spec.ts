import type { FormCoreExtension, FormDocument, StaticKindDefinition } from '../src'
import { DesignerExtensionError } from '@xihan-ui/designer-kit'
import { describe, expect, it } from 'vitest'
import { applyOperation, BUILTIN_KINDS, createFormModel, EMPTY_PROPERTY_SCHEMA, FORM_CORE_EXTENSION, FormOperationError, validateDocument } from '../src'
import { documentOf, fieldOf, setup } from './helpers'

const banner: StaticKindDefinition = {
  type: 'static',
  kind: 'banner',
  category: 'static',
  element: 'xh-alert',
  properties: { ...EMPTY_PROPERTY_SCHEMA, basic: [{ path: ['code'], control: { kind: 'cron' } }] },
}

const cron: FormCoreExtension = {
  id: '@acme/cron',
  kinds: [banner],
  controls: { cron: { check: value => (typeof value === 'string' && value.split(' ').length === 5 ? undefined : 'cron.invalid') } },
  documentProperties: [{ path: ['theme'], control: { kind: 'text' } }],
}

function bannerNode(code: unknown): Record<string, unknown> {
  return { type: 'static', id: 'b1', kind: 'banner', basic: { code }, data: {}, appearance: {}, linkage: [] }
}

function caught(run: () => unknown): DesignerExtensionError {
  try {
    run()
  }
  catch (error) {
    if (error instanceof DesignerExtensionError)
      return error
    throw error
  }
  throw new Error('应当抛出 DesignerExtensionError')
}

describe('表单模型：扩展的合并与查重', () => {
  it('内置扩展在前，扩展的种类与表单设置追加在后；同一个数组只合一次', () => {
    const list = [cron]
    const model = createFormModel(list)
    expect(model.extensions).toEqual([FORM_CORE_EXTENSION, cron])
    expect(model.registry.list().map(definition => definition.kind)).toEqual([...BUILTIN_KINDS.map(definition => definition.kind), 'banner'])
    expect(model.documentProperties.at(-1)?.path).toEqual(['theme'])
    expect(Object.keys(model.controls)).toEqual(['tree-options', 'cron'])
    expect(createFormModel(list)).toBe(model)
    expect(createFormModel().registry.get('banner')).toBeUndefined()
  })

  it('扩展 id、种类名、表单设置的属性名与编辑方式重名时抛扩展冲突，报出两个扩展', () => {
    const kind = caught(() => createFormModel([{ id: 'a', kinds: [{ ...banner, kind: 'text' }] }]))
    expect([kind.code, kind.space, kind.key, kind.extensions]).toEqual(['designer.extension-conflict', 'kind', 'text', ['@xihan-form/core', 'a']])
    expect(caught(() => createFormModel([cron, { id: '@acme/cron' }])).space).toBe('extension')
    expect(caught(() => createFormModel([{ id: 'a', documentProperties: [{ path: ['size'], control: { kind: 'text' } }] }])).space).toBe('document-property')
    expect(caught(() => createFormModel([{ id: 'a', controls: { options: {} } }])).space).toBe('control')
    expect(caught(() => createFormModel([{ id: 'a', controls: { text: {} } }])).extensions).toEqual(['builtin', 'a'])
  })
})

describe('schema 自校验：扩展', () => {
  it('扩展的种类、表单设置与编辑方式按传入的扩展认；没装上时种类报 node.unknownKind', () => {
    const document = { ...documentOf([]), settings: { theme: 'dark' }, children: [bannerNode('0 8 * * 1')] }
    expect(validateDocument(document, { extensions: [cron] })).toEqual([])
    expect(validateDocument({ ...document, children: [bannerNode('daily')] }, { extensions: [cron] }).map(issue => [issue.code, issue.path])).toEqual([['cron.invalid', ['children', 0, 'basic', 'code']]])
    expect(validateDocument(document).map(issue => issue.code)).toEqual(['unknown-key', 'node.unknownKind'])
  })

  it('既不是内建也没登记的编辑方式报 unknown-control', () => {
    const odd: FormCoreExtension = { id: 'odd', kinds: [{ ...banner, kind: 'odd' }] }
    const node = { ...bannerNode('x'), kind: 'odd' }
    expect(validateDocument(documentOf([node as never]), { extensions: [odd] }).map(issue => issue.code)).toEqual(['unknown-control'])
  })

  it('按扩展顺序跑规则；文档缺了必需的部分时不跑', () => {
    const seen: number[] = []
    const rules: FormCoreExtension = {
      id: '@acme/limits',
      rules: [(document, context) => {
        seen.push(document.children.length)
        return document.children.length > 1 && context.registry.get('text') !== undefined ? [{ code: 'limits.too-many', path: ['children'] }] : []
      }],
    }
    const { registry, ids } = setup()
    const two = documentOf([fieldOf(registry, ids, 'text', 'a'), fieldOf(registry, ids, 'text', 'b')])
    expect(validateDocument(two, { extensions: [rules] }).map(issue => [issue.code, issue.severity])).toEqual([['limits.too-many', 'error']])
    expect(validateDocument(two, { extensions: [rules], severity: { 'limits.too-many': 'warning' } }).map(issue => issue.severity)).toEqual(['warning'])
    expect(validateDocument({ schemaVersion: 1, settings: {} }, { extensions: [rules] }).map(issue => issue.code)).toEqual(['required'])
    expect(seen).toEqual([2, 2])
    expect(() => validateDocument(two, { extensions: [{ id: '@acme/bad', rules: [() => [{ code: 'oops', path: [] }]] }] })).toThrow(TypeError)
  })

  it('文档与节点上的扩展数据只查形状：必须是对象，每个扩展的那一块也必须是对象', () => {
    const { registry, ids } = setup()
    const name = fieldOf(registry, ids, 'text', 'name')
    const document: FormDocument = { ...documentOf([{ ...name, extensions: { '@acme/audit': { owner: 'x' } } }]), extensions: { '@acme/audit': { revision: 3 } } }
    expect(validateDocument(document)).toEqual([])
    const broken = { ...document, extensions: [], children: [{ ...name, extensions: { '@acme/audit': 1 } }] }
    expect(validateDocument(broken).map(issue => [issue.code, issue.path, issue.target?.id])).toEqual([
      ['invalid-type', ['extensions'], undefined],
      ['invalid-type', ['children', 0, 'extensions', '@acme/audit'], name.id],
    ])
  })
})

describe('编辑操作：扩展数据', () => {
  it('写入与去掉文档或节点上某个扩展的数据，别的扩展的数据不动，逆操作恢复原样', () => {
    const { registry, ids } = setup()
    const name = fieldOf(registry, ids, 'text', 'name')
    const document = documentOf([{ ...name, extensions: { other: { keep: true } } }])
    const set = applyOperation(document, { type: 'setExtensionData', nodeId: name.id, id: '@acme/audit', data: { owner: 'x' } })
    expect(set.document.children[0]!.extensions).toEqual({ 'other': { keep: true }, '@acme/audit': { owner: 'x' } })
    expect(applyOperation(set.document, set.inverse[0]!).document).toEqual(document)
    const top = applyOperation(document, { type: 'setExtensionData', nodeId: null, id: '@acme/audit', data: { revision: 1 } })
    expect(top.document.extensions).toEqual({ '@acme/audit': { revision: 1 } })
    const removed = applyOperation(top.document, top.inverse[0]!)
    expect('extensions' in removed.document).toBe(false)
    expect(applyOperation(document, { type: 'setExtensionData', nodeId: null, id: 'none' }).document).toBe(document)
    expect(() => applyOperation(document, { type: 'setExtensionData', nodeId: null, id: 'x', data: [] as never })).toThrow(FormOperationError)
  })
})
