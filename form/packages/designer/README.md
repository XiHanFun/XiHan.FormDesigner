# @xihan-form/designer

曦寒表单设计器：`<xh-form-designer>` 可视化编辑表单模板，包括物料面板，画布上的拖放、选择、键盘编辑与复制粘贴，属性面板（属性、校验规则、联动规则），问题列表，预览态与预览宽度，撤销重做，以及设置对话框。以原生 Web Components 交付，任何前端项目都能用。设计器只吃模板与数据、吐模板与事件，模板的保存与权限由宿主负责。

设计器用到 XiHan.UI 的设计器零件，样式要四份一起引入（见下面的用法）。种类、渲染方式、编辑方式、属性编辑器、模板规则、命令、面板与设置分区都能经 `extensions` 登记。

## 用法

```ts
import { defineFormDesigner } from '@xihan-form/designer'
import '@xihan-ui/styles/index.css'
import '@xihan-ui/designer-shell/style.css'
import '@xihan-form/runtime/style.css'
import '@xihan-form/designer/style.css'

defineFormDesigner()

const designer = document.createElement('xh-form-designer')
designer.schema = schema
designer.addEventListener('schema-change', () => save(designer.schema))
document.body.append(designer)
```

## 装

```bash
pnpm add @xihan-form/designer @xihan-form/runtime @xihan-ui/styles @xihan-ui/designer-shell
```

完整文档见 [https://form.docs.xihanfun.com](https://form.docs.xihanfun.com)。

许可：MIT
