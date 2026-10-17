import type { FieldNode, FormCoreExtension, FormDocument } from '@xihan-form/core'
import { BUILTIN_FIELDS, createDocument, createFormModel, createNode } from '@xihan-form/core'
import { CLIPBOARD_FORMAT, createIdAllocator, encodeClipboard } from '@xihan-ui/designer-kit'
import { describe, expect, it } from 'vitest'
import { createFormEditor, decodeFormClipboard, encodeFormClipboard, readFormClipboard, writeFormClipboard } from '../src'

const registry = createFormModel().registry

function sample(): { document: FormDocument, name: FieldNode, twin: FieldNode } {
  const ids = createIdAllocator('s')
  const name = createNode(registry, 'text', ids, { key: 'name' }) as FieldNode
  const twin = createNode(registry, 'text', createIdAllocator('t'), { key: 'name' }) as FieldNode
  return { document: { ...createDocument(), children: [name] }, name, twin }
}

class Data {
  readonly store = new Map<string, string>()
  setData(type: string, value: string): void {
    this.store.set(type, value)
  }

  getData(type: string): string {
    return this.store.get(type) ?? ''
  }
}

describe('表单剪贴板', () => {
  it('序列化后原样读回；节点之间重名的键照样读出', () => {
    const { name, twin } = sample()
    const text = encodeFormClipboard({ nodes: [name, twin] })
    expect(JSON.parse(text)).toMatchObject({ format: CLIPBOARD_FORMAT, product: 'form', version: 1 })
    expect(decodeFormClipboard(text)).toEqual({ nodes: [name, twin] })
  })

  it('别的产品、版本不认得、结构不合法、种类未登记、id 重复、空列表都读不出', () => {
    const { name } = sample()
    expect(decodeFormClipboard(encodeClipboard('flow', 1, { nodes: [] }))).toBeUndefined()
    expect(decodeFormClipboard(encodeClipboard('form', 2, { nodes: [name] } as never))).toBeUndefined()
    expect(decodeFormClipboard(encodeClipboard('form', 1, { nodes: [{ id: 'x' }] }))).toBeUndefined()
    const slug: FormCoreExtension = { id: 'slug', kinds: [{ ...BUILTIN_FIELDS[0]!, kind: 'slug' }] }
    const custom = createNode(createFormModel([slug]).registry, 'slug', createIdAllocator('u'), { key: 'path' })
    expect(decodeFormClipboard(encodeFormClipboard({ nodes: [custom] }))).toBeUndefined()
    expect(decodeFormClipboard(encodeFormClipboard({ nodes: [custom] }), [slug])).toEqual({ nodes: [custom] })
    expect(decodeFormClipboard(encodeFormClipboard({ nodes: [name, name] }))).toBeUndefined()
    expect(decodeFormClipboard(encodeFormClipboard({ nodes: [] }))).toBeUndefined()
    expect(decodeFormClipboard('not json')).toBeUndefined()
  })

  it('写进剪贴板事件的两种类型，读的时候先取表单自己的类型；读出的内容能直接粘贴', () => {
    const { document, name } = sample()
    const data = new Data()
    writeFormClipboard(data as unknown as DataTransfer, { nodes: [name] })
    expect([...data.store.keys()]).toEqual(['application/x-xihan-form+json', 'text/plain'])
    data.store.delete('application/x-xihan-form+json')
    const read = readFormClipboard(data as unknown as DataTransfer)!
    const editor = createFormEditor({ document })
    const pasted = editor.paste(read)
    expect(pasted.nodes).toHaveLength(1)
    expect(readFormClipboard(new Data() as unknown as DataTransfer)).toBeUndefined()
  })
})
