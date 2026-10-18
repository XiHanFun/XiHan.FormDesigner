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

模板没通过自检时表单不渲染，渲染器派发 `schema-error`，载荷里是错误码与全部模板问题；建好表单时派发 `ready`。换了 `schema`、`extensions`、`expressionEngine` 或 `loadOptions`，渲染器重建表单，再派发一次 `ready`。

## 取值与赋值

<<< @/examples/snippets/renderer-data.ts#data

- 数据路径是数组：顶层字段是 `['applicant']`，列表里的字段带行号，如 `['items', 0, 'name']`。
- `values` 是初始数据，也是 `reset()` 与 `isDirty()` 的基准；表单建好后再给 `values`，等于 `setFormData(values, { baseline: true })`。
- 值的形状由种类决定，写入形状不符的值时抛 `FormRuntimeError`（`XH_FORM_RT_INVALID_VALUE`），见[问题码](../reference/issues#runtime)。
- 用户输入、联动赋值、增删行与宿主赋值都会派发 `value-change`，载荷里是变化的路径与整份数据。

## 提交

调用 `submit()`，或在文本框里按回车，都会走一次提交：整表校验，通过时派发 `submit`，没通过时派发 `invalid`，焦点移到第一个出问题的字段。`submit` 交出的数据不含隐藏字段的值。

提交要等后端回应时，把异步动作交给 `submitAction`：

<<< @/examples/snippets/renderer-data.ts#submit-action

## 选项

选择类字段（下拉、可输入下拉、树选择、级联、单选组、多选组、按钮组、列表、可选标签、穿梭框）的选项有两种来源。

**写在模板里**：`data.options` 是选项数组，每项 `{ value, label }`，可带 `disabled`；树选择与级联的选项是树，每项还可带 `children`。

<<< @/examples/templates/purchase.ts#static

**交给宿主加载**：`data.optionSource` 是一个由宿主解释的名字，渲染器按它调用 `loadOptions(request)`，宿主返回选项数组或它的 Promise。表单建好时加载一次全部带选项来源的字段。

<<< @/examples/demos/purchase.ts#load

请求里有 `source`（选项来源）、`nodeId`、`path`（字段的数据路径）与 `values`（当前表单数据），以及按情况带上的：

- **依赖其它字段**：`data.optionDependencies` 列出这个字段依赖的数据键。依赖的值一变，字段回到空值并重新加载，宿主从 `request.values` 读依赖的值。依赖的键在字段所在作用域里找，找不到再往外层找。

  <<< @/examples/templates/purchase.ts#cascade

- **搜索**：可输入下拉在用户输入时带上 `query`，宿主按它返回匹配的选项；没有选项来源时按文字包含在静态选项里筛。可提及文本的候选也是这样取：用户敲提及符号（缺省 `@`）后面的字就是 `query`，选中的候选文字插回正文，字段值是整段正文。

  <<< @/examples/templates/purchase.ts#search

- **逐级展开**：树选择与级联的选项可以带 `hasChildren: true` 而不给 `children`，用户第一次展开它时请求带上 `parent`（那个节点的值），宿主只返回它的直接子项。级联在那一列末尾显示在途与失败，失败时点重试再请求一次。

  <<< @/examples/templates/purchase.ts#tree

加载中字段显示在途状态；加载失败时下拉显示失败提示与重试钮，点重试再加载一次。宿主也可以经控制器的 `reloadOptions()` 主动重新加载。

## 附件上传

文件字段的值是附件记录的数组，每条 `{ id, name, size?, type?, url? }`。用户选了文件，渲染器调用宿主的 `uploadFile(request)`：

<<< @/examples/demos/purchase.ts#upload

- `request.file` 是用户选的文件，`request.target` 是字段的 `data.uploadTarget`，另有 `nodeId` 与 `path`。
- 用 `request.onProgress(0–100)` 汇报进度；用户删掉文件或表单卸载时 `request.signal` 中止，把它传给底层请求。
- 返回带 `id` 的结果时，这个文件转成一条附件记录写进字段值；上传失败或被中止的文件不会写进字段值。
- 已有的附件经 `values` 交给渲染器，用户可以删掉，删掉后字段值里就没有那一条。

<FormDemo name="purchase" />

## 只读与禁用

- 整张表单：渲染器的 `readonly` 与 `disabled` 属性，或模板 `settings` 里的同名设置。只读仍可提交，禁用不能提交。
- 单个节点：`basic.readOnly`、`basic.disabled`、`basic.hidden`，联动规则可以按条件改变它们，见[校验与联动](./validation)。
- 宿主强制：控制器的 `setHidden`、`setDisabled`、`setReadOnly` 盖过模板与联动，传 `null` 撤销。

<<< @/examples/snippets/renderer-data.ts#force

## 文案

内置文案缺省是英文，各语言的语言包（如中文的 `formZhCN`）与 XiHan.UI 同一语言的语言包合并后经 `setXhConfig` 全局生效，见[快速开始](../quickstart#界面语言)。某一个渲染器要用别的说法时，给它的 `translations` 传要覆盖的键，如错误摘要的标题 `errorSummary` 与新增行的 `addRow`；规则写了 `message` 时问题提示用规则的，键见[渲染器参考](../reference/renderer#formrenderertranslations)。

## 不经界面使用

`createFormController` 是渲染器背后的表单控制器：同一套取值、联动、选项与校验，不碰 DOM，可以在没有界面的地方处理表单数据，或给自己写的界面用。

<<< @/examples/snippets/controller.ts#controller

只做校验时，也可以直接用 `@xihan-form/core` 的 `validateValues`，见[与宿主集成](./host#服务端复核)。
