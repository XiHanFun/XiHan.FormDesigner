// @vitest-environment jsdom

import type { FormDocument } from '@xihan-form/core'
import type { FieldRenderer, FormRendererEventMap, XhFormRenderer } from '../src'
import { getFormPathValue } from '@xihan-ui/headless'
import { setXhConfig } from '@xihan-ui/web-components'
import { defineXhElements } from '@xihan-ui/web-components/define'
import { afterEach, describe, expect, it } from 'vitest'
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
    const { registry, ids } = setup()
    const lines = container(registry, ids, 'subform', [field(registry, ids, 'text', 'x')], { key: 'lines' })
    const renderer = window.document.createElement(FORM_RENDERER_TAG)
    const errors = events(renderer, 'schema-error')
    renderer.schema = documentOf([lines])
    window.document.body.append(renderer)
    mounted.push(renderer)
    await renderer.updateComplete
    expect(errors.map(error => [error.code, error.data])).toEqual([['XH_FORM_RT_NO_RENDERER', { kind: 'subform' }]])
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
