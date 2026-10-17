// @vitest-environment jsdom

import type { ContainerNode, FormDocument, StaticNode } from '@xihan-form/core'
import type { JsonValue } from '@xihan-ui/core/json'
import type { FieldRenderer, FormRendererEventMap, XhFormRenderer } from '../src'
import { BUILTIN_KINDS, createBuiltinKindRegistry, createKindRegistry, createNode, EMPTY_PROPERTY_SCHEMA, instanceKey } from '@xihan-form/core'
import { onDiagnostic, setDiagnosticsLevel } from '@xihan-ui/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'
import { getFormPathValue } from '@xihan-ui/headless'
import { mergeXhConfig, setXhConfig } from '@xihan-ui/web-components'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { zhCN } from '@xihan-ui/web-components/locale'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineFormRenderer, FORM_RENDERER_TAG, FormRuntimeError } from '../src'
import { formZhCN } from '../src/locale'
import { container, documentOf, field, setup } from './helpers'

defineXhElements()
defineFormRenderer()

const mounted: Element[] = []

afterEach(() => {
  for (const element of mounted.splice(0))
    element.remove()
  setXhConfig({})
})

function sample(): { document: FormDocument, ids: { name: string, level: string, note: string, card: string } } {
  const { registry, ids } = setup()
  const name = field(registry, ids, 'text', 'name', { basic: { label: '姓名' }, validation: [{ id: 'r1', kind: 'required' }] })
  const level = field(registry, ids, 'select', 'level', { data: { options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] } })
  const note = field(registry, ids, 'text', 'note', { linkage: [{ id: 'l1', action: 'hide', when: 'level != \'b\'' }] })
  const card = container(registry, ids, 'card', [level, note], { basic: { title: '附加' } })
  return { document: documentOf([name, card]), ids: { name: name.id, level: level.id, note: note.id, card: card.id } }
}

async function mount(setup: (renderer: XhFormRenderer) => void): Promise<XhFormRenderer> {
  const renderer = window.document.createElement(FORM_RENDERER_TAG)
  setup(renderer)
  window.document.body.append(renderer)
  mounted.push(renderer)
  await renderer.updateComplete
  return renderer
}

function events<K extends keyof FormRendererEventMap>(target: EventTarget, type: K): FormRendererEventMap[K]['detail'][] {
  const out: FormRendererEventMap[K]['detail'][] = []
  target.addEventListener(type, event => out.push((event as FormRendererEventMap[K]).detail))
  return out
}

function group(renderer: XhFormRenderer, path: readonly (string | number)[]): HTMLElement {
  return renderer.querySelector<HTMLElement>(`[data-xh-part="field-group"][data-path='${JSON.stringify(path)}']`)!
}

describe('<xh-form-renderer>：结构', () => {
  it('外层是 xh-form，字段各在一个带 data-path 的字段组里，容器用对应的 UI 元素', async () => {
    const { document } = sample()
    const renderer = await mount((element) => {
      element.schema = document
    })
    const form = renderer.querySelector('xh-form')!
    expect(form.querySelector('form[data-xh-part="root"]')).not.toBeNull()
    expect(group(renderer, ['name']).querySelector('xh-text-field')).not.toBeNull()
    expect(renderer.querySelector('xh-card [data-xh-part="title"]')!.textContent).toBe('附加')
    expect(group(renderer, ['level']).closest('xh-card')).not.toBeNull()
    expect(group(renderer, ['name']).querySelector('label')!.textContent).toBe('姓名')
    expect(renderer.querySelectorAll('[data-xh-part="error-summary-item"]')).toHaveLength(3)
  })

  it('容器里的字段组也归 xh-form 接线', async () => {
    const { document } = sample()
    const renderer = await mount((element) => {
      element.schema = document
    })
    expect(group(renderer, ['level']).getAttribute('data-scope')).toBe('form')
    expect(group(renderer, ['name']).getAttribute('data-scope')).toBe('form')
  })

  it('字段组放在各种容器里，UI 元素都不报部件诊断', async () => {
    const { registry, ids } = setup()
    const leaf = (key: string) => field(registry, ids, 'text', key)
    const document = documentOf([
      container(registry, ids, 'grid', [leaf('a')]),
      container(registry, ids, 'tabs', [leaf('b')]),
      container(registry, ids, 'collapse', [leaf('c')]),
      container(registry, ids, 'card', [container(registry, ids, 'fieldset', [leaf('d')])]),
      container(registry, ids, 'table', [leaf('e')]),
    ])
    const codes: string[] = []
    setDiagnosticsLevel('warn')
    const stop = onDiagnostic(record => codes.push(record.code))
    let renderer: XhFormRenderer
    try {
      renderer = await mount((element) => {
        element.schema = document
      })
      await Promise.resolve()
    }
    finally {
      stop()
      setDiagnosticsLevel('silent')
    }
    expect(codes.filter(code => code.startsWith('wc.'))).toEqual([])
    expect(renderer.querySelectorAll('[data-xh-part="field-group"][data-scope="form"]')).toHaveLength(5)
  })

  it('表格布局的行列数取外观属性', async () => {
    const { registry, ids } = setup()
    const table = container(registry, ids, 'table', [field(registry, ids, 'text', 'a')])
    const renderer = await mount((element) => {
      const cell = { ...table.regions[0]!, props: { row: 0, column: 0, rowSpan: 1, columnSpan: 3 } }
      element.schema = documentOf([{ ...table, appearance: { ...table.appearance, rows: 1, columns: 3 }, regions: [cell] }])
    })
    const grid = renderer.querySelector('xh-grid')!
    expect([grid.getAttribute('cols'), grid.getAttribute('rows')]).toEqual(['3', '1'])
    expect(grid.querySelector('[data-xh-part="item"]')!.getAttribute('span')).toBe('3')
  })

  it('表格布局显示格线时用栅格的 ruled，关掉 bordered 就不画', async () => {
    const { registry, ids } = setup()
    const table = container(registry, ids, 'table', [])
    const bordered = await mount((element) => {
      element.schema = documentOf([table])
    })
    expect(bordered.querySelector('xh-grid')!.hasAttribute('ruled')).toBe(true)
    const plain = await mount((element) => {
      element.schema = documentOf([{ ...table, appearance: { ...table.appearance, bordered: false } }])
    })
    expect(plain.querySelector('xh-grid')!.hasAttribute('ruled')).toBe(false)
  })

  it('联动隐藏落在字段组的 hidden 上，条件变了随之显隐', async () => {
    const { document } = sample()
    const renderer = await mount((element) => {
      element.schema = document
    })
    expect(group(renderer, ['note']).hidden).toBe(true)
    renderer.setValue(['level'], 'b')
    expect(group(renderer, ['note']).hidden).toBe(false)
  })

  it('没有渲染方式的种类派发 schema-error，元素清空；方法在此时抛 XH_FORM_RT_NOT_READY', async () => {
    const registry = createKindRegistry([...BUILTIN_KINDS, { type: 'static', kind: 'banner', category: 'static', element: 'div', properties: EMPTY_PROPERTY_SCHEMA }])
    const banner = createNode(registry, 'banner', createIdAllocator('b'))
    const renderer = window.document.createElement(FORM_RENDERER_TAG)
    const errors = events(renderer, 'schema-error')
    renderer.registry = registry
    renderer.schema = documentOf([banner])
    window.document.body.append(renderer)
    mounted.push(renderer)
    await renderer.updateComplete
    expect(errors.map(error => [error.code, error.data])).toEqual([['XH_FORM_RT_NO_RENDERER', { kind: 'banner' }]])
    expect(renderer.childElementCount).toBe(0)
    expect(renderer.controller).toBeNull()
    expect(() => renderer.getFormData()).toThrow(FormRuntimeError)
  })

  it('模板没通过自校验时派发 schema-error，带上问题列表', async () => {
    const renderer = window.document.createElement(FORM_RENDERER_TAG)
    const errors = events(renderer, 'schema-error')
    renderer.schema = { schemaVersion: 1, settings: {}, children: [{ type: 'field' }] } as unknown as FormDocument
    expect(renderer.controller).toBeNull()
    expect(errors[0]!.code).toBe('XH_FORM_RT_INVALID_DOCUMENT')
    expect(errors[0]!.issues.length).toBeGreaterThan(0)
  })
})

describe('<xh-form-renderer>：值与事件', () => {
  it('控件改值写进控制器，派发 value-change；控件内部的同名事件不越过渲染器', async () => {
    const { document } = sample()
    const renderer = await mount((element) => {
      element.schema = document
    })
    const changes = events(renderer, 'value-change')
    const input = group(renderer, ['name']).querySelector('xh-text-field')!
    input.dispatchEvent(new CustomEvent('value-change', { detail: { value: '张三' }, bubbles: true, composed: true }))
    expect(renderer.getFormData().name).toBe('张三')
    expect(changes).toEqual([{ paths: [['name']], values: renderer.getFormData() }])
  })

  it('控制器里的值写回控件：下拉的单值写成数组', async () => {
    const { document } = sample()
    const renderer = await mount((element) => {
      element.schema = document
    })
    renderer.setValue(['level'], 'a')
    const select = group(renderer, ['level']).querySelector('xh-select') as HTMLElement & { value?: unknown }
    expect(select.value).toEqual(['a'])
    expect(select.querySelectorAll('[data-xh-part="item"]')).toHaveLength(2)
    const collection = (select as HTMLElement & { collection?: unknown }).collection
    renderer.setValue(['name'], '甲')
    renderer.setValue(['level'], 'b')
    expect((select as HTMLElement & { collection?: unknown }).collection).toBe(collection)
  })

  it('values 是初始数据兼基准；建好后再赋值等于带基准的 setFormData，与当前值相同时不动', async () => {
    const { document } = sample()
    const renderer = await mount((element) => {
      element.values = { name: '甲' }
      element.schema = document
    })
    expect(renderer.getFormData().name).toBe('甲')
    renderer.setValue(['name'], '乙')
    expect(renderer.isDirty()).toBe(true)
    renderer.values = renderer.getFormData()
    expect(renderer.isDirty()).toBe(true)
    renderer.values = { name: '丙' }
    expect(renderer.getFormData().name).toBe('丙')
    expect(renderer.isDirty()).toBe(false)
  })

  it('同一拍里先后赋多个属性只建一次控制器；赋值后立即调用方法也拿得到结果', async () => {
    const { document } = sample()
    const renderer = window.document.createElement(FORM_RENDERER_TAG)
    const ready = events(renderer, 'ready')
    renderer.schema = document
    renderer.values = { name: '甲' }
    renderer.variables = { $user: 'u' }
    expect(renderer.getFormData().name).toBe('甲')
    window.document.body.append(renderer)
    mounted.push(renderer)
    await renderer.updateComplete
    expect(ready).toHaveLength(1)
    expect(ready[0]!.controller).toBe(renderer.controller)
  })

  it('validate 把问题写进 xh-form 的 errors 与错误摘要，派发 issues-change；失焦触发单字段校验', async () => {
    const { document } = sample()
    setXhConfig(formZhCN)
    const renderer = await mount((element) => {
      element.schema = document
    })
    const issues = events(renderer, 'issues-change')
    expect(renderer.validate().valid).toBe(false)
    const form = renderer.querySelector('xh-form') as HTMLElement & { errors?: Record<string, string> }
    expect(getFormPathValue(form.errors as never, ['name'])).toBe('此项必填')
    expect(renderer.querySelector('[data-xh-part="error-summary-item"]')!.textContent).toBe('姓名：此项必填')
    expect(renderer.querySelector('[data-xh-part="error-summary"] p')!.textContent).toBe('共 1 处需要修改')
    expect(issues.map(item => item.paths)).toEqual([[['name']]])
    renderer.reset()
    group(renderer, ['name']).dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(renderer.controller!.getIssues().map(issue => issue.code)).toEqual(['XH_FORM_VALUE_REQUIRED'])
  })

  it.each([
    ['text', 'xh-text-field input'],
    ['password', 'xh-password-input input'],
  ])('提示与错误文案落在 xh-field 的说明与错误部件上，并接到 %s 的输入框', async (kind, selector) => {
    const { registry, ids } = setup()
    const name = field(registry, ids, kind, 'name', { basic: { label: '姓名', hint: '与证件一致' }, validation: [{ id: 'r1', kind: 'required' }] })
    setXhConfig(formZhCN)
    const renderer = await mount((element) => {
      element.schema = documentOf([name])
    })
    renderer.validate()
    await renderer.updateComplete
    const shell = group(renderer, ['name']).querySelector('xh-field')!
    await (shell as HTMLElement & { updateComplete?: Promise<boolean> }).updateComplete
    const description = shell.querySelector('[data-xh-part="description"]')!
    const error = shell.querySelector('[data-xh-part="error-text"]')!
    const label = shell.querySelector('[data-xh-part="label"]')!
    expect([description.textContent, error.textContent]).toEqual(['与证件一致', '此项必填'])
    const input = shell.querySelector(selector)!
    expect(input.getAttribute('aria-describedby')!.split(' ')).toEqual([description.id, error.id])
    expect(input.getAttribute('aria-labelledby')).toBe(label.id)
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('名字链与描述链只引用在场的节点：没有提示的字段不带提示 id，控件与没有说明的字段集不引用没写的部件', async () => {
    const { document } = sample()
    const registry = createBuiltinKindRegistry()
    const own = createIdAllocator('fs')
    const agree = field(registry, own, 'checkbox', 'agree', { validation: [{ id: 'fs-r', kind: 'accepted' }] })
    const confirm = container(registry, own, 'fieldset', [agree], { basic: { legend: '确认' } })
    const renderer = await mount((element) => {
      element.schema = documentOf([...document.children, confirm])
    })
    await Promise.all([...renderer.querySelectorAll('xh-field')].map(shell => (shell as HTMLElement & { updateComplete?: Promise<boolean> }).updateComplete))
    const trigger = group(renderer, ['level']).querySelector('[data-xh-part="trigger"]')!
    expect(trigger.hasAttribute('aria-describedby')).toBe(false)
    const fieldset = renderer.querySelector('xh-fieldset fieldset')!
    expect(fieldset).not.toBeNull()
    expect(fieldset.hasAttribute('aria-describedby')).toBe(false)
    const references = [...renderer.querySelectorAll('[aria-labelledby], [aria-describedby]')].flatMap(node => [
      ...(node.getAttribute('aria-labelledby') ?? '').split(' '),
      ...(node.getAttribute('aria-describedby') ?? '').split(' '),
    ]).filter(id => id !== '')
    expect(references.length).toBeGreaterThan(0)
    expect(references.filter(id => window.document.getElementById(id) === null)).toEqual([])
  })

  it('评分的每颗星用 UI 语言包的缺省名，渲染器不另给', async () => {
    const { registry, ids } = setup()
    const names = async (): Promise<(string | null)[]> => {
      const renderer = await mount((element) => {
        element.schema = documentOf([field(registry, ids, 'rating', 'score')])
      })
      const rating = group(renderer, ['score']).querySelector('xh-rating') as HTMLElement & { updateComplete?: Promise<boolean> }
      await rating.updateComplete
      return [...rating.querySelectorAll('[data-xh-part="item"]')].map(star => star.getAttribute('aria-label'))
    }
    expect(await names()).toEqual([1, 2, 3, 4, 5].map(value => `${value} of 5 stars`))
    setXhConfig(mergeXhConfig(zhCN, formZhCN))
    expect(await names()).toEqual([1, 2, 3, 4, 5].map(value => `${value} 星，共 5 星`))
  })

  it('整表只读与禁用合进字段状态；表单设置里的也算', async () => {
    const { document } = sample()
    const renderer = await mount((element) => {
      element.schema = { ...document, settings: { ...document.settings, readOnly: true } }
      element.disabled = true
    })
    const input = group(renderer, ['name']).querySelector('xh-text-field') as HTMLElement & { disabled?: boolean, readOnly?: boolean }
    expect([input.disabled, input.readOnly]).toEqual([true, true])
    const form = renderer.querySelector('xh-form') as HTMLElement & { disabled?: boolean, readOnly?: boolean }
    expect([form.disabled, form.readOnly]).toEqual([true, true])
  })
})

describe('<xh-form-renderer>：列表容器', () => {
  type FieldArray = HTMLElement & { value?: unknown[], movable?: boolean, updateComplete: Promise<boolean> }

  function lines(): { document: FormDocument, note: StaticNode, list: ContainerNode } {
    const { registry, ids } = setup()
    const note = createNode(registry, 'paragraph', ids) as StaticNode
    const list = container(registry, ids, 'subform', [field(registry, ids, 'text', 'name'), field(registry, ids, 'number', 'qty'), note], {
      key: 'lines',
      basic: { title: '明细' },
      validation: [{ id: 'v-lines', kind: 'required', message: '至少填一行' }],
    })
    return { document: documentOf([list]), note, list }
  }

  async function mountLines(values: Record<string, JsonValue>): Promise<{ renderer: XhFormRenderer, array: FieldArray, note: StaticNode }> {
    const { document, note } = lines()
    const renderer = await mount((element) => {
      element.values = values
      element.schema = document
    })
    const array = group(renderer, ['lines']).querySelector('xh-field-array') as FieldArray
    await array.updateComplete
    return { renderer, array, note }
  }

  function items(array: FieldArray): HTMLElement[] {
    return [...array.querySelectorAll<HTMLElement>(':scope > [data-xh-part="root"] > [data-xh-part="item"]')]
  }

  function names(renderer: XhFormRenderer, count: number): unknown[] {
    return Array.from({ length: count }, (_, index) => (group(renderer, ['lines', index, 'name']).querySelector('xh-text-field') as HTMLElement & { value?: string }).value)
  }

  it('xh-field 包住 xh-field-array，标题是字段标签；一行一个 item，行内字段的路径带行号', async () => {
    const { renderer, array } = await mountLines({ lines: [{ name: '甲', qty: 1 }, { name: '乙', qty: 2 }] })
    expect(group(renderer, ['lines']).querySelector('xh-field > [data-xh-part="root"] > label')!.textContent).toBe('明细')
    expect(array.movable).toBe(true)
    expect(items(array).map(item => item.querySelector('[data-xh-part="item-label"]')!.textContent)).toEqual(['1', '2'])
    expect(names(renderer, 2)).toEqual(['甲', '乙'])
    expect(array.querySelector('[data-xh-part="add-trigger"]')!.textContent).toBe('Add row')
    expect(array.value).toHaveLength(2)
  })

  it('新增、换序、删除经 xh-field-array 交给控制器；已在的行原样保留，行号变了的行按新路径重建', async () => {
    const { renderer, array } = await mountLines({ lines: [{ name: '甲', qty: 1 }, { name: '乙', qty: 2 }] })
    const [first, second] = items(array)
    array.querySelector<HTMLButtonElement>('[data-xh-part="add-trigger"]')!.click()
    await array.updateComplete
    expect(renderer.getFormData().lines).toEqual([{ name: '甲', qty: 1 }, { name: '乙', qty: 2 }, { name: '', qty: null }])
    expect(items(array).slice(0, 2)).toEqual([first, second])
    expect(items(array)).toHaveLength(3)
    second!.querySelector<HTMLButtonElement>('[data-xh-part="move-up-trigger"]')!.click()
    await array.updateComplete
    expect(renderer.getFormData().lines).toEqual([{ name: '乙', qty: 2 }, { name: '甲', qty: 1 }, { name: '', qty: null }])
    expect(items(array).slice(0, 2)).toEqual([second, first])
    expect(second!.querySelector('[data-xh-part="field-group"]')!.getAttribute('data-path')).toBe(JSON.stringify(['lines', 0, 'name']))
    expect(names(renderer, 2)).toEqual(['乙', '甲'])
    first!.querySelector<HTMLButtonElement>('[data-xh-part="item-delete-trigger"]')!.click()
    await array.updateComplete
    expect(renderer.getFormData().lines).toEqual([{ name: '乙', qty: 2 }, { name: '', qty: null }])
    expect(first!.isConnected).toBe(false)
    expect(items(array).map(item => item.querySelector('[data-xh-part="item-label"]')!.textContent)).toEqual(['1', '2'])
    expect(renderer.querySelectorAll('[data-xh-part="error-summary-item"]')).toHaveLength(1 + 2 * 2)
  })

  it('宿主改整份数据时按行数截短或补齐，行内字段跟着刷新', async () => {
    const { renderer, array } = await mountLines({ lines: [{ name: '甲', qty: 1 }] })
    renderer.setFormData({ lines: [{ name: '丙', qty: 3 }, { name: '丁', qty: 4 }, { name: '戊', qty: 5 }] })
    await array.updateComplete
    expect(items(array)).toHaveLength(3)
    expect(names(renderer, 3)).toEqual(['丙', '丁', '戊'])
    renderer.setFormData({ lines: [] })
    await array.updateComplete
    expect(items(array)).toHaveLength(0)
    expect(array.value).toEqual([])
  })

  it('行内静态元素按实例键取逐行的状态', async () => {
    const { renderer, array, note } = await mountLines({ lines: [{ name: '甲', qty: 1 }, { name: '乙', qty: 2 }] })
    renderer.controller!.setHidden(instanceKey(note.id, [1]), true)
    const paragraphs = items(array).map(item => item.querySelector('xh-typography') as HTMLElement)
    expect(paragraphs.map(paragraph => paragraph.hidden)).toEqual([false, true])
  })

  it('列表自己的校验问题落在列表的字段上，也进错误摘要', async () => {
    const { renderer } = await mountLines({ lines: [] })
    renderer.validate()
    await renderer.updateComplete
    expect(group(renderer, ['lines']).querySelector('xh-field > [data-xh-part="root"] > [data-xh-part="error-text"]')!.textContent).toBe('至少填一行')
    expect(renderer.querySelector(`[data-xh-part="error-summary-item"][data-path='${JSON.stringify(['lines'])}']`)!.textContent).toBe('明细: 至少填一行')
  })
})

describe('<xh-form-renderer>：标签字段', () => {
  it('值写成 xh-tags-input 的 value，一个值一个标签；改值后标签按值增删，已在的节点原地保留', async () => {
    const { registry, ids } = setup()
    const renderer = await mount((element) => {
      element.values = { tags: ['甲', '乙'] }
      element.schema = documentOf([field(registry, ids, 'tags', 'tags', { data: { max: 5 } })])
    })
    const element = group(renderer, ['tags']).querySelector('xh-tags-input') as HTMLElement & { value?: string[], max?: number }
    const items = (): Element[] => [...element.querySelectorAll('[data-xh-part="item"]')]
    expect([element.value, element.max]).toEqual([['甲', '乙'], 5])
    expect(items().map(item => item.getAttribute('value'))).toEqual(['甲', '乙'])
    const second = items()[1]
    element.dispatchEvent(new CustomEvent('value-change', { detail: { value: ['乙', '丙'] }, bubbles: true, composed: true }))
    expect(renderer.getFormData().tags).toEqual(['乙', '丙'])
    expect(items().map(item => item.getAttribute('value'))).toEqual(['乙', '丙'])
    expect(items()[0]).toBe(second)
    expect(element.querySelector('[data-xh-part="input"]')!.previousElementSibling).toBe(items()[1])
  })
})

describe('<xh-form-renderer>：文件字段', () => {
  type Upload = HTMLElement & {
    remoteFiles?: unknown
    upload?: unknown
    accept?: string
    maxFiles?: number
    acceptedFiles: File[]
    addFiles: (files: File[]) => void
    deleteFile: (file: unknown) => void
    updateComplete: Promise<boolean>
  }

  function upload(renderer: XhFormRenderer): Upload {
    return group(renderer, ['files']).querySelector('xh-file-upload') as Upload
  }

  it('字段值是 xh-file-upload 的 remoteFiles，一条附件一行；类型与个数取 accept、maxFiles；没给 uploadFile 时不是上传器', async () => {
    const { registry, ids } = setup()
    const renderer = await mount((element) => {
      element.values = { files: [{ id: 'a1', name: '合同.pdf', size: 2048, url: '/f/a1' }] }
      element.schema = documentOf([field(registry, ids, 'file', 'files', { data: { accept: '.pdf', maxFiles: 3 } })])
    })
    const element = upload(renderer)
    await element.updateComplete
    expect(element.remoteFiles).toEqual([{ id: 'a1', name: '合同.pdf', size: 2048, url: '/f/a1' }])
    expect([element.accept, element.maxFiles, element.upload]).toEqual(['.pdf', 3, undefined])
    expect(element.querySelectorAll('[data-xh-part="item"]')).toHaveLength(1)
    expect(element.querySelector('[data-xh-part="dropzone"]')!.textContent).toBe('Drop files here or click to choose')
    expect(element.querySelector('[data-xh-part="trigger"]')!.textContent).toBe('Choose files')
  })

  it('删除附件经 remote-files-change 写回字段值', async () => {
    const { registry, ids } = setup()
    const renderer = await mount((element) => {
      element.values = { files: [{ id: 'a1', name: '甲.pdf' }, { id: 'a2', name: '乙.pdf' }] }
      element.schema = documentOf([field(registry, ids, 'file', 'files', { data: { maxFiles: 5 } })])
    })
    const element = upload(renderer)
    await element.updateComplete
    const changes = events(renderer, 'value-change')
    element.deleteFile({ id: 'a1', name: '甲.pdf' })
    expect(renderer.getFormData().files).toEqual([{ id: 'a2', name: '乙.pdf' }])
    expect(changes).toHaveLength(1)
    await element.updateComplete
    expect(element.querySelectorAll('[data-xh-part="item"]')).toHaveLength(1)
  })

  it('uploadFile 收到带字段信息的请求；返回 id 后文件转成附件记录写进字段值，本地列表随之清空', async () => {
    const { registry, ids } = setup()
    const node = field(registry, ids, 'file', 'files', { data: { uploadTarget: 'contracts', maxFiles: 5 } })
    const requests: { name: string, target: string | undefined, nodeId: string, path: unknown }[] = []
    const renderer = await mount((element) => {
      element.uploadFile = (request) => {
        requests.push({ name: request.file.name, target: request.target, nodeId: request.nodeId, path: request.path })
        return Promise.resolve({ id: 'r1', url: '/f/r1' })
      }
      element.schema = documentOf([node])
    })
    const element = upload(renderer)
    await element.updateComplete
    element.addFiles([new File(['abc'], 'a.pdf', { type: 'application/pdf' })])
    await vi.waitFor(() => expect(renderer.getFormData().files).toEqual([{ id: 'r1', name: 'a.pdf', size: 3, type: 'application/pdf', url: '/f/r1' }]))
    expect(requests).toEqual([{ name: 'a.pdf', target: 'contracts', nodeId: node.id, path: ['files'] }])
    await vi.waitFor(() => expect(element.acceptedFiles).toEqual([]))
    await element.updateComplete
    expect(element.querySelectorAll('[data-xh-part="item"]')).toHaveLength(1)
  })

  it('投放区与按钮的文字取渲染器语言包', async () => {
    setXhConfig(mergeXhConfig(zhCN, formZhCN))
    const { registry, ids } = setup()
    const renderer = await mount((element) => {
      element.schema = documentOf([field(registry, ids, 'file', 'files')])
    })
    const element = upload(renderer)
    expect(element.querySelector('[data-xh-part="dropzone"]')!.textContent).toBe('把文件拖到这里，或点击选择')
    expect(element.querySelector('[data-xh-part="trigger"]')!.textContent).toBe('选择文件')
  })
})

describe('<xh-form-renderer>：自定义字段', () => {
  it('fieldRenderers 按种类覆盖内置渲染器，上下文带值、状态与写值函数', async () => {
    const { document } = sample()
    const seen: unknown[] = []
    const custom: FieldRenderer = (context) => {
      const element = context.document.createElement('input')
      element.addEventListener('input', () => context.setValue(element.value))
      return {
        element,
        update: (next) => {
          seen.push(next.value)
          element.value = typeof next.value === 'string' ? next.value : ''
        },
      }
    }
    const renderer = await mount((element) => {
      element.fieldRenderers = { text: custom }
      element.schema = document
    })
    const input = group(renderer, ['name']).querySelector('input')!
    input.value = 'x'
    input.dispatchEvent(new Event('input'))
    expect(renderer.getFormData().name).toBe('x')
    expect(seen).toContain('x')
  })
})
