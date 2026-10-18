# 介绍

曦寒表单设计器（XiHan.FormDesigner）是一款框架无关的表单设计器：以原生 Web Components 交付，可视化编辑表单模板，在业务页面里按模板渲染出带排布、校验、联动、异步选项与列表录入的表单。属于曦寒懿（XiHanFun）开源生态，采用 MIT 授权。

## 能做什么

| 场景 | 用什么 |
| --- | --- |
| 设计与修改表单 | `<xh-form-designer>`：物料面板、拖放排布、属性与规则编辑、问题列表、复制粘贴、撤销重做，可切到预览态 |
| 在业务页面里填表 | `<xh-form-renderer>`：按模板渲染表单，取值、赋值、校验、重置与提交 |
| 不经界面处理表单数据 | `createFormController`：同一套取值、联动与校验，不碰 DOM |
| 在服务端或脚本里检查 | `validateDocument` 检查模板，`validateValues` 按模板校验一份数据 |

模板里能放的东西：

- **字段**：单行与多行文本、可提及文本、密码、数字、验证码，下拉、可输入下拉、树选择、级联、单选组、多选组、按钮组、列表、可选标签、穿梭框、勾选框、开关，日期、日期范围、时间、时间范围，滑块、评分、颜色、标签、文件上传与签名。
- **容器**：栅格、标签页、卡片、折叠面板、分组与表格布局只管排版；子表单与子表的值是一组行，行可增删换序。
- **静态元素**：分隔线、段落、标题、提示、图片、条码与二维码，只展示、没有值。
- **规则**：校验（必填、必须勾选、长度、范围、正则、表达式）与联动（显示隐藏、启用禁用、必填与否、赋值），条件与取值都写成受限表达式。

## 设计原则

- **框架无关**：以原生 Web Components 交付，不绑定任何前端框架。元素用 Light DOM，控件、样式与图标都来自 [XiHan.UI](https://ui.docs.xihanfun.com)，样式只消费它的设计令牌。
- **零第三方依赖**：运行时只依赖 `@xihan-form/*` 与 `@xihan-ui/*`，受限表达式与格式化也来自 XiHan.UI。
- **模板即数据**：模板是纯 JSON，不含也不执行任何代码。需要计算的地方用受限表达式，导入模板不会带来脚本注入。
- **数据由使用方掌控**：组件不发网络请求。模板存在哪里、选项从哪里取、附件传到哪里、谁能改模板，都由使用方决定，经属性、回调与事件交给组件。
- **没有全局状态**：不往 `window` 上挂对象，不读写固定键名的本地存储，同一页面放多个实例互不影响。
- **按实例扩展**：新的字段种类、属性编辑器、校验规则、命令与面板都写成扩展，经元素的 `extensions` 属性传入，只对这一个实例生效。

## 包与入口

| 入口 | 内容 |
| --- | --- |
| `@xihan-form/core` | 模板的类型定义、模板自检、取值校验、联动求值与编辑操作。纯 TypeScript，不依赖 DOM，浏览器与 Node.js 里都能用 |
| `@xihan-form/runtime` | 业务页面用的 `<xh-form-renderer>` 与表单控制器 `createFormController`，样式在 `@xihan-form/runtime/style.css` |
| `@xihan-form/runtime/locale` | 中文语言包 `formZhCN`，渲染器与设计器共用 |
| `@xihan-form/designer` | `<xh-form-designer>`，样式在 `@xihan-form/designer/style.css` |

依赖方向固定为 `designer → runtime → core`。业务页面只需要 runtime，设计器只在需要编辑模板的地方加载。

## 工作流程

```text
设计器 <xh-form-designer>
  │  schema-change / save 事件
  ▼
宿主保存模板 JSON（数据库、文件，由宿主决定）
  │
  ▼
业务页面取模板与已有数据
  │  <xh-form-renderer>：选项加载、附件上传经回调交给宿主
  ▼
submit 事件交出表单数据 ──▶ 宿主提交，服务端再用 validateValues 校验一遍
```

1. 设计：在设计器里编辑模板，设计器派发 `schema-change` 与 `save`，宿主把模板 JSON 存起来。
2. 填写：业务页面取出模板与已有数据交给 `<xh-form-renderer>`，下拉的选项、附件的上传经回调交给宿主。
3. 提交：渲染器校验通过后派发 `submit`，宿主拿到表单数据自行提交；服务端可以用同一份模板再校验一遍。

## 运行环境

- `@xihan-form/core` 与 `createFormController` 不依赖 DOM，可以在浏览器、Node.js 或其它 JavaScript 运行环境里检查模板、校验数据。
- `<xh-form-renderer>` 与 `<xh-form-designer>` 要在支持 Custom Elements 的浏览器里运行。

## 下一步

- [快速开始](./quickstart)：在任意前端项目里装包、渲染一张表单并拿到提交的数据。
- [模板结构](./guide/template)：字段、容器、布局与列表，以及表单数据的形状。
- [校验与联动](./guide/validation)：校验规则、联动规则与表达式。
- [渲染器](./guide/renderer)：取值与赋值、提交、选项加载、附件上传与只读禁用。
- [设计器](./guide/designer)：编辑、属性与规则、预览、保存与命令排列。
- [扩展](./guide/extensions)：新种类、渲染方式、规则、命令、面板与属性编辑器。
- [与宿主集成](./guide/host)：模板的保存、权限、服务端复核与在前端框架里使用。
