# @xihan-form/designer

## 1.0.0-rc.1

### Major Changes

- 965bbfe: **新增** 首次发布，以原生 Web Components 交付，不绑定前端框架。

  - `@xihan-form/core`：表单模板的结构（字段、布局容器、子表单与子表、静态元素，校验与联动规则，表单设置）、种类登记表与属性描述、模板自检与问题码、按模板检查表单数据、联动求值、模板的编辑操作与复制粘贴片段的检查。表达式由宿主注入的引擎求值，纯 TypeScript，不依赖 DOM。
  - `@xihan-form/runtime`：`<xh-form-renderer>` 按模板渲染表单：字段、布局、列表、校验与联动，选项与附件经 `loadOptions`、`uploadFile` 交给宿主，整表只读与禁用；`createFormController` 不经界面取值、联动与校验；与 XiHan.UI 内建语言一一对应的界面语言包（`@xihan-form/runtime/locale`）。
  - `@xihan-form/designer`：`<xh-form-designer>` 可视化设计器，包括以带种类图标的方形卡片列出的物料，画布上的拖放、选择、选中工具条、拖动工具、键盘编辑与复制粘贴，属性面板（属性、校验规则、联动规则三个页签，表达式边输入边检查），问题列表，按树列出模板内容的页面结构（能多选，与画布是同一份选择），面板的停靠、浮出与显隐（布局随设置保存），最上一条菜单栏（文件、编辑、视图、帮助四张菜单，F10 进出，宿主的命令挂得进来，宿主的模板标题放在菜单栏正中、保存状态放在状态栏右端），预览态与预览宽度，撤销重做（每一步带随语言切换的说明，历史记录面板列出各步、选一步就跳过去，宿主经 historyState、goToHistory、clearHistory 与 history-change 读写，步数上限 historyLimit），状态栏，设置对话框（基础、语言、布局、工具栏、帮助、快捷键与关于七页：主题与主题色只作用于设计器，主题色有跟随页面、八种预设与自定义颜色；界面语言可以单独选，同样只作用于设计器；工具栏的按钮可以藏起、换先后与分组；开发者模式与渲染调试日志；版本常量 FORM_DESIGNER_VERSION），按 `draftKey` 在本机自动保存的草稿（下次装进同一个模板时问恢复还是丢弃），第一次打开时自动开始的新手引导（autoTour、startTour() 与 tour-end，走完后记在设置里），以及开发者模式下整份模板的 JSON 编辑框（openJsonEditor()，应用后作为一步可撤销）。种类、渲染方式、编辑方式、属性编辑器、模板规则、命令、面板、物料来源、设置分区、引导步骤、菜单栏的菜单、「关于」页的几行与种类图标都能经 `extensions` 登记。

### Patch Changes

- Updated dependencies [965bbfe]
  - @xihan-form/core@1.0.0-rc.1
  - @xihan-form/runtime@1.0.0-rc.1
