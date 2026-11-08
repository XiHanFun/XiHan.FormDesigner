# 更新日志

本页记录 `@xihan-form/core`、`@xihan-form/runtime`、`@xihan-form/designer` 各版本使用者能感知的变更，每条标注 **新增 / 修复 / 调整 / 移除**。这几个包总是同一个版本号一起发布；逐包的完整记录见仓库里各包的 `CHANGELOG.md`。

## v1.0.0（2026-11-08）

首个正式版，以原生 Web Components 交付，不绑定前端框架。模板是纯 JSON，渲染器按模板渲染出带排布、校验、联动与异步选项的表单，设计器可视化编辑模板。需要 XiHan.UI 5.4.0 及以上。

- **新增** `@xihan-form/core`：表单模板的结构（字段、布局容器、子表单与子表、校验与联动规则）、模板自检与问题码、按模板检查表单数据、联动求值与模板的编辑操作。表达式由宿主注入的引擎求值，纯 TypeScript，不依赖 DOM。
- **新增** `@xihan-form/runtime`：`<xh-form-renderer>` 按模板渲染表单，处理排布、列表、校验与联动，选项与附件经 `loadOptions`、`uploadFile` 交给宿主；`createFormController` 不经界面取值、联动与校验；界面语言包与 XiHan.UI 内建语言一一对应。
- **新增** `@xihan-form/designer`：`<xh-form-designer>` 可视化设计器：物料拖放、选择与键盘编辑，属性面板（属性、校验规则、联动规则），问题列表与页面结构，预览与预览宽度，撤销重做与历史记录，本机草稿。种类、属性编辑器、规则、命令、面板等都能经 `extensions` 扩展。
