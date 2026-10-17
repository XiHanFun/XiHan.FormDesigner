// @vitest-environment jsdom

import type { ContainerNode, FieldNode, FormDocument, StaticNode } from '@xihan-form/core'
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

describe('<xh-form-renderer>：静态元素', () => {
  it('标题、提示、图片、条码与二维码按属性建出对应的 UI 元素', async () => {
    const { registry, ids } = setup()
    const make = (kind: string, props: { basic?: Record<string, unknown>, appearance?: Record<string, unknown> }): StaticNode => {
      const node = createNode(registry, kind, ids) as StaticNode
      return { ...node, basic: { ...node.basic, ...props.basic } as StaticNode['basic'], appearance: { ...node.appearance, ...props.appearance } as StaticNode['appearance'] }
    }
    const renderer = await mount((element) => {
      element.schema = documentOf([
        make('heading', { basic: { content: '报销须知' }, appearance: { level: 4 } }),
        make('alert', { basic: { title: '注意', content: '发票须在 90 天内' }, appearance: { tone: 'warning' } }),
        make('alert', { basic: { content: '只有说明' } }),
        make('image', { basic: { src: '/logo.png', alt: '公司标志' }, appearance: { width: 120 } }),
        make('barcode', { basic: { value: 'XH-0001', format: 'code39' }, appearance: { showText: false } }),
        make('qrcode', { basic: { value: 'https://xihanfun.com' } }),
      ])
    })
    const heading = renderer.querySelector('xh-typography [data-xh-part="heading"]')!
    expect([heading.localName, heading.getAttribute('level'), heading.textContent]).toEqual(['h4', '4', '报销须知'])
    const [warning, plain] = [...renderer.querySelectorAll('xh-alert')] as (HTMLElement & { tone?: string })[]
    expect(warning!.tone).toBe('warning')
    expect([...warning!.querySelectorAll('[data-xh-part="content"] > *')].map(node => [node.getAttribute('data-xh-part'), node.textContent])).toEqual([['title', '注意'], ['description', '发票须在 90 天内']])
    expect([plain!.tone, [...plain!.querySelectorAll('[data-xh-part="content"] > *')].map(node => node.getAttribute('data-xh-part'))]).toEqual(['info', ['description']])
    const image = renderer.querySelector('xh-image') as HTMLElement & { src?: string, alt?: string }
    expect([image.src, image.alt]).toEqual(['/logo.png', '公司标志'])
    expect((image.querySelector('[data-xh-part="root"]') as HTMLElement).style.getPropertyValue('--xh-image-w')).toBe('120px')
    expect(image.querySelector('[data-xh-part="fallback"]')!.textContent).toBe('公司标志')
    const barcode = renderer.querySelector('xh-bar-code') as HTMLElement & { value?: string, format?: string, text?: boolean }
    expect([barcode.value, barcode.format, barcode.text]).toEqual(['XH-0001', 'code39', false])
    const qrcode = renderer.querySelector('xh-matrix-code') as HTMLElement & { value?: string, format?: string }
    expect([qrcode.value, qrcode.format]).toEqual(['https://xihanfun.com', 'qr'])
    for (const code of [barcode, qrcode])
      expect(code.querySelector('[data-xh-part="root"]')!.namespaceURI).toBe('http://www.w3.org/2000/svg')
  })
})

describe('<xh-form-renderer>：前后缀', () => {
  it('文本与数字的外观带前后缀时，控件放进 xh-input-group，前后缀各是一个 item；不带时不包', async () => {
    const { registry, ids } = setup()
    const withAffix = (node: FieldNode, appearance: Record<string, string>): FieldNode => ({ ...node, appearance: { ...node.appearance, ...appearance } })
    const renderer = await mount((element) => {
      element.schema = documentOf([
        withAffix(field(registry, ids, 'text', 'site'), { prefix: 'https://', suffix: '.com' }),
        withAffix(field(registry, ids, 'number', 'price'), { suffix: '元' }),
        field(registry, ids, 'text', 'plain'),
      ])
    })
    const parts = (key: string): string[] => [...group(renderer, [key]).querySelectorAll('xh-input-group > [data-xh-part="root"] > *')]
      .map(node => node.localName === 'span' ? `item:${node.textContent}` : node.localName)
    expect(parts('site')).toEqual(['item:https://', 'xh-text-field', 'item:.com'])
    expect(parts('price')).toEqual(['xh-number-field', 'item:元'])
    expect(group(renderer, ['plain']).querySelector('xh-input-group')).toBeNull()
    expect(group(renderer, ['site']).querySelector('xh-field > [data-xh-part="root"] > xh-input-group')).not.toBeNull()
  })
})

describe('<xh-form-renderer>：标签字段', () => {
  it('值写成 xh-tags-input 的 value，标签由元素按值生成；改值写回字段值', async () => {
    const { registry, ids } = setup()
    const renderer = await mount((element) => {
      element.values = { tags: ['甲', '乙'] }
      element.schema = documentOf([field(registry, ids, 'tags', 'tags', { data: { max: 5 } })])
    })
    const element = group(renderer, ['tags']).querySelector('xh-tags-input') as HTMLElement & { value?: string[], max?: number, updateComplete: Promise<boolean> }
    await element.updateComplete
    const items = (): Element[] => [...element.querySelectorAll('[data-scope="tags-input"][data-part="item"]')]
    expect([element.value, element.max]).toEqual([['甲', '乙'], 5])
    expect(items().map(item => item.getAttribute('value'))).toEqual(['甲', '乙'])
    element.dispatchEvent(new CustomEvent('value-change', { detail: { value: ['乙', '丙'] }, bubbles: true, composed: true }))
    expect(renderer.getFormData().tags).toEqual(['乙', '丙'])
    await element.updateComplete
    expect(items().map(item => item.getAttribute('value'))).toEqual(['乙', '丙'])
  })
})

describe('<xh-form-renderer>：控件状态', () => {
  it.each([
    ['toggle-group', 'xh-toggle-group'],
    ['checkbox-group', 'xh-checkbox-group'],
    ['combobox', 'xh-combobox'],
    ['slider', 'xh-slider'],
    ['file', 'xh-file-upload'],
  ])('%s：必填规则与整表只读写成 %s 的 required、readOnly', async (kind, tag) => {
    const { registry, ids } = setup()
    const options = [{ value: 'a', label: '甲' }]
    const node = field(registry, ids, kind, 'x', {
      ...(kind === 'toggle-group' || kind === 'checkbox-group' || kind === 'combobox' ? { data: { options } } : {}),
      validation: [{ id: 'r', kind: 'required' }],
    })
    const renderer = await mount((element) => {
      element.schema = documentOf([node])
    })
    const element = group(renderer, ['x']).querySelector(tag) as HTMLElement & { required?: boolean, readOnly?: boolean }
    expect([element.required, element.readOnly]).toEqual([true, undefined])
    renderer.readonly = true
    await renderer.updateComplete
    expect(element.readOnly).toBe(true)
  })

  it('下拉取数失败时报 error，浮层里有失败提示与重试钮；retry 重新加载选项', async () => {
    const { registry, ids } = setup()
    let calls = 0
    const renderer = await mount((element) => {
      element.loadOptions = () => {
        calls += 1
        if (calls === 1)
          throw new Error('offline')
        return [{ value: 'icbc', label: '工商银行' }]
      }
      element.schema = documentOf([field(registry, ids, 'select', 'bank', { data: { optionSource: 'banks' } })])
    })
    const element = group(renderer, ['bank']).querySelector('xh-select') as HTMLElement & { error?: boolean, collection?: unknown[] }
    await vi.waitFor(() => expect(element.error).toBe(true))
    expect(element.querySelector('[data-xh-part="error"]')).not.toBeNull()
    expect(element.querySelector('[data-xh-part="retry-trigger"]')).not.toBeNull()
    element.dispatchEvent(new CustomEvent('retry', { bubbles: true, composed: true }))
    await vi.waitFor(() => expect(element.collection).toEqual([{ value: 'icbc', label: '工商银行' }]))
    expect([calls, element.error]).toEqual([2, undefined])
  })

  it('数字字段的占位文字写成 xh-number-field 的 placeholder，值为空时输入框显示它', async () => {
    const { registry, ids } = setup()
    const node = field(registry, ids, 'number', 'amount')
    const renderer = await mount((element) => {
      element.schema = documentOf([{ ...node, basic: { ...node.basic, placeholder: '单位：元' } }])
    })
    const element = group(renderer, ['amount']).querySelector('xh-number-field') as HTMLElement & { placeholder?: string, updateComplete: Promise<boolean> }
    await element.updateComplete
    expect(element.placeholder).toBe('单位：元')
    expect(element.querySelector('[data-part="input"]')!.getAttribute('placeholder')).toBe('单位：元')
  })
})

describe('<xh-form-renderer>：点字段标签', () => {
  it.each([
    ['text', 'xh-text-field', 'input'],
    ['number', 'xh-number-field', 'input'],
    ['select', 'xh-select', 'trigger'],
    ['combobox', 'xh-combobox', 'input'],
    ['toggle-group', 'xh-toggle-group', 'item'],
  ])('%s：标签不写落空的 for，点标签把焦点交给 %s 的 %s', async (kind, tag, part) => {
    const { registry, ids } = setup()
    const options = [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }]
    const node = field(registry, ids, kind, 'x', kind === 'select' || kind === 'combobox' || kind === 'toggle-group' ? { data: { options } } : {})
    const renderer = await mount((element) => {
      element.schema = documentOf([{ ...node, basic: { ...node.basic, label: '字段' } }])
    })
    const shell = group(renderer, ['x']).querySelector('xh-field') as HTMLElement & { updateComplete?: Promise<boolean> }
    const element = shell.querySelector(tag) as HTMLElement & { updateComplete: Promise<boolean> }
    await shell.updateComplete
    await element.updateComplete
    const label = shell.querySelector<HTMLElement>('[data-xh-part="label"]')!
    expect(label.hasAttribute('for')).toBe(false)
    label.click()
    const scope = tag.slice('xh-'.length)
    expect(document.activeElement).toBe(element.querySelector(`[data-scope="${scope}"][data-part="${part}"]`))
  })
})

describe('<xh-form-renderer>：标签页与折叠只建宿主', () => {
  it.each([
    ['tabs', 'xh-tabs', 'trigger'],
    ['collapse', 'xh-accordion', 'trigger'],
  ])('%s：渲染器不写部件，%s 按区域生成，区域内容经插槽进对应的面板', async (kind, tag, triggerPart) => {
    const { registry, ids } = setup()
    const base = container(registry, ids, kind, [field(registry, ids, 'text', 'a')])
    const node = { ...base, regions: [base.regions[0]!, { ...base.regions[0]!, id: `${base.regions[0]!.id}-2`, props: { ...base.regions[0]!.props, title: '第二页' }, children: [field(registry, ids, 'text', 'b')] }] }
    const renderer = await mount((element) => {
      element.schema = documentOf([{ ...node, regions: [{ ...node.regions[0]!, props: { ...node.regions[0]!.props, title: '第一页' } }, node.regions[1]!] }])
    })
    const element = renderer.querySelector(tag) as HTMLElement & { collection?: { value: string, label: string }[], updateComplete: Promise<boolean> }
    await element.updateComplete
    const scope = tag.slice('xh-'.length)
    expect(element.querySelector(`[data-scope="${scope}"]:not([data-xh-gen])`)).toBeNull()
    expect(element.collection!.map(item => item.label)).toEqual(['第一页', '第二页'])
    expect([...element.querySelectorAll(`[data-scope="${scope}"][data-part="${triggerPart}"]`)].map(trigger => trigger.textContent)).toEqual(['第一页', '第二页'])
    const panels = [...element.querySelectorAll<HTMLElement>(`[data-scope="${scope}"][data-part="content"]`)]
    expect(panels.map(panel => [...panel.querySelectorAll('input')].length)).toEqual([1, 1])
    expect(panels[1]!.querySelector('[slot]')!.getAttribute('slot')).toMatch(/:.+-2$/)
  })
})

describe('<xh-form-renderer>：有标准结构的控件只建宿主', () => {
  it.each([
    ['text', 'xh-text-field', 'input'],
    ['number', 'xh-number-field', 'increment-trigger'],
    ['switch', 'xh-switch', 'thumb'],
    ['toggle-group', 'xh-toggle-group', 'item'],
    ['tags', 'xh-tags-input', 'input'],
    ['combobox', 'xh-combobox', 'input'],
  ])('%s：渲染器不写部件，%s 自己铺出整套结构', async (kind, tag, part) => {
    const { registry, ids } = setup()
    const options = [{ value: 'a', label: '甲' }, { value: 'b', label: '乙' }]
    const node = field(registry, ids, kind, 'x', kind === 'toggle-group' || kind === 'combobox' ? { data: { options } } : {})
    const renderer = await mount((element) => {
      element.schema = documentOf([node])
    })
    const element = group(renderer, ['x']).querySelector(tag) as HTMLElement & { updateComplete: Promise<boolean> }
    await element.updateComplete
    expect(element.querySelector('[data-xh-part]:not([data-xh-gen])')).toBeNull()
    const scope = tag.slice('xh-'.length)
    expect(element.querySelectorAll(`[data-scope="${scope}"][data-part="${part}"]`).length).toBeGreaterThan(0)
  })
})

describe('<xh-form-renderer>：组合框字段', () => {
  type Combobox = HTMLElement & { collection?: { value: string, label: string }[], value?: string[], multiple?: boolean, loading?: boolean, empty?: string, updateComplete: Promise<boolean> }

  function combobox(renderer: XhFormRenderer): Combobox {
    return group(renderer, ['vendor']).querySelector('xh-combobox') as Combobox
  }

  function typeQuery(element: Combobox, inputValue: string): void {
    element.dispatchEvent(new CustomEvent('input-value-change', { detail: { inputValue }, bubbles: true, composed: true }))
  }

  it('静态选项按输入串的文字筛选；选中写回字段值，多选写成数组', async () => {
    const { registry, ids } = setup()
    const options = [{ value: 'a', label: '上海一号' }, { value: 'b', label: '北京二号' }, { value: 'c', label: '上海三号' }]
    const renderer = await mount((element) => {
      element.schema = documentOf([field(registry, ids, 'combobox', 'vendor', { data: { options, multiple: true } })])
    })
    const element = combobox(renderer)
    expect(element.multiple).toBe(true)
    expect(element.collection!.map(item => item.value)).toEqual(['a', 'b', 'c'])
    typeQuery(element, '上海')
    expect(element.collection!.map(item => item.value)).toEqual(['a', 'c'])
    element.dispatchEvent(new CustomEvent('value-change', { detail: { value: ['c'] }, bubbles: true, composed: true }))
    expect(renderer.getFormData().vendor).toEqual(['c'])
    expect(element.value).toEqual(['c'])
  })

  it('有选项来源时输入串交给 loadOptions 的 query，候选换成返回的结果；加载中报 loading', async () => {
    const { registry, ids } = setup()
    const requests: (string | undefined)[] = []
    let release!: () => void
    const renderer = await mount((element) => {
      element.loadOptions = (request) => {
        requests.push(request.query)
        if (request.query === undefined)
          return [{ value: 'all', label: '全部' }]
        return new Promise((resolve) => {
          release = () => resolve([{ value: 'sh', label: `${request.query}供应商` }])
        })
      }
      element.schema = documentOf([field(registry, ids, 'combobox', 'vendor', { data: { optionSource: 'vendors' } })])
    })
    const element = combobox(renderer)
    await vi.waitFor(() => expect(element.collection).toEqual([{ value: 'all', label: '全部' }]))
    typeQuery(element, '上')
    await vi.waitFor(() => expect(element.loading).toBe(true))
    expect(requests).toEqual([undefined, '上'])
    release()
    await vi.waitFor(() => expect(element.collection).toEqual([{ value: 'sh', label: '上供应商' }]))
    expect(element.loading).toBeUndefined()
    element.dispatchEvent(new CustomEvent('value-change', { detail: { value: ['sh'] }, bubbles: true, composed: true }))
    expect(renderer.getFormData().vendor).toBe('sh')
  })
})

describe('<xh-form-renderer>：文件字段', () => {
  type Upload = HTMLElement & {
    remoteFiles?: unknown
    upload?: unknown
    accept?: string
    maxFiles?: number
    acceptedFiles: File[]
    allFiles: unknown[]
    addFiles: (files: File[]) => void
    deleteFile: (file: unknown) => void
    updateComplete: Promise<boolean>
  }

  function upload(renderer: XhFormRenderer): Upload {
    return group(renderer, ['files']).querySelector('xh-file-upload') as Upload
  }

  /** 列表里各行：可见与否、是否远程附件、文件名。 */
  function rows(element: Upload): { hidden: boolean, remote: boolean, name: string | null }[] {
    return [...element.querySelectorAll<HTMLElement>('[data-xh-part="item"]')].map(row => ({
      hidden: row.hasAttribute('hidden'),
      remote: row.hasAttribute('data-remote'),
      name: row.querySelector('[data-xh-part="item-name"]')!.textContent,
    }))
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
    expect(rows(element)).toEqual([{ hidden: false, remote: true, name: '合同.pdf' }])
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

  it('uploadFile 收到带字段信息的请求；返回 id 后文件转成附件记录写进字段值，原来那一行仍在、改报远程附件，点删除钮删掉它', async () => {
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
    expect(rows(element)).toEqual([{ hidden: false, remote: true, name: 'a.pdf' }])
    expect(element.allFiles).toEqual([{ id: 'r1', name: 'a.pdf', size: 3, type: 'application/pdf', url: '/f/r1' }])
    element.querySelector<HTMLButtonElement>('[data-xh-part="item-delete-trigger"]')!.click()
    expect(renderer.getFormData().files).toEqual([])
    await element.updateComplete
    expect(rows(element)).toEqual([])
  })

  it('放进 xh-field 时投放区接上字段的标签、提示与错误并报 aria-invalid，隐藏输入也取字段的标签作名字', async () => {
    const { registry, ids } = setup()
    const node = field(registry, ids, 'file', 'files', { basic: { label: '附件', hint: '最多 3 个' }, validation: [{ id: 'r1', kind: 'required' }] })
    setXhConfig(formZhCN)
    const renderer = await mount((element) => {
      element.schema = documentOf([node])
    })
    renderer.validate()
    await renderer.updateComplete
    const shell = group(renderer, ['files']).querySelector('xh-field')!
    await (shell as HTMLElement & { updateComplete?: Promise<boolean> }).updateComplete
    const label = shell.querySelector('[data-xh-part="label"]')!
    const description = shell.querySelector('[data-xh-part="description"]')!
    const error = shell.querySelector('[data-xh-part="error-text"]')!
    expect([description.textContent, error.textContent]).toEqual(['最多 3 个', '此项必填'])
    const dropzone = upload(renderer).querySelector('[data-xh-part="dropzone"]')!
    expect(dropzone.getAttribute('aria-labelledby')!.split(' ')).toContain(label.id)
    expect(dropzone.getAttribute('aria-describedby')!.split(' ')).toEqual([description.id, error.id])
    expect(dropzone.getAttribute('aria-invalid')).toBe('true')
    const hidden = upload(renderer).querySelector('[data-xh-part="hidden-input"]')!
    expect(hidden.getAttribute('aria-labelledby')!.split(' ')).toContain(label.id)
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
