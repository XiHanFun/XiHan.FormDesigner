来源：https://form.docs.xihanfun.com/guide/host

# 与宿主集成

组件只管设计、渲染与校验，不发网络请求，也不碰存储与权限。把它嵌进业务系统时，下面这些由宿主来做：

| 事情 | 宿主做什么 | 组件给什么 |
| --- | --- | --- |
| 模板的保存 | 存模板 JSON，管名称、分类、版本与审核 | `schema`、`schema-change`、`save`、`dirty`、`markSaved()` |
| 已有数据与提交 | 取出已有的数据，收下提交的数据并保存 | `values`、`submit`、`submitAction`、`getFormData()` |
| 选项与附件 | 按选项来源返回选项，接收上传的文件 | `loadOptions`、`uploadFile` |
| 权限 | 决定谁能改模板、谁能填哪些字段，服务端再复核 | `readonly`、`disabled`、`settingsPolicy`、控制器的强制设定 |
| 校验 | 保存前拦住有错误的模板，服务端复核提交的数据 | `validate()`、`issues-change`、`validateDocument`、`validateValues` |

## 模板的保存

模板是一份完整的 JSON，原样存、原样取，不要拆成字段存。`schemaVersion` 记录模板格式的版本；扩展自己的数据放在文档与节点的 `extensions` 里，组件原样保留。

打开时把取回的模板赋给设计器的 `schema`，用户保存时取 `schema` 交给后端，成功后 `markSaved()`：

```ts
export async function openTemplate(id: string): Promise<void> {
  designer.schema = await api.loadTemplate(id)
  designer.addEventListener('save', async () => {
    await api.saveTemplate(id, designer.schema)
    designer.markSaved()
  })
}
```

设计器在内存里改模板，页面关掉修改就没了（用户在设置里开了自动保存时，未保存的修改另有一份本机草稿，下次打开同一个模板时问要不要恢复，见[保存](./designer#保存)；给设计器写 `draftKey` 为模板 id，草稿才不会串到别的模板上）。有未保存的修改时提醒用户：

```ts
window.addEventListener('beforeunload', (event) => {
  if (designer.dirty)
    event.preventDefault()
})
```

模板定下来以后，表单数据就按它的数据键存。改模板时删掉或改名的字段，旧数据里的值不会自动迁移，由宿主决定怎么处理。

## 已有数据与提交

- **打开**：宿主取出已有的数据交给渲染器的 `values`；没有的键取模板里的初始值。
- **提交**：渲染器校验通过后派发 `submit`，交出不含隐藏字段的数据；需要等后端回应时用 `submitAction`，见[渲染器](./renderer#提交)。
- **草稿**：随时用 `getFormData()` 取当前数据存草稿，再打开时交给 `values`。

## 选项与附件

下拉等字段的选项来源只是一个名字，渲染器按它调用宿主的 `loadOptions`；文件字段按 `uploadFile` 上传。宿主在这两个回调里调自己的接口，组件不知道接口的地址与鉴权方式。写法见[渲染器](./renderer#选项)。

## 权限

- 只能看模板的用户把设计器设成 `readonly`：能选择、浏览与预览，不能修改；用 `settingsPolicy` 的 `layout.panels.palette` 写 `hidden` 去掉物料面板。
- 只能看表单的用户把渲染器设成 `readonly`（仍可提交）或 `disabled`（不能提交）。
- 某些字段只给特定角色填写时，按角色用控制器的 `setReadOnly`、`setHidden` 强制，见[渲染器](./renderer#只读与禁用)。
- 这些都只在前端生效。模板与数据的保存权限要在服务端判断，服务端也应复核收到的模板与数据。

## 服务端复核

`@xihan-form/core` 不依赖 DOM，可以在 Node.js 后端直接复核：

```ts
const expressionEngine = createExpressionEngine()

/** 服务端收到模板时：有问题就拒绝保存。 */
export function checkTemplate(schema: unknown): boolean {
  return validateDocument(schema, { expressionEngine, identifiers: ['$limit'] }).length === 0
}

/** 服务端收到表单数据时：先按联动求出各字段的状态与赋值，再按这些状态校验。 */
export function checkSubmission(schema: FormDocument, submitted: Record<string, JsonValue>) {
  const variables = { $limit: 5000 }
  const linkage = resolveLinkage(schema, submitted, { expressionEngine, variables })
  const issues = validateValues(schema, linkage.values, { expressionEngine, states: linkage.states, variables })
  // 赋值字段（小计、合计）以重算出的值为准，不用提交上来的
  return { values: linkage.values, issues }
}
```

- 复核数据时先用 `resolveLinkage` 按联动求出各字段的状态，再交给 `validateValues`。不求联动时，按条件才变成必填的字段会被漏掉，隐藏的字段也会被当成要校验。
- 联动赋值的字段（如合计）以 `resolveLinkage` 重算出的值为准，不要相信提交上来的。
- 宿主变量（如 `$limit`）在服务端用同一份值。

后端不是 JavaScript 时，前端在提交前已经校验过；服务端把模板当作不透明的 JSON 存取，需要时另起一个 Node.js 服务做复核。

## 在前端框架里使用

渲染器与设计器是原生 Web Components，任何框架都能用：在应用启动时调用一次 `defineFormRenderer()` 或 `defineFormDesigner()`，之后像普通元素一样放进模板。模板、数据、回调这类对象要交给元素的属性，不要写成 attribute。

在 Vue 里，先告诉编译器 `xh-` 开头的标签是自定义元素，免得被当成组件去解析：

```ts
// vite.config.ts 里 @vitejs/plugin-vue 的选项
vue({
  template: {
    compilerOptions: {
      isCustomElement: tag => tag.startsWith('xh-'),
    },
  },
})
```

对象用 `.prop` 修饰交给属性，事件用 `@` 监听：

```vue
<script setup lang="ts">
/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// 在 Vue 里使用渲染器：对象经 .prop 交给元素的属性，事件用 @ 监听。

import type { FormRendererEventMap } from '@xihan-form/runtime'
import { defineFormRenderer } from '@xihan-form/runtime'
import { ref } from 'vue'
import { schema, values } from '../templates/contact'

defineFormRenderer()

const renderer = ref<HTMLElement & { submit: () => void }>()
const result = ref('')

function onSubmit(event: Event): void {
  result.value = JSON.stringify((event as FormRendererEventMap['submit']).detail.values)
}

function onInvalid(event: Event): void {
  result.value = `还有 ${(event as FormRendererEventMap['invalid']).detail.issues.length} 处没填对`
}
</script>

<template>
  <xh-form-renderer ref="renderer" :schema.prop="schema" :values.prop="values" @submit="onSubmit" @invalid="onInvalid" />
  <button type="button" @click="renderer?.submit()">
    提交
  </button>
  <pre>{{ result }}</pre>
</template>
```


React 19 起会把对象直接赋给自定义元素的同名属性；事件可以用 `ref` 拿到元素后 `addEventListener` 监听。

## 一个页面里放多个实例

组件不往 `window` 上挂对象，也不读写固定键名的本地存储，同一页面里的多个渲染器、多个设计器互不影响，扩展也按实例给。只有语言包是全局的：`setXhConfig` 对页面上所有元素生效，单个实例的文案用它的 `translations` 属性覆写。
