# @xihan-form/runtime

曦寒表单设计器的运行时，给业务页面用：`<xh-form-renderer>` 按模板渲染表单，做排布、校验与联动，选项与附件经 `loadOptions`、`uploadFile` 交给宿主，提交时派发带表单数据的事件；`createFormController` 不经界面取值、联动与校验。以原生 Web Components 交付，任何前端项目都能用。

子入口：

- `@xihan-form/runtime/locale`：界面语言包（`formZhCN`、`formJaJP`……），与 XiHan.UI 的内建语言一一对应，渲染器与设计器共用。
- `@xihan-form/runtime/design`：设计器画布复用的渲染部件，业务页面用不到。
- `@xihan-form/runtime/style.css`：渲染器的样式，只消费 `@xihan-ui/styles` 的设计令牌。

## 用法

```ts
import type { FormRendererEventMap } from '@xihan-form/runtime'
import { defineFormRenderer } from '@xihan-form/runtime'
import '@xihan-ui/styles/index.css'
import '@xihan-form/runtime/style.css'

defineFormRenderer()

const renderer = document.createElement('xh-form-renderer')
renderer.schema = schema
renderer.values = values
renderer.addEventListener('submit', (event: Event) => {
  save((event as FormRendererEventMap['submit']).detail.values)
})
document.body.append(renderer)
```

## 装

```bash
pnpm add @xihan-form/runtime @xihan-ui/web-components @xihan-ui/styles
```

完整文档见 [https://form.docs.xihanfun.com](https://form.docs.xihanfun.com)。

许可：MIT
