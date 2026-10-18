---
aside: false
---

# 设计器

`<xh-form-designer>` 是可视化的表单设计器：物料、画布、属性与问题列表都在里面，可以切到预览看真实效果。它只吃模板、吐模板与事件，模板存在哪里、谁能改，都由宿主决定。全部属性、方法与事件见[设计器参考](../reference/designer)。

## 接入

```bash
pnpm add @xihan-form/designer @xihan-form/runtime @xihan-ui/styles @xihan-ui/designer-shell
```

<<< @/examples/demos/designer.ts#setup

`defineFormDesigner()` 注册设计器以及它用到的全部元素，包括画布与预览共用的渲染器。样式要引入四份：XiHan.UI 的皮肤、设计器零件、渲染器与设计器自己的样式表。设计器要有高度，由宿主的布局给出。

<<< @/examples/demos/designer.ts#render

`schema` 是正在编辑的模板，读它就是当前的模板；给 `schema` 赋一个新模板会清空撤销历史与选择。

## 界面

| 区域 | 内容 |
| --- | --- |
| 工具栏 | 撤销、重做、删除、再制，设计与预览，预览宽度 |
| 物料 | 按分类列出可以放进表单的种类，可搜索 |
| 画布 | 按模板排出的表单，所见即所得；选中的节点带一条小工具栏：选中上一级、上移、下移、再制、删除 |
| 属性 | 三个页签：属性、校验规则、联动规则。没有选中时编辑表单设置，选中区域时编辑区域属性 |
| 问题 | 模板自检出的问题，点一条就选中并滚到出问题的节点 |

`panels` 特性按空格列出要显示的面板（`toolbar`、`palette`、`properties`、`issues`），缺省全部显示；画布总在。

## 编辑

**放进节点**：把物料拖到画布上的位置，或点物料条目，插到选中节点之后，没有选中时放到末尾。区域只收它能放的节点，如子表的区域只收字段；放不下的位置拖过去时不给落点。

**选择**：点节点选中它，按住 Shift、Ctrl 或 ⌘ 再点是追加或取消。也可以选中容器里的区域：栅格的一列、标签页的一页、折叠面板的一项、表格布局的单元格。

**移动**：把画布上的节点拖到新位置，或用小工具栏、右键菜单与快捷键上移下移。

**右键菜单**按选中的东西给出命令：节点有复制、剪切、粘贴、再制、选中上一级、上移、下移与删除；表格布局的单元格另有合并、拆分、插入与删除行列。菜单键或 Shift + F10 也能打开。

**复制粘贴**走系统剪贴板：复制的节点以表单自己的格式与 JSON 文本两种写进剪贴板，可以粘贴到另一个设计器、另一个页签，也可以粘贴一段 JSON 文本。粘贴时 id 全部换新，与目标作用域冲突的数据键改成新的键；剪贴板里的内容不是合法的表单节点时不粘贴。

焦点在画布里时的快捷键：

| 按键 | 作用 |
| --- | --- |
| Ctrl / ⌘ + Z | 撤销 |
| Ctrl / ⌘ + Shift + Z，Ctrl / ⌘ + Y | 重做 |
| Ctrl / ⌘ + C、X、V | 复制、剪切、粘贴 |
| Ctrl / ⌘ + D | 再制：复制并紧跟着粘贴 |
| Ctrl / ⌘ + A | 全选 |
| Delete，Backspace | 删除选中的节点或区域 |
| ↑ ↓ | 在同一层里移动选择 |
| Alt + ↑ ↓ | 上移、下移选中的节点 |
| Enter | 选中第一个子节点 |
| Esc | 选中上一级，再按一次清空选择 |
| Ctrl / ⌘ + S | 派发 `save` |

## 属性、校验与联动

属性面板按选中的节点列出它的属性，分基础、数据、外观三组，每个属性用合适的编辑方式：文本、数字、开关、下拉、选项表等。多个节点同时选中时只列出它们共有的属性，取值不同的显示「多个值」，改了就写给每个节点。

「校验规则」与「联动规则」两个页签编辑节点的规则：新增、删除、调整顺序、改每条规则的字段。条件、取值与表达式规则用表达式输入框，边输入边检查，并补全数据键、`$value` 等变量与函数名。规则的含义见[校验与联动](./validation)。

改动随输入写进模板，连续改同一个属性合成一步撤销。

## 问题列表

设计器随改随做模板自检，问题列在问题面板里，也随 `issues-change` 派发给宿主；问题码见[问题码](../reference/issues#schema)。需要时宿主也可以调用 `validate()` 取一次。

## 预览

工具栏的「预览」或 `mode = 'preview'` 切到预览态：画布换成真实的渲染器，可以填写、校验、看联动。`previewValues` 是预览用的示例数据，`loadOptions` 是预览时的选项加载函数，与渲染器的同名属性一样。

预览宽度有全宽、平板与手机三档（`previewWidth`），设计态的画布也按这个宽度排。

## 保存

设计器不存模板，只告诉宿主什么时候变了、用户想什么时候存：

- 每次修改派发 `schema-change`，载荷里是变化后的模板与这一步的操作，可以用来自动保存。
- 有没有未保存的修改变了时派发 `dirty-change`。
- 用户按 Ctrl / ⌘ + S 或点保存命令时派发 `save`；宿主存好后调用 `markSaved()`，设计器把当前模板记为已保存。

<<< @/examples/demos/designer.ts#save

`readonly` 让设计器只能选择、浏览与预览，不能修改。写成特性（attribute）时按三态读：没写或写 `"false"` 可修改，空串、`"true"` 与别的写法只读，移除后回到可修改。这是一处行为变化：此前 `readonly="false"` 也算只读，现在是可修改。

## 工具栏与菜单的排列

`commandLayout` 按位置写命令 id 的分组：`toolbar` 是工具栏，`menu:node`、`menu:region`、`menu:cell`、`menu:blank` 是选中节点、区域、表格单元格与空白处的右键菜单。写了某个位置就只显示列出的命令；没写的位置用内置的排列 `FORM_TOOLBAR_LAYOUT` 与 `FORM_MENU_LAYOUTS`。示例在内置的工具栏末尾加了保存：

```ts
designer.commandLayout = { toolbar: [...FORM_TOOLBAR_LAYOUT, ['save']] }
```

内置命令的 id：`undo`、`redo`、`copy`、`cut`、`paste`、`duplicate`、`delete`、`select-all`、`select-parent`、`move-up`、`move-down`、`merge-cells`、`split-cell`、`insert-row-above`、`insert-row-below`、`insert-column-left`、`insert-column-right`、`remove-row`、`remove-column`、`design`、`preview`、`width-full`、`width-tablet`、`width-phone`、`save`。扩展可以登记自己的命令，见[扩展](./extensions#命令)。

## 示例

出差申请：点物料加一个字段，状态行显示有未保存的修改；点一下画布再按 Ctrl / ⌘ + S，或点工具栏的保存，状态行显示已保存。

<FormDemo name="designer" />
