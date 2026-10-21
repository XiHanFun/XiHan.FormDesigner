来源：https://form.docs.xihanfun.com/quickstart

# 快速开始

这一页在任意前端项目里装包、渲染一张表单并拿到提交的数据。示例都是普通的 TypeScript，Vue、React 等框架里的写法见[与宿主集成](./guide/host#在前端框架里使用)。

## 安装

```bash
pnpm add @xihan-form/runtime @xihan-ui/web-components @xihan-ui/styles
```

`@xihan-form/runtime` 会带上 `@xihan-form/core` 与它用到的 `@xihan-ui/*` 包。只在需要编辑模板的地方再装设计器 `@xihan-form/designer`，见[设计器](./guide/designer)。

## 写一份模板

模板是纯 JSON：一组节点，字段带数据键 `key`，校验规则写在 `validation` 里。下面是一张四个字段的联系人表单：

```ts
export const schema: FormDocument = {
  schemaVersion: 1,
  settings: { labelPlacement: 'top', size: 'md' },
  children: [
    {
      type: 'field',
      id: 'f-name',
      kind: 'text',
      key: 'name',
      basic: { label: '姓名', placeholder: '请输入姓名' },
      data: {},
      appearance: {},
      validation: [
        { id: 'r-name-required', kind: 'required' },
        { id: 'r-name-length', kind: 'length', min: 2, max: 20 },
      ],
      linkage: [],
    },
    {
      type: 'field',
      id: 'f-email',
      kind: 'text',
      key: 'email',
      basic: { label: '邮箱', hint: '用于接收回复' },
      data: { inputType: 'email' },
      appearance: {},
      validation: [
        { id: 'r-email-required', kind: 'required' },
        { id: 'r-email-pattern', kind: 'pattern', pattern: '^[^@\\s]+@[^@\\s]+$', message: '请输入有效的邮箱' },
      ],
      linkage: [],
    },
    {
      type: 'field',
      id: 'f-topic',
      kind: 'select',
      key: 'topic',
      basic: { label: '咨询类型', initialValue: 'product' },
      data: {
        options: [
          { value: 'product', label: '产品咨询' },
          { value: 'billing', label: '账单问题' },
          { value: 'other', label: '其他' },
        ],
      },
      appearance: {},
      validation: [],
      linkage: [],
    },
    {
      type: 'field',
      id: 'f-message',
      kind: 'textarea',
      key: 'message',
      basic: { label: '留言' },
      data: {},
      appearance: { minRows: 3 },
      validation: [{ id: 'r-message-length', kind: 'length', max: 200 }],
      linkage: [],
    },
  ],
}
```

每个节点的字段与各种类能写的属性见[模板结构](./guide/template)与[种类与属性](./reference/kinds)。

## 注册元素与样式

```ts
import type { FormRendererEventMap } from '@xihan-form/runtime'
import { defineFormRenderer } from '@xihan-form/runtime'
import { schema, values } from '../templates/contact'
import '@xihan-ui/styles/index.css'
import '@xihan-form/runtime/style.css'

defineFormRenderer()
```

`defineFormRenderer()` 注册 `<xh-form-renderer>` 以及内置字段、容器用到的 XiHan.UI 元素，重复调用不报错。样式要同时引入 XiHan.UI 的皮肤与渲染器自己的样式表。

## 渲染与提交

把模板交给元素的 `schema` 属性，已有的数据交给 `values`；校验通过后渲染器派发 `submit`，没通过派发 `invalid`：

```ts
const renderer = document.createElement('xh-form-renderer')
renderer.schema = schema
renderer.values = values
renderer.addEventListener('submit', (event: Event) => {
  const { values } = (event as FormRendererEventMap['submit']).detail
  output.textContent = JSON.stringify(values, null, 2)
})
renderer.addEventListener('invalid', (event) => {
  const { issues } = (event as FormRendererEventMap['invalid']).detail
  output.textContent = `还有 ${issues.length} 处没填对`
})
```

调用 `submit()` 走一次提交，与在文本框里按回车是同一条路径：

```ts
const submit = document.createElement('button')
submit.type = 'button'
submit.textContent = '提交'
submit.addEventListener('click', () => renderer.submit())
```


先点「提交」看校验：邮箱是必填的；填好后再提交，下方显示交出来的表单数据。

渲染器的事件是冒泡的 `CustomEvent`，载荷的类型在 `FormRendererEventMap` 里。`submit` 与原生表单事件同名，TypeScript 会把它推成 `SubmitEvent`，所以示例把参数标成 `Event` 再按 `FormRendererEventMap['submit']` 取 `detail`。

## 界面语言

渲染器与设计器的界面文字缺省是英文。表单给 XiHan.UI 的每种内建语言各出一份语言包，在 `@xihan-form/runtime/locale`，名字是 `form` 加 UI 语言包的名字：`zhCN` 对 `formZhCN`，`jaJP` 对 `formJaJP`。每份都带上设计器零件同一语言的文案，与 UI 同一语言的语言包合并后全局设置，所有实例都跟着换。下面以中文为例：

```ts
import { formZhCN } from '@xihan-form/runtime/locale'
import { mergeXhConfig, setXhConfig } from '@xihan-ui/web-components'
import { zhCN } from '@xihan-ui/web-components/locale'

setXhConfig(mergeXhConfig(zhCN, formZhCN))
```

只改某一个渲染器的文案时，给它的 `translations` 属性传要覆盖的键，见[渲染器](./reference/renderer#formrenderertranslations)。

## 下一步

- [模板结构](./guide/template)：字段、容器、布局与列表，以及表单数据的形状。
