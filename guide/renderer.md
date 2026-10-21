来源：https://form.docs.xihanfun.com/guide/renderer

# 渲染器

`<xh-form-renderer>` 按模板渲染出表单：字段、布局、列表、校验与联动都按模板来，选项与附件经回调交给宿主，组件自己不发请求。全部属性、方法与事件见[渲染器参考](../reference/renderer)。

## 放到页面上

```ts
import { defineFormRenderer } from '@xihan-form/runtime'
import '@xihan-ui/styles/index.css'
import '@xihan-form/runtime/style.css'

defineFormRenderer()

const renderer = document.createElement('xh-form-renderer')
renderer.schema = schema
document.body.append(renderer)
```

复杂数据都走属性（property）：`schema`、`values`、`variables`、`loadOptions`、`uploadFile`、`submitAction`、`translations` 与 `extensions`。可以写成 HTML 特性（attribute）的只有 `readonly`、`disabled` 与 `validate-on`。

`readonly` 与 `disabled` 按三态读：没写取缺省（不生效），写 `"false"` 是关，空串、`"true"` 与别的写法都是开，移除后回到缺省。这与 HTML 原生的布尔特性不同：原生的只要写了就算开。这是一处行为变化，渲染器此前也照原生读，`readonly="false"` 会让整表只读，现在不会；经属性（property）赋值不受影响。

模板没通过自检时表单不渲染，渲染器派发 `schema-error`，载荷里是错误码与全部模板问题；建好表单时派发 `ready`。换了 `schema`、`extensions`、`expressionEngine` 或 `loadOptions`，渲染器重建表单，再派发一次 `ready`。

## 取值与赋值

```ts
renderer.schema = schema
// 已有的数据：也是 reset 与 isDirty 的基准
renderer.values = { applicant: '张三', items: [{ name: '高铁', qty: 2, price: 553 }] }

const all = renderer.getFormData() // 整份数据的副本，含联动赋值
const visible = renderer.getFormData({ omitHidden: true }) // 去掉隐藏字段的值，与 submit 交出的一样
const first = renderer.getValue(['items', 0, 'name']) // 按数据路径读

renderer.setValue(['items', 0, 'qty'], 3) // 写一个字段，形状不符时抛错
renderer.setFormData({ applicant: '李四' }, { baseline: true }) // 整份替换，同时作为新的基准
renderer.reset() // 回到基准值并清空校验状态
const changed = renderer.isDirty()
```

- 数据路径是数组：顶层字段是 `['applicant']`，列表里的字段带行号，如 `['items', 0, 'name']`。
- `values` 是初始数据，也是 `reset()` 与 `isDirty()` 的基准；表单建好后再给 `values`，等于 `setFormData(values, { baseline: true })`。
- 值的形状由种类决定，写入形状不符的值时抛 `FormRuntimeError`（`XH_FORM_RT_INVALID_VALUE`），见[问题码](../reference/issues#runtime)。
- 用户输入、联动赋值、增删行与宿主赋值都会派发 `value-change`，载荷里是变化的路径与整份数据。

## 提交

调用 `submit()`，或在文本框里按回车，都会走一次提交：整表校验，通过时派发 `submit`，没通过时派发 `invalid`，焦点移到第一个出问题的字段。`submit` 交出的数据不含隐藏字段的值。

提交要等后端回应时，把异步动作交给 `submitAction`：

```ts
renderer.submitAction = async ({ values }) => {
  // 返回的 Promise 落定之前表单处于提交中，期间再提交不会发生；失败时派发 submit-error
  await saveOrder(values)
}
```

## 选项

选择类字段（下拉、可输入下拉、树选择、级联、单选组、多选组、按钮组、列表、可选标签、穿梭框）的选项有两种来源。

**写在模板里**：`data.options` 是选项数组，每项 `{ value, label }`，可带 `disabled`；树选择与级联的选项是树，每项还可带 `children`。

```ts
{
  type: 'field',
  id: 'f-province',
  kind: 'select',
  key: 'province',
  basic: { label: '收货省份', placeholder: '请选择' },
  data: { options: [{ value: 'zj', label: '浙江' }, { value: 'js', label: '江苏' }, { value: 'gd', label: '广东' }] },
  appearance: {},
  validation: [],
  linkage: [],
},
```

**交给宿主加载**：`data.optionSource` 是一个由宿主解释的名字，渲染器按它调用 `loadOptions(request)`，宿主返回选项数组或它的 Promise。表单建好时加载一次全部带选项来源的字段。

```ts
renderer.loadOptions = (request) => {
  if (request.source === 'cities')
    return later(CITIES[String(request.values.province)] ?? [])
  if (request.source === 'vendors')
    return later(VENDORS.filter(vendor => vendor.label.includes(request.query?.trim() ?? '')))
  return later(CATEGORIES[request.parent ?? ''] ?? [])
}
```

请求里有 `source`（选项来源）、`nodeId`、`path`（字段的数据路径）与 `values`（当前表单数据），以及按情况带上的：

- **依赖其它字段**：`data.optionDependencies` 列出这个字段依赖的数据键。依赖的值一变，字段回到空值并重新加载，宿主从 `request.values` 读依赖的值。依赖的键在字段所在作用域里找，找不到再往外层找。

  <<< @/examples/templates/purchase.ts#cascade

- **搜索**：可输入下拉在用户输入时带上 `query`，宿主按它返回匹配的选项；没有选项来源时按文字包含在静态选项里筛。可提及文本的候选也是这样取：用户敲提及符号（缺省 `@`）后面的字就是 `query`，选中的候选文字插回正文，字段值是整段正文。

  <<< @/examples/templates/purchase.ts#search

- **逐级展开**：树选择与级联的选项可以带 `hasChildren: true` 而不给 `children`，用户第一次展开它时请求带上 `parent`（那个节点的值），宿主只返回它的直接子项。级联在那一列末尾显示在途与失败，失败时点重试再请求一次。

  <<< @/examples/templates/purchase.ts#tree

加载中字段显示在途状态；加载失败时下拉显示失败提示与重试钮，点重试再加载一次。宿主也可以经控制器的 `reloadOptions()` 主动重新加载。

单选的下拉、树选择与级联在字段不必填时带清空钮：选了值以后它顶替展开钮那一格，点一下把值清成空；字段必填（校验规则里有必填，或联动让它必填）时不带，多选能逐个去掉已选项，也不带。只读与禁用时清空钮收起。

## 附件上传

文件字段的值是附件记录的数组，每条 `{ id, name, size?, type?, url? }`。用户选了文件，渲染器调用宿主的 `uploadFile(request)`：

```ts
renderer.uploadFile = request => new Promise((resolve, reject) => {
  let progress = 0
  const timer = setInterval(() => {
    progress += 20
    request.onProgress(progress)
    if (progress >= 100) {
      clearInterval(timer)
      resolve({ id: `${request.target}-${Date.now()}` })
    }
  }, 200)
  request.signal.addEventListener('abort', () => {
    clearInterval(timer)
    reject(request.signal.reason)
  })
})
```

- `request.file` 是用户选的文件，`request.target` 是字段的 `data.uploadTarget`，另有 `nodeId` 与 `path`。
- 用 `request.onProgress(0–100)` 汇报进度；用户删掉文件或表单卸载时 `request.signal` 中止，把它传给底层请求。
- 返回带 `id` 的结果时，这个文件转成一条附件记录写进字段值；上传失败或被中止的文件不会写进字段值。
- 已有的附件经 `values` 交给渲染器，用户可以删掉，删掉后字段值里就没有那一条。


## 只读与禁用

- 整张表单：渲染器的 `readonly` 与 `disabled` 属性，或模板 `settings` 里的同名设置。只读仍可提交，禁用不能提交。
- 单个节点：`basic.readOnly`、`basic.disabled`、`basic.hidden`，联动规则可以按条件改变它们，见[校验与联动](./validation)。
- 宿主强制：控制器的 `setHidden`、`setDisabled`、`setReadOnly` 盖过模板与联动，传 `null` 撤销。

```ts
// ready 之后拿到控制器；模板、扩展、表达式引擎或选项加载函数一换就是新的控制器
renderer.addEventListener('ready', () => {
  const controller = renderer.controller!
  controller.setReadOnly(['applicant'], true) // 强制只读，盖过联动
  controller.setHidden('f-remark', true) // 也可以用节点 id
  controller.setReadOnly(['applicant'], null) // null 撤销强制
})
```

## 文案

内置文案缺省是英文，各语言的语言包（如中文的 `formZhCN`）与 XiHan.UI 同一语言的语言包合并后经 `setXhConfig` 全局生效，见[快速开始](../quickstart#界面语言)。某一个渲染器要用别的说法时，给它的 `translations` 传要覆盖的键，如错误摘要的标题 `errorSummary` 与新增行的 `addRow`；规则写了 `message` 时问题提示用规则的，键见[渲染器参考](../reference/renderer#formrenderertranslations)。

## 不经界面使用

`createFormController` 是渲染器背后的表单控制器：同一套取值、联动、选项与校验，不碰 DOM，可以在没有界面的地方处理表单数据，或给自己写的界面用。

```ts
const controller = createFormController({
  document: schema,
  expressionEngine: createExpressionEngine(),
  values: { type: 'travel' },
  loadOptions,
})

const unsubscribe = controller.subscribe((event) => {
  if (event.type === 'values')
    sync(controller.getFormData())
})

controller.setValue(['city'], '杭州')
const outcome = controller.validate() // { valid, issues }

unsubscribe()
controller.dispose()
```

只做校验时，也可以直接用 `@xihan-form/core` 的 `validateValues`，见[与宿主集成](./host#服务端复核)。
