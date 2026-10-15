import type { FormEvent, FormEventType } from '../src'
import { describe, expect, it } from 'vitest'
import { createFormController, FormRuntimeError } from '../src'
import { createFakeEngine } from './fake-engine'
import { container, documentOf, field, setup } from './helpers'

interface Row { price: number | null, qty: number | null, amount?: number | null }

function orderForm() {
  const { registry, ids } = setup()
  const name = field(registry, ids, 'text', 'name', { validation: [{ id: 'v-name', kind: 'required', message: '请填写客户' }] })
  const kind = field(registry, ids, 'radio-group', 'kind', { data: { options: [{ value: 'person', label: '个人' }, { value: 'org', label: '单位' }] } })
  const company = field(registry, ids, 'text', 'company', {
    validation: [{ id: 'v-company', kind: 'required' }],
    linkage: [{ id: 'l-hide', action: 'hide' }, { id: 'l-show', action: 'show', when: 'is-org' }],
  })
  const price = field(registry, ids, 'number', 'price', { validation: [{ id: 'v-price', kind: 'range', min: 0 }] })
  const qty = field(registry, ids, 'number', 'qty')
  const amount = field(registry, ids, 'number', 'amount', { linkage: [{ id: 'l-amount', action: 'assign', value: 'row-amount' }] })
  const lines = container(registry, ids, 'subtable', [price, qty, amount], { key: 'lines', validation: [{ id: 'v-lines', kind: 'required' }] })
  const total = field(registry, ids, 'number', 'total', { linkage: [{ id: 'l-total', action: 'assign', value: 'sum-amount' }] })
  const card = container(registry, ids, 'card', [kind, company])
  const engine = createFakeEngine({
    'is-org': scope => scope.kind === 'org',
    'row-amount': (scope) => {
      const row = scope.$row as Row
      return row.price === null || row.qty === null ? null : row.price * row.qty
    },
    'sum-amount': scope => (scope.lines as Row[]).reduce((sum, row) => sum + (row.amount ?? 0), 0),
  })
  return { registry, expressionEngine: engine, document: documentOf([name, card, lines, total]), name, kind, company, price, qty, amount, lines, total, card }
}

function record(controller: ReturnType<typeof createFormController>): FormEventType[] {
  const events: FormEventType[] = []
  controller.subscribe((event: FormEvent) => events.push(event.type))
  return events
}

function errorCode(run: () => unknown): string {
  try {
    run()
  }
  catch (error) {
    if (error instanceof FormRuntimeError)
      return error.code
    throw error
  }
  throw new Error('预期抛出 FormRuntimeError')
}

describe('创建', () => {
  it('按 schema 初始化数据并立即执行联动', () => {
    const { document, expressionEngine: engine } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine })
    expect(controller.getFormData()).toEqual({ name: '', kind: null, company: '', lines: [], total: 0 })
  })

  it('初始数据叠在 schema 初始值之上，宿主多带的键原样保留', () => {
    const { document, expressionEngine: engine } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine, values: { id: 42, name: '张三', lines: [{ price: 2, qty: 3 }] } })
    expect(controller.getFormData()).toEqual({ id: 42, name: '张三', kind: null, company: '', lines: [{ price: 2, qty: 3, amount: 6 }], total: 6 })
  })

  it('文档没通过自校验时抛错并带上问题列表', () => {
    const { document, expressionEngine: engine, name } = orderForm()
    const broken = { ...document, children: [{ ...name, key: '1bad' }, ...document.children.slice(1)] }
    try {
      createFormController({ document: broken, expressionEngine: engine })
      throw new Error('应当抛错')
    }
    catch (error) {
      expect(error).toBeInstanceOf(FormRuntimeError)
      expect((error as FormRuntimeError).code).toBe('XH_FORM_RT_INVALID_DOCUMENT')
      expect((error as FormRuntimeError).issues.map(issue => issue.code)).toEqual(['XH_FORM_INVALID_KEY'])
    }
  })

  it('文档里有表达式却没有引擎时抛错；没有表达式时可以不给', () => {
    const { document } = orderForm()
    expect(errorCode(() => createFormController({ document }))).toBe('XH_FORM_RT_NO_ENGINE')
    const { registry, ids } = setup()
    expect(createFormController({ document: documentOf([field(registry, ids, 'text', 'a')]) }).getFormData()).toEqual({ a: '' })
  })

  it('初始数据的形状与字段不符时抛错，带上路径', () => {
    const { document, expressionEngine: engine } = orderForm()
    try {
      createFormController({ document, expressionEngine: engine, values: { lines: [{ price: '2' }] } })
      throw new Error('应当抛错')
    }
    catch (error) {
      expect((error as FormRuntimeError).code).toBe('XH_FORM_RT_INVALID_VALUE')
      expect((error as FormRuntimeError).data).toEqual({ path: 'lines[0].price' })
    }
  })
})

describe('取值与写值', () => {
  it('取出的是副本，改它不影响控制器', () => {
    const { document, expressionEngine: engine } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine, values: { lines: [{ price: 1, qty: 1 }] } })
    const data = controller.getFormData()
    const lines = data.lines as unknown as Row[]
    lines[0]!.price = 99
    expect(controller.getValue(['lines', 0, 'price'])).toBe(1)
    expect(controller.getValue(['missing'])).toBeUndefined()
  })

  it('写值后重算联动：行内公式与合计随之更新，并发出通知', () => {
    const { document, expressionEngine: engine } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine, values: { lines: [{ price: 2, qty: 3 }, { price: 1, qty: 1 }] } })
    const events = record(controller)
    controller.setValue(['lines', 1, 'qty'], 4)
    expect(controller.getValue(['lines', 1, 'amount'])).toBe(4)
    expect(controller.getValue(['total'])).toBe(10)
    expect(events).toEqual(['values'])
  })

  it('写值改变显隐时发出 states 通知', () => {
    const { document, expressionEngine: engine, company } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine })
    expect(controller.getState(company.id)?.hidden).toBe(true)
    const events = record(controller)
    controller.setValue(['kind'], 'org')
    expect(controller.getState(company.id)?.hidden).toBe(false)
    expect(events).toEqual(['values', 'states'])
  })

  it('值的形状不符、路径不存在都抛错，且不改动数据', () => {
    const { document, expressionEngine: engine } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine })
    expect(errorCode(() => controller.setValue(['name'], 1))).toBe('XH_FORM_RT_INVALID_VALUE')
    expect(errorCode(() => controller.setValue(['kind'], ['org']))).toBe('XH_FORM_RT_INVALID_VALUE')
    expect(errorCode(() => controller.setValue(['nope'], 1))).toBe('XH_FORM_RT_UNKNOWN_PATH')
    expect(errorCode(() => controller.setValue(['lines', 3, 'price'], 1))).toBe('XH_FORM_RT_UNKNOWN_PATH')
    expect(errorCode(() => controller.setValue(['lines', 0], {} as never))).toBe('XH_FORM_RT_UNKNOWN_PATH')
    expect(controller.getFormData()).toEqual({ name: '', kind: null, company: '', lines: [], total: 0 })
  })

  it('整体写入列表容器时逐行规整，缺的键取新行初始值', () => {
    const { document, expressionEngine: engine } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine })
    controller.setValue(['lines'], [{ price: 5, qty: 2 }])
    expect(controller.getValue(['lines'])).toEqual([{ price: 5, qty: 2, amount: 10 }])
  })

  it('setFormData 替换全部数据并清空校验状态', () => {
    const { document, expressionEngine: engine } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine })
    controller.validate()
    expect(controller.getIssues()).not.toEqual([])
    controller.setFormData({ name: '李四', extra: true })
    expect(controller.getFormData()).toEqual({ name: '李四', kind: null, company: '', lines: [], total: 0, extra: true })
    expect(controller.getIssues()).toEqual([])
  })
})

describe('联动重算', () => {
  it('公式引用排在后面的公式时多轮重算直到稳定', () => {
    const { registry, ids } = setup()
    const doubled = field(registry, ids, 'number', 'doubled', { linkage: [{ id: 'a', action: 'assign', value: 'double-base' }] })
    const base = field(registry, ids, 'number', 'base', { linkage: [{ id: 'b', action: 'assign', value: 'seed-plus-one' }] })
    const seed = field(registry, ids, 'number', 'seed')
    const engine = createFakeEngine({
      'double-base': scope => (scope.base === null ? null : (scope.base as number) * 2),
      'seed-plus-one': scope => (scope.seed === null ? null : (scope.seed as number) + 1),
    })
    const controller = createFormController({ document: documentOf([doubled, base, seed]), expressionEngine: engine, values: { seed: 4 } })
    expect(controller.getFormData()).toEqual({ doubled: 10, base: 5, seed: 4 })
    expect(controller.getLinkageIssues()).toEqual([])
  })

  it('互相引用、永不稳定时停在上限并记一条问题', () => {
    const { registry, ids } = setup()
    const a = field(registry, ids, 'number', 'a', { linkage: [{ id: 'la', action: 'assign', value: 'b+1' }] })
    const b = field(registry, ids, 'number', 'b', { linkage: [{ id: 'lb', action: 'assign', value: 'a+1' }] })
    const engine = createFakeEngine({ 'b+1': scope => ((scope.b as number | null) ?? 0) + 1, 'a+1': scope => ((scope.a as number | null) ?? 0) + 1 })
    const controller = createFormController({ document: documentOf([a, b]), expressionEngine: engine })
    expect(controller.getLinkageIssues()).toEqual([{ code: 'XH_FORM_RT_LINKAGE_UNSTABLE', data: { passes: 10 } }])
  })

  it('宿主变量参与表达式，改变量后重算', () => {
    const { registry, ids } = setup()
    const secret = field(registry, ids, 'text', 'secret', { linkage: [{ id: 'l', action: 'hide', when: 'not-admin' }] })
    const engine = createFakeEngine({ 'not-admin': scope => scope.$role !== 'admin' })
    const controller = createFormController({ document: documentOf([secret]), expressionEngine: engine, variables: { $role: 'guest' } })
    expect(controller.getState(secret.id)?.hidden).toBe(true)
    controller.setVariables({ $role: 'admin' })
    expect(controller.getState(secret.id)?.hidden).toBe(false)
  })
})

describe('校验', () => {
  it('validate 返回全部问题，隐藏的字段不校验', () => {
    const { document, expressionEngine: engine, name, lines } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine })
    const outcome = controller.validate()
    expect(outcome.valid).toBe(false)
    expect(outcome.issues).toEqual([
      { code: 'XH_FORM_VALUE_REQUIRED', nodeId: name.id, ruleId: 'v-name', path: ['name'], message: '请填写客户' },
      { code: 'XH_FORM_VALUE_REQUIRED', nodeId: lines.id, ruleId: 'v-lines', path: ['lines'] },
    ])
    expect(controller.getIssues()).toBe(outcome.issues)
  })

  it('validate 之后每次改值都重算问题并通知', () => {
    const { document, expressionEngine: engine, company } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine, values: { name: 'x', lines: [{ price: 1, qty: 1 }] } })
    expect(controller.validate().valid).toBe(true)
    const events = record(controller)
    controller.setValue(['kind'], 'org')
    expect(controller.getIssues().map(issue => issue.nodeId)).toEqual([company.id])
    expect(events).toEqual(['values', 'states', 'issues'])
    controller.setValue(['company'], '曦寒')
    expect(controller.getIssues()).toEqual([])
  })

  it('validateField 只校验并跟踪这一个字段', () => {
    const { document, expressionEngine: engine, price } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine, values: { lines: [{ price: -1, qty: 1 }, { price: 1, qty: 1 }] } })
    const outcome = controller.validateField(['lines', 0, 'price'])
    expect(outcome.issues).toEqual([{ code: 'XH_FORM_VALUE_TOO_SMALL', nodeId: price.id, ruleId: 'v-price', path: ['lines', 0, 'price'], data: { min: 0 } }])
    expect(controller.getIssues()).toEqual(outcome.issues)
    controller.setValue(['lines', 1, 'price'], -5)
    expect(controller.getIssues().map(issue => issue.path)).toEqual([['lines', 0, 'price']])
    controller.setValue(['lines', 0, 'price'], 3)
    expect(controller.getIssues()).toEqual([])
    expect(errorCode(() => controller.validateField(['nope']))).toBe('XH_FORM_RT_UNKNOWN_PATH')
  })

  it('reset 回到初始值并清空校验状态，宿主的强制设定保留', () => {
    const { document, expressionEngine: engine, name } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine, values: { name: '初始' } })
    controller.setValue(['name'], '改过')
    controller.setDisabled(name.id, true)
    controller.validate()
    controller.reset()
    expect(controller.getValue(['name'])).toBe('初始')
    expect(controller.getIssues()).toEqual([])
    expect(controller.getState(name.id)?.disabled).toBe(true)
    controller.setValue(['name'], '')
    expect(controller.getIssues()).toEqual([])
  })
})

describe('宿主的强制设定', () => {
  it('按节点 id 作用于全部实例，按数据路径只作用于一个实例，null 撤销', () => {
    const { document, expressionEngine: engine, price, company } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine, values: { lines: [{ price: 1, qty: 1 }, { price: 2, qty: 1 }] } })
    controller.setReadOnly(price.id, true)
    controller.setDisabled(['lines', 1, 'price'], true)
    expect(controller.getState(['lines', 0, 'price'])).toEqual({ hidden: false, disabled: false, readOnly: true, required: false })
    expect(controller.getState(['lines', 1, 'price'])).toEqual({ hidden: false, disabled: true, readOnly: true, required: false })
    controller.setHidden(company.id, false)
    expect(controller.getState(company.id)?.hidden).toBe(false)
    controller.setHidden(company.id, null)
    expect(controller.getState(company.id)?.hidden).toBe(true)
  })

  it('隐藏或禁用容器向后代叠加，被跳过的字段不校验', () => {
    const { document, expressionEngine: engine, card, kind } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine, values: { kind: 'org' } })
    controller.validate()
    expect(controller.getIssues().some(issue => issue.path[0] === 'company')).toBe(true)
    const events = record(controller)
    controller.setDisabled(card.id, true)
    expect(controller.getState(kind.id)?.disabled).toBe(true)
    expect(controller.getIssues().some(issue => issue.path[0] === 'company')).toBe(false)
    expect(events).toEqual(['states', 'issues'])
  })

  it('目标不存在时抛错', () => {
    const { document, expressionEngine: engine } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine })
    expect(errorCode(() => controller.setHidden('nope', true))).toBe('XH_FORM_RT_UNKNOWN_NODE')
    expect(errorCode(() => controller.setHidden(['nope'], true))).toBe('XH_FORM_RT_UNKNOWN_PATH')
    expect(errorCode(() => controller.getState('nope'))).toBe('XH_FORM_RT_UNKNOWN_NODE')
    expect(controller.getState(['lines', 0, 'price'])).toBeUndefined()
  })
})

describe('子表单与子表的行', () => {
  it('新增行：缺省追加，可指定位置与初值，行内公式立即生效', () => {
    const { document, expressionEngine: engine } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine })
    controller.addRow(['lines'])
    controller.addRow(['lines'], { values: { price: 3, qty: 2 } })
    controller.addRow(['lines'], { index: 0, values: { price: 1, qty: 1 } })
    expect(controller.getValue(['lines'])).toEqual([
      { price: 1, qty: 1, amount: 1 },
      { price: null, qty: null, amount: null },
      { price: 3, qty: 2, amount: 6 },
    ])
    expect(controller.getValue(['total'])).toBe(7)
  })

  it('删除与移动行', () => {
    const { document, expressionEngine: engine } = orderForm()
    const rows = [{ price: 1, qty: 1 }, { price: 2, qty: 1 }, { price: 3, qty: 1 }]
    const controller = createFormController({ document, expressionEngine: engine, values: { lines: rows } })
    controller.moveRow(['lines'], 0, 2)
    expect((controller.getValue(['lines']) as unknown as Row[]).map(row => row.price)).toEqual([2, 3, 1])
    controller.removeRow(['lines'], 1)
    expect((controller.getValue(['lines']) as unknown as Row[]).map(row => row.price)).toEqual([2, 1])
    expect(controller.getValue(['total'])).toBe(3)
  })

  it('行号越界、目标不是列表时抛错', () => {
    const { document, expressionEngine: engine } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine, values: { lines: [{ price: 1, qty: 1 }] } })
    expect(errorCode(() => controller.removeRow(['lines'], 1))).toBe('XH_FORM_RT_INDEX_OUT_OF_RANGE')
    expect(errorCode(() => controller.moveRow(['lines'], 0, -1))).toBe('XH_FORM_RT_INDEX_OUT_OF_RANGE')
    expect(errorCode(() => controller.addRow(['lines'], { index: 2 }))).toBe('XH_FORM_RT_INDEX_OUT_OF_RANGE')
    expect(errorCode(() => controller.addRow(['name']))).toBe('XH_FORM_RT_NOT_A_LIST')
    expect(errorCode(() => controller.addRow(['lines'], { values: { qty: 'x' } as never }))).toBe('XH_FORM_RT_INVALID_VALUE')
  })

  it('行级的强制设定与校验进度跟着行走', () => {
    const { document, expressionEngine: engine } = orderForm()
    const rows = [{ price: 1, qty: 1 }, { price: -2, qty: 1 }, { price: 3, qty: 1 }]
    const controller = createFormController({ document, expressionEngine: engine, values: { lines: rows } })
    controller.setDisabled(['lines', 2, 'qty'], true)
    controller.validateField(['lines', 1, 'price'])
    controller.removeRow(['lines'], 0)
    expect(controller.getState(['lines', 1, 'qty'])?.disabled).toBe(true)
    expect(controller.getState(['lines', 0, 'qty'])?.disabled).toBe(false)
    expect(controller.getIssues().map(issue => issue.path)).toEqual([['lines', 0, 'price']])
    controller.moveRow(['lines'], 0, 1)
    expect(controller.getState(['lines', 0, 'qty'])?.disabled).toBe(true)
    expect(controller.getIssues().map(issue => issue.path)).toEqual([['lines', 1, 'price']])
    controller.removeRow(['lines'], 1)
    expect(controller.getIssues()).toEqual([])
  })

  it('跨多行前移、后移时其余行的强制设定依次让位', () => {
    const { document, expressionEngine: engine } = orderForm()
    const rows = [{ price: 1, qty: 1 }, { price: 2, qty: 1 }, { price: 3, qty: 1 }]
    const controller = createFormController({ document, expressionEngine: engine, values: { lines: rows } })
    controller.setDisabled(['lines', 0, 'qty'], true)
    controller.setReadOnly(['lines', 1, 'qty'], true)
    const flags = (): [boolean | undefined, boolean | undefined][] => [0, 1, 2].map(index => [
      controller.getState(['lines', index, 'qty'])?.disabled,
      controller.getState(['lines', index, 'qty'])?.readOnly,
    ])
    const prices = (): unknown[] => (controller.getValue(['lines']) as { price: number }[]).map(row => row.price)
    controller.moveRow(['lines'], 0, 2)
    expect(prices()).toEqual([2, 3, 1])
    expect(flags()).toEqual([[false, true], [false, false], [true, false]])
    controller.moveRow(['lines'], 2, 0)
    expect(prices()).toEqual([1, 2, 3])
    expect(flags()).toEqual([[true, false], [false, true], [false, false]])
  })

  it('外层行变动带走内层行的强制设定，内层行变动不碰其他外层行', () => {
    const { registry, ids } = setup()
    const qty = field(registry, ids, 'number', 'qty')
    const lines = container(registry, ids, 'subtable', [qty], { key: 'lines' })
    const orders = container(registry, ids, 'subform', [lines], { key: 'orders' })
    const values = { orders: [{ lines: [{ qty: 1 }] }, { lines: [{ qty: 2 }] }] }
    const controller = createFormController({ document: documentOf([orders]), values })
    controller.setHidden(['orders', 1, 'lines', 0, 'qty'], true)
    controller.removeRow(['orders'], 0)
    expect(controller.getState(['orders', 0, 'lines', 0, 'qty'])?.hidden).toBe(true)
    controller.addRow(['orders'], { index: 0 })
    controller.addRow(['orders', 0, 'lines'])
    expect(controller.getState(['orders', 0, 'lines', 0, 'qty'])?.hidden).toBe(false)
    expect(controller.getState(['orders', 1, 'lines', 0, 'qty'])?.hidden).toBe(true)
    controller.addRow(['orders', 1, 'lines'], { index: 0 })
    expect(controller.getState(['orders', 1, 'lines', 0, 'qty'])?.hidden).toBe(false)
    expect(controller.getState(['orders', 1, 'lines', 1, 'qty'])?.hidden).toBe(true)
    expect(controller.getState(['orders', 0, 'lines', 0, 'qty'])?.hidden).toBe(false)
  })

  it('嵌套列表逐层带行号', () => {
    const { registry, ids } = setup()
    const qty = field(registry, ids, 'number', 'qty', { linkage: [{ id: 'l', action: 'disable', when: 'outer-first' }] })
    const lines = container(registry, ids, 'subtable', [qty], { key: 'lines' })
    const orders = container(registry, ids, 'subform', [lines], { key: 'orders' })
    const engine = createFakeEngine({ 'outer-first': scope => (scope.$row as { qty: number }).qty === 1 })
    const controller = createFormController({ document: documentOf([orders]), expressionEngine: engine, values: { orders: [{ lines: [{ qty: 1 }] }] } })
    controller.addRow(['orders', 0, 'lines'], { values: { qty: 2 } })
    expect(controller.getState(['orders', 0, 'lines', 0, 'qty'])?.disabled).toBe(true)
    expect(controller.getState(['orders', 0, 'lines', 1, 'qty'])?.disabled).toBe(false)
    controller.addRow(['orders'])
    expect(controller.getValue(['orders', 1])).toEqual({ lines: [] })
  })
})

describe('变化范围、隐藏值与改动判断', () => {
  it('values 与 issues 通知带变化的路径，states 通知带实例键', () => {
    const { document, expressionEngine: engine, company, amount } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine, values: { name: 'x', lines: [{ price: 1, qty: 1 }] } })
    controller.validate()
    const events: FormEvent[] = []
    controller.subscribe(event => events.push(event))
    controller.setValue(['lines', 0, 'qty'], 3)
    expect(events).toEqual([{ type: 'values', paths: [['lines', 0, 'qty'], ['lines', 0, 'amount'], ['total']] }])
    events.length = 0
    controller.setValue(['kind'], 'org')
    expect(events).toEqual([
      { type: 'values', paths: [['kind']] },
      { type: 'states', keys: [company.id] },
      { type: 'issues', paths: [['company']] },
    ])
    events.length = 0
    controller.addRow(['lines'])
    expect(events[0]).toEqual({ type: 'values', paths: [['lines']] })
    expect(events[1]).toMatchObject({ type: 'states' })
    const second = events[1]
    expect(second?.type === 'states' ? second.keys : []).toContain(`${amount.id}#1`)
  })

  it('隐藏或禁用的字段跳过校验，值保留；getFormData 可以去掉隐藏实例的值', () => {
    const { document, expressionEngine: engine, name, card, price } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine, values: { kind: 'org', company: '', lines: [{ price: -1, qty: 1 }, { price: -2, qty: 1 }] } })
    controller.setDisabled(name.id, true)
    controller.setHidden(card.id, true)
    controller.setHidden(['lines', 1, 'price'], true)
    expect(controller.validate().issues.map(issue => issue.path)).toEqual([['lines', 0, 'price']])
    expect(controller.getFormData()).toMatchObject({ name: '', kind: 'org', company: '', lines: [{ price: -1 }, { price: -2 }] })
    const visible = controller.getFormData({ omitHidden: true })
    expect(visible).toEqual({ name: '', lines: [{ price: -1, qty: 1, amount: -1 }, { qty: 1, amount: -2 }], total: -3 })
    expect(controller.getState(['lines', 1, 'price'])?.hidden).toBe(true)
    expect(price.id).toBeDefined()
  })

  it('isDirty 以 reset 之后的值为准', () => {
    const { document, expressionEngine: engine } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine, values: { name: '初始', lines: [{ price: 1, qty: 1 }] } })
    expect(controller.isDirty()).toBe(false)
    controller.setValue(['name'], '改过')
    expect(controller.isDirty()).toBe(true)
    controller.setValue(['name'], '初始')
    expect(controller.isDirty()).toBe(false)
    controller.addRow(['lines'])
    expect(controller.isDirty()).toBe(true)
    controller.reset()
    expect(controller.isDirty()).toBe(false)
    controller.setFormData({ name: '载入' })
    expect(controller.isDirty()).toBe(true)
  })

  it('setFormData 带 baseline 时，填入的值成为 reset 与 isDirty 的新基准', () => {
    const { document, expressionEngine: engine } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine })
    controller.validate()
    expect(controller.getIssues()).not.toEqual([])
    const record = { name: '载入', lines: [{ price: 2, qty: 3 }] }
    controller.setFormData(record, { baseline: true })
    expect(controller.isDirty()).toBe(false)
    expect(controller.getIssues()).toEqual([])
    expect(controller.getValue(['lines', 0, 'amount'])).toBe(6)
    controller.setValue(['lines', 0, 'qty'], 4)
    expect(controller.isDirty()).toBe(true)
    controller.reset()
    expect(controller.isDirty()).toBe(false)
    expect(controller.getValue(['name'])).toBe('载入')
    expect(controller.getValue(['lines', 0, 'qty'])).toBe(3)
    controller.setFormData({ name: '不改基准' })
    expect(controller.isDirty()).toBe(true)
    controller.reset()
    expect(controller.getValue(['name'])).toBe('载入')
  })

  it('带 baseline 填入后再改传入的对象，基准不受影响', () => {
    const { document, expressionEngine: engine } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine })
    const record = { name: '载入', lines: [{ price: 2, qty: 3 }] }
    controller.setFormData(record, { baseline: true })
    record.lines[0]!.qty = 9
    record.name = '外部改动'
    controller.reset()
    expect(controller.getValue(['name'])).toBe('载入')
    expect(controller.getValue(['lines', 0, 'qty'])).toBe(3)
  })
})

describe('订阅与销毁', () => {
  it('取消订阅后不再收到通知；值没变时不通知', () => {
    const { document, expressionEngine: engine } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine })
    const events: FormEventType[] = []
    const stop = controller.subscribe(event => events.push(event.type))
    controller.setValue(['name'], '')
    expect(events).toEqual([])
    stop()
    controller.setValue(['name'], 'x')
    expect(events).toEqual([])
  })

  it('通知期间取消订阅不影响本轮其余订阅者', () => {
    const { document, expressionEngine: engine } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine })
    const seen: string[] = []
    const stopFirst = controller.subscribe(() => {
      seen.push('first')
      stopFirst()
    })
    controller.subscribe(() => seen.push('second'))
    controller.setValue(['name'], 'x')
    controller.setValue(['name'], 'y')
    expect(seen).toEqual(['first', 'second', 'second'])
  })

  it('销毁后调用任何方法都抛错', () => {
    const { document, expressionEngine: engine } = orderForm()
    const controller = createFormController({ document, expressionEngine: engine })
    controller.dispose()
    expect(errorCode(() => controller.getFormData())).toBe('XH_FORM_RT_DISPOSED')
    expect(errorCode(() => controller.setValue(['name'], 'x'))).toBe('XH_FORM_RT_DISPOSED')
  })

  it('多个实例互不影响', () => {
    const { document, expressionEngine: engine } = orderForm()
    const a = createFormController({ document, expressionEngine: engine })
    const b = createFormController({ document, expressionEngine: engine })
    a.setValue(['name'], 'A')
    expect(b.getValue(['name'])).toBe('')
  })
})
