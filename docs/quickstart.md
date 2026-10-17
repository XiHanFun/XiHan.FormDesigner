# 快速开始

这一页在任意前端项目里装包、渲染一张表单并拿到提交的数据。示例都是普通的 TypeScript，不依赖任何前端框架。

## 安装

```bash
pnpm add @xihan-form/runtime @xihan-ui/web-components @xihan-ui/styles
```

`@xihan-form/runtime` 会带上 `@xihan-form/core` 与它用到的 `@xihan-ui/*` 包。只在需要编辑模板的地方再装设计器 `@xihan-form/designer`。

## 写一份模板

模板是纯 JSON：一组节点，字段带数据键 `key`，校验规则写在 `validation` 里。下面是一张四个字段的联系人表单：

<<< @/examples/templates/contact.ts#schema

每个节点的字段与各种类能写的属性见[模板结构](./guide/template)与[种类与属性](./reference/kinds)。

## 注册元素与样式

<<< @/examples/demos/quickstart.ts#setup

`defineFormRenderer()` 注册 `<xh-form-renderer>` 以及内置字段、容器用到的 XiHan.UI 元素，重复调用不报错。样式要同时引入 XiHan.UI 的皮肤与渲染器自己的样式表。

## 渲染与提交

把模板交给元素的 `schema` 属性，已有的数据交给 `values`；校验通过后渲染器派发 `submit`，没通过派发 `invalid`：

<<< @/examples/demos/quickstart.ts#render

调用 `submit()` 走一次提交，与在文本框里按回车是同一条路径：

<<< @/examples/demos/quickstart.ts#submit

<FormDemo name="quickstart" />

先点「提交」看校验：邮箱是必填的；填好后再提交，下方显示交出来的表单数据。

渲染器的事件是冒泡的 `CustomEvent`，载荷的类型在 `FormRendererEventMap` 里。`submit` 与原生表单事件同名，TypeScript 会把它推成 `SubmitEvent`，所以示例把参数标成 `Event` 再按 `FormRendererEventMap['submit']` 取 `detail`。

## 界面语言

内置文案缺省是英文。中文语言包 `formZhCN` 在 `@xihan-form/runtime/locale`，与 XiHan.UI 的语言包合并后全局生效：

```ts
import { formZhCN } from '@xihan-form/runtime/locale'
import { mergeXhConfig, setXhConfig } from '@xihan-ui/web-components'
import { zhCN } from '@xihan-ui/web-components/locale'

setXhConfig(mergeXhConfig(zhCN, formZhCN))
```

只改某一个渲染器的文案时，给它的 `translations` 属性传要覆盖的键，见[渲染器](./reference/renderer#formrenderertranslations)。

## 下一步

- [模板结构](./guide/template)：字段、容器、布局与列表，以及表单数据的形状。
