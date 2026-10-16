import type { OptionItem, OptionRequest } from '../src'
import { describe, expect, it } from 'vitest'
import { createFormController, FormRuntimeError } from '../src'
import { container, documentOf, field, setup } from './helpers'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}

function sample() {
  const { registry, ids } = setup()
  const level = field(registry, ids, 'select', 'level', { data: { options: [{ value: 'a', label: 'A' }] } })
  const city = field(registry, ids, 'select', 'city', { data: { optionSource: 'cities' } })
  const region = field(registry, ids, 'cascader', 'region', { data: { optionSource: 'regions' } })
  const product = field(registry, ids, 'select', 'product', { data: { optionSource: 'products' } })
  const lines = container(registry, ids, 'subtable', [product], { key: 'lines' })
  const name = field(registry, ids, 'text', 'name')
  return { document: documentOf([level, city, region, lines, name]), level, city, region, product }
}

async function rejection(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
  }
  catch (error) {
    if (error instanceof FormRuntimeError)
      return error.code
    throw error
  }
  throw new Error('预期失败')
}

describe('选项', () => {
  it('静态选项直接可用；带来源的字段在加载前是 idle', () => {
    const { document, level, city } = sample()
    const controller = createFormController({ document })
    expect(controller.getOptions(level.id)).toEqual({ status: 'ready', items: [{ value: 'a', label: 'A' }] })
    expect(controller.getOptions(city.id)).toEqual({ status: 'idle', items: [] })
  })

  it('reloadOptions 加载全部带来源的字段实例，请求带上来源、路径与当前值', async () => {
    const { document, city, region } = sample()
    const requests: OptionRequest[] = []
    const loadOptions = (request: OptionRequest): readonly OptionItem[] => {
      requests.push(request)
      if (request.source === 'regions')
        return [{ value: 'zj', label: '浙江', children: [{ value: 'hz', label: '杭州' }] }]
      return [{ value: request.path.join('/'), label: request.source }]
    }
    const controller = createFormController({ document, loadOptions, values: { lines: [{ product: null }, { product: null }] } })
    const statuses: string[] = []
    controller.subscribe(() => statuses.push(controller.getOptions(city.id).status))
    await controller.reloadOptions()
    expect(requests.map(request => [request.source, request.path])).toEqual([
      ['cities', ['city']],
      ['regions', ['region']],
      ['products', ['lines', 0, 'product']],
      ['products', ['lines', 1, 'product']],
    ])
    expect(requests[0]!.values).toEqual(controller.getFormData())
    expect(controller.getOptions(city.id)).toEqual({ status: 'ready', items: [{ value: 'city', label: 'cities' }] })
    expect(controller.getOptions(region.id).items[0]!.children).toEqual([{ value: 'hz', label: '杭州' }])
    expect(controller.getOptions(['lines', 1, 'product'])).toEqual({ status: 'ready', items: [{ value: 'lines/1/product', label: 'products' }] })
    expect(statuses[0]).toBe('loading')
    expect(statuses.at(-1)).toBe('ready')
  })

  it('按目标只重载一个字段或一个实例', async () => {
    const { document, product } = sample()
    const sources: string[] = []
    const controller = createFormController({
      document,
      values: { lines: [{ product: null }, { product: null }] },
      loadOptions: (request) => {
        sources.push(request.path.join('/'))
        return []
      },
    })
    await controller.reloadOptions(product.id)
    expect(sources).toEqual(['lines/0/product', 'lines/1/product'])
    sources.length = 0
    await controller.reloadOptions(['lines', 1, 'product'])
    expect(sources).toEqual(['lines/1/product'])
  })

  it('晚到的旧结果被丢弃，只保留最后一次请求的结果', async () => {
    const { document, city } = sample()
    const first = deferred<readonly OptionItem[]>()
    const second = deferred<readonly OptionItem[]>()
    const queue = [first, second]
    const controller = createFormController({ document, loadOptions: () => queue.shift()!.promise })
    const a = controller.reloadOptions(city.id)
    const b = controller.reloadOptions(city.id)
    second.resolve([{ value: 'new', label: '新' }])
    await b
    first.resolve([{ value: 'old', label: '旧' }])
    await a
    expect(controller.getOptions(city.id).items).toEqual([{ value: 'new', label: '新' }])
  })

  it('加载失败或返回的选项不合法时状态为 error', async () => {
    const { document, city, region } = sample()
    const controller = createFormController({
      document,
      loadOptions: (request) => {
        if (request.source === 'cities')
          throw new Error('offline')
        return [{ value: 1, label: 'bad' }] as never
      },
    })
    await controller.reloadOptions()
    expect(controller.getOptions(city.id)).toEqual({ status: 'error', items: [] })
    expect(controller.getOptions(region.id)).toEqual({ status: 'error', items: [] })
  })

  it('没有加载函数、目标不是选项字段时报错', async () => {
    const { document, city } = sample()
    const controller = createFormController({ document })
    expect(await rejection(() => controller.reloadOptions())).toBe('XH_FORM_RT_NO_OPTION_LOADER')
    expect(await rejection(() => controller.reloadOptions(city.id))).toBe('XH_FORM_RT_NO_OPTION_LOADER')
    const nameId = document.children[4]!.id
    expect(() => controller.getOptions(nameId)).toThrow(FormRuntimeError)
    expect(await rejection(() => controller.reloadOptions(nameId))).toBe('XH_FORM_RT_NO_OPTIONS')
  })

  it('行的选项跟着行走，删掉的行连同选项一起丢弃', async () => {
    const { document } = sample()
    const controller = createFormController({
      document,
      values: { lines: [{ product: null }, { product: null }] },
      loadOptions: request => [{ value: String(request.path[1]), label: 'row' }],
    })
    await controller.reloadOptions()
    controller.removeRow(['lines'], 0)
    expect(controller.getOptions(['lines', 0, 'product']).items).toEqual([{ value: '1', label: 'row' }])
    controller.addRow(['lines'], { index: 0 })
    expect(controller.getOptions(['lines', 0, 'product']).status).toBe('idle')
    expect(controller.getOptions(['lines', 1, 'product']).items).toEqual([{ value: '1', label: 'row' }])
  })

  it('行操作只在行级选项确实挪动时发出 options 通知', async () => {
    const { document } = sample()
    const controller = createFormController({ document, values: { lines: [{ product: null }] }, loadOptions: () => [] })
    const events: string[] = []
    controller.subscribe(event => events.push(event.type))
    controller.addRow(['lines'])
    expect(events).toEqual(['values', 'states'])
    await controller.reloadOptions()
    events.length = 0
    controller.addRow(['lines'], { index: 0 })
    expect(events).toEqual(['values', 'states', 'options'])
  })

  it('销毁后晚到的结果被丢弃', async () => {
    const { document, city } = sample()
    const pending = deferred<readonly OptionItem[]>()
    const controller = createFormController({ document, loadOptions: () => pending.promise })
    const run = controller.reloadOptions(city.id)
    controller.dispose()
    pending.resolve([{ value: 'x', label: 'x' }])
    await run
    expect(() => controller.getOptions(city.id)).toThrow(FormRuntimeError)
  })
})

describe('选项依赖', () => {
  function cascade() {
    const { registry, ids } = setup()
    const province = field(registry, ids, 'select', 'province', { data: { options: [{ value: 'zj', label: '浙江' }, { value: 'js', label: '江苏' }] } })
    const city = field(registry, ids, 'select', 'city', { data: { optionSource: 'cities', optionDependencies: ['province'] } })
    const district = field(registry, ids, 'select', 'district', { data: { optionSource: 'districts', optionDependencies: ['city'] } })
    const rowCity = field(registry, ids, 'select', 'rowCity', { data: { optionSource: 'cities', optionDependencies: ['province'] } })
    const rowProvince = field(registry, ids, 'select', 'province', { data: { options: [{ value: 'zj', label: '浙江' }] } })
    const lines = container(registry, ids, 'subtable', [rowProvince, rowCity], { key: 'lines' })
    return { document: documentOf([province, city, district, lines]), city, district, rowCity }
  }

  it('改了依赖的值：依赖它的字段逐级回到空值，并自动重新加载选项', async () => {
    const { document, city, district } = cascade()
    const requests: OptionRequest[] = []
    const controller = createFormController({
      document,
      values: { province: 'zj', city: 'hz', district: 'xh' },
      loadOptions: (request) => {
        requests.push(request)
        return []
      },
    })
    controller.setValue(['province'], 'js')
    expect(controller.getFormData()).toMatchObject({ province: 'js', city: null, district: null })
    expect(controller.getOptions(city.id).status).toBe('loading')
    await Promise.resolve()
    await Promise.resolve()
    expect(requests.map(request => [request.source, request.path, request.values.province])).toEqual([
      ['cities', ['city'], 'js'],
      ['districts', ['district'], 'js'],
    ])
    expect(controller.getOptions(district.id).status).toBe('ready')
  })

  it('列表行里的依赖先在行内找：改行里的键只牵动本行，外层的同名键不受影响', async () => {
    const { document, rowCity } = cascade()
    const requests: OptionRequest[] = []
    const controller = createFormController({
      document,
      values: { province: 'zj', lines: [{ province: 'zj', rowCity: 'hz' }, { province: 'zj', rowCity: 'nb' }] },
      loadOptions: (request) => {
        requests.push(request)
        return []
      },
    })
    controller.setValue(['lines', 1, 'province'], 'zj')
    controller.setValue(['province'], 'js')
    expect(controller.getValue(['lines'])).toEqual([{ province: 'zj', rowCity: 'hz' }, { province: 'zj', rowCity: 'nb' }])
    controller.setValue(['lines', 1, 'province'], null)
    expect(controller.getValue(['lines'])).toEqual([{ province: 'zj', rowCity: 'hz' }, { province: null, rowCity: null }])
    await Promise.resolve()
    await Promise.resolve()
    expect(requests.filter(request => request.nodeId === rowCity.id).map(request => request.path)).toEqual([['lines', 1, 'rowCity']])
  })

  it('整份替换与重置只重新加载，不清空依赖它的字段；没有加载函数时什么也不做', async () => {
    const { document } = cascade()
    const requests: OptionRequest[] = []
    const controller = createFormController({
      document,
      values: { province: 'zj', city: 'hz' },
      loadOptions: (request) => {
        requests.push(request)
        return []
      },
    })
    controller.setFormData({ province: 'js', city: 'nj' })
    expect(controller.getFormData()).toMatchObject({ province: 'js', city: 'nj' })
    await Promise.resolve()
    expect(requests.map(request => request.source)).toEqual(['cities', 'districts'])
    const silent = createFormController({ document, values: { province: 'zj', city: 'hz' } })
    silent.setValue(['province'], 'js')
    expect(silent.getFormData()).toMatchObject({ province: 'js', city: null })
  })
})
