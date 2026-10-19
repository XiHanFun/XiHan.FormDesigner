---
'@xihan-form/core': major
'@xihan-form/runtime': major
'@xihan-form/designer': major
---

**新增** 首次发布，以原生 Web Components 交付，不绑定前端框架。

- `@xihan-form/core`：表单模板的结构（字段、布局容器、子表单与子表、静态元素，校验与联动规则，表单设置）、种类登记表与属性描述、模板自检与问题码、按模板检查表单数据、联动求值、模板的编辑操作与复制粘贴片段的检查。表达式由宿主注入的引擎求值，纯 TypeScript，不依赖 DOM。
- `@xihan-form/runtime`：`<xh-form-renderer>` 按模板渲染表单：字段、布局、列表、校验与联动，选项与附件经 `loadOptions`、`uploadFile` 交给宿主，整表只读与禁用；`createFormController` 不经界面取值、联动与校验；与 XiHan.UI 内建语言一一对应的界面语言包（`@xihan-form/runtime/locale`）。
- `@xihan-form/designer`：`<xh-form-designer>` 可视化设计器，包括物料与顶栏的插入钮，画布上的拖放、选择、选中工具条、键盘编辑与复制粘贴，属性面板（属性、校验规则、联动规则三个页签，表达式边输入边检查），问题列表，按树列出模板内容的页面结构，面板的停靠、浮出与显隐（布局随设置保存），预览态与预览宽度，撤销重做（每一步带随语言切换的说明，历史记录面板列出各步、选一步就跳过去），状态栏，以及设置对话框（基础、布局与工具栏三页，工具栏的按钮可以藏起、换先后与分组）。种类、渲染方式、编辑方式、属性编辑器、模板规则、命令、面板与设置分区都能经 `extensions` 登记。
