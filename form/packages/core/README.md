# @xihan-form/core

曦寒表单设计器的模型层：表单模板的结构（字段、布局容器、子表单与子表、静态元素，校验与联动规则，表单设置）、种类登记表与属性描述、模板自检与问题码、按模板检查表单数据、联动求值，以及模板的编辑操作。表达式由宿主注入的引擎求值。纯 TypeScript，不依赖 DOM，浏览器与 Node 里都能用。

**谁会装它**：在代码里拼模板、校验模板，或在服务端按模板检查提交上来的数据时直接引；只在页面上渲染或设计表单时，装 `@xihan-form/runtime` 或 `@xihan-form/designer` 就会带上它。

## 用法

```ts
import type { FieldNode, FormDocument } from '@xihan-form/core'
import { createDocument, createFormModel, createNode, validateDocument, validateValues } from '@xihan-form/core'
import { createIdAllocator } from '@xihan-ui/designer-kit'

const { registry } = createFormModel()
const ids = createIdAllocator('n')
const name = createNode(registry, 'text', ids, { key: 'name' }) as FieldNode
const schema: FormDocument = {
  ...createDocument(),
  children: [{ ...name, basic: { ...name.basic, label: '姓名' }, validation: [{ id: ids.next(), kind: 'required' }] }],
}

const schemaIssues = validateDocument(schema)
const valueIssues = validateValues(schema, { name: '' })
```

## 装

```bash
pnpm add @xihan-form/core
```

完整文档见 [https://form.docs.xihanfun.com](https://form.docs.xihanfun.com)。

许可：MIT
