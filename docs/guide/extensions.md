---
aside: false
---

# 扩展

新的字段种类、渲染方式、属性编辑器、模板规则、命令与面板都写成扩展：一个普通对象，经元素的 `extensions` 属性传入，只对这一个实例生效，同一页面的其它实例不受影响。内置的种类、渲染与命令也写成扩展，排在最前面，与传入的走同一条路。

## 三层

| 层 | 类型 | 在内置之上加的字段 | 谁用 |
| --- | --- | --- | --- |
| core | `FormCoreExtension` | `id`、`kinds`、`documentProperties`、`controls`、`rules`、`issueText` | `validateDocument`、`createFormModel` |
| 运行时 | `FormRuntimeExtension` | `fieldRenderers`、`containerRenderers`、`staticRenderers` | `<xh-form-renderer>`、`createFormController` |
| 设计器 | `FormDesignerExtension` | `editors`、`commands`、`panels`、`settings`、`setup` | `<xh-form-designer>` |

各层是超集：设计器层的扩展可以原样交给渲染器与 `validateDocument`，它们只读自己那一层的字段。业务页面只用渲染器时，扩展只写到运行时层，不会带进设计器的代码。

模板里用了扩展登记的种类，渲染器、设计器与 `validateDocument` 都要给同一组扩展，否则模板自检报 `node.unknownKind`。

## 一个例子

下面的扩展新增「身份证号」字段，渲染沿用单行文本，规则提醒加上格式校验，工具栏多一条复制 JSON：

<<< @/examples/extensions/id-card.ts#extension

### 种类

`kinds` 里的每一项是一个种类定义。字段的定义：

<<< @/examples/extensions/id-card.ts#kind

| 字段 | 说明 |
| --- | --- |
| `type` | `field`、`container` 或 `static` |
| `kind` | 种类名，不能与内置的或别的扩展的重名 |
| `category` | 物料面板里的分类，内置的有 `input`、`choice`、`datetime`、`advanced`、`layout`、`data`、`static` |
| `element` | 缺省渲染用的 XiHan.UI 元素标签 |
| `properties` | 三组属性描述，属性面板按它们给出编辑方式，模板自检按它们检查取值；写法见[种类与属性](../reference/kinds)里内置种类的属性表 |
| `validations` | 字段与容器适用的校验规则种类 |
| `valueKind` / `emptyValue` | 字段的值形状与空值，可随 `data` 变化 |

容器另有 `scope`（`list` 时带数据键、值是行的数组，`none` 只管排版）、`regionProperties`、`regions`（区域个数的上下限与新建时的区域）、`accepts`（区域能放任意节点还是只放字段）与可选的 `check`（种类自己的结构检查）。

### 渲染

渲染器按种类名找渲染方式。`fieldRenderers` 的值是一个函数：收到字段的上下文，建出控件元素，返回 `{ element, update?, destroy? }`；标签、提示与错误文案由渲染器外面的字段外壳给出，控件不必自带。上下文里有字段节点、数据路径、当前值、状态、错误文案、选项、文案，以及 `setValue` 与 `commit`，见[渲染器参考](../reference/renderer#fieldrenderercontext)。

内置的字段渲染表 `FORM_FIELD_RENDERERS` 也导出了，新种类的控件与某个内置种类一样时可以直接拿来用，例子里身份证号就用了单行文本的。渲染方式按种类名登记，不能与内置的重名，内置种类的渲染不能被替换。

模板里的种类没有渲染方式时，渲染器不渲染整张表单，派发 `schema-error`（`XH_FORM_RT_NO_RENDERER`）。

### 规则与问题说明

`rules` 里的每一项是 `(document, context) => 问题[]`，与内置检查一起跑，结果进 `validateDocument` 的返回值与设计器的问题列表。问题码必须以扩展 `id` 的末段加点开头，例子的 `id` 是 `acme/id-card`，问题码就是 `id-card.…`；问题可以写 `severity: 'warning'`。

<<< @/examples/extensions/id-card.ts#rule

`issueText` 给自己的问题码说明文字，设计器的问题列表显示它。

### 命令

`commands` 里的命令与内置命令一样：`{ id, label, shortLabel?, icon?, placement?, shortcut?, enabled?, checked?, tone?, run }`。`id` 用扩展 id 加点加名字；`placement` 写 `toolbar` 或 `menu:node` 等时出现在对应位置的缺省排列末尾，写 `header` 时出现在顶栏，钮上图标在上、`shortLabel` 在下；宿主用 `commandLayout` 排列时按 id 引用；`shortcut` 是快捷键：带 `Mod` 的在整个设计器里认（焦点在文字输入里时除外），单键只在焦点在画布里时认，`Mod` 在 macOS 上是 ⌘、其余平台是 Ctrl；`icon` 取 `@xihan-ui/icons` 的图标，工具栏缺省只显示图标，没给图标的命令显示文字；破坏性命令的 `tone` 写 `danger`。`label`、`enabled` 与 `run` 收到的上下文里有设计器实例 `designer`、设计器文案 `translations`，以及四款设计器共用的命令文案 `commands`（如 `commands.undo`）。

## 名字

物料、画布与问题列表里种类的名字取设计器文案的 `kind` 与 `nodeTag`，分类名取 `category`，属性名取 `property`。新种类的名字由宿主补进文案：

<<< @/examples/demos/extension.ts#names

<<< @/examples/demos/extension.ts#use

<FormDemo name="extension" fullscreen />

物料的「输入」分类末尾多了身份证号；点它放进画布，问题列表给出一条警告；工具栏末尾多了「复制 JSON」。

## 面板

`panels` 在设计器外框里加自己的区域：`region` 给出区名、位置与标题，给了 `title` 就画成卡片，面板头写标题，还可以给 `subtitle` 与 `help`；卡片能点「×」收起、从工具栏的「面板」菜单打开，写 `closable: false` 就不能收起。面板元素用设计器零件时写 `headless`，标题交给卡片画。`create({ designer })` 建出面板元素，可选的 `update` 在设计器状态变化后调用、`destroy` 在撤掉时调用。面板里的条目可以拖到画布上：拖动载荷写成 `{ kind }` 是新建一个节点，写成 `{ clipboard: { nodes } }` 是按粘贴的规则插入一段节点。面板与外框的约定见视图组件文档的 [designer-shell](https://ui.docs.xihanfun.com/runtime/designer-shell)。

## 设置分区

`settings` 给设置对话框加自己的分区：`id`、`label`、可选的 `order` 与条目 `items`，条目用属性描述的写法，写了 `default` 的是缺省值。用户的取值以「分区 id.条目 id」为键，命令、面板与扩展从上下文的 `settings` 读，没写的已经取了缺省值。分区 id 不能是 `general`，也不能与别的扩展重名，见[设置](./designer#设置)。

## 属性编辑器与编辑方式

- `controls` 登记新的编辑方式：键是属性描述里的 `control.kind`，值的 `check(value)` 返回问题码或 `undefined`，模板自检按它检查取值。内置的除了文本、数字、开关、下拉等，还有选项表 `options` 与选项树 `tree-options`。
- `editors` 给属性面板换上自己的编辑器，可以按编辑方式、属性路径或「种类 + 路径」查找；路径带分组前缀，如 `basic.label`、`data.options`，数据键是 `key`；种类在节点上是种类名，区域是 `region`，表单设置是 `settings`。编辑器的写法见视图组件文档的 [designer-kit](https://ui.docs.xihanfun.com/runtime/designer-kit)。
- `documentProperties` 给表单设置加属性，没有选中节点时属性面板编辑它们。

## 扩展数据

扩展自己的数据放在文档或节点的 `extensions` 里，键是扩展 `id`，值是一个 JSON 对象，与业务属性分开。设计器的编辑操作 `setExtensionData` 写它，复制粘贴时原样带着走：

```ts
designer.execute([{ type: 'setExtensionData', nodeId: 'f-name', id: 'acme/id-card', data: { masked: true } }])
```

## 冲突与装卸

- 种类名、渲染方式、编辑方式、命令 id、快捷键与面板区名在扩展之间不能重名。给 `extensions` 赋值时当场查重，冲突抛 `DesignerExtensionError`，什么都不变。
- `setup(context)` 在设计器连上页面时调用，返回的函数在断开或换掉扩展时调用，适合挂监听。
