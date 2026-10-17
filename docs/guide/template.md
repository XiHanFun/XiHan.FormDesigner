# 模板结构

表单模板是一份 `FormDocument`，纯 JSON，不含函数，也不含任何会被执行的代码。它可以存进数据库、写成文件、在网络上传输，导入时只做结构检查。

## 文档

| 字段 | 内容 |
| --- | --- |
| `schemaVersion` | 结构版本，当前是 `1`（`FORM_SCHEMA_VERSION`） |
| `settings` | 表单设置：标签位置、尺寸、整表禁用与只读，见[表单设置](#settings) |
| `children` | 顶层节点，按顺序排列 |
| `extensions` | 可省，各扩展放在文档上的数据，见[扩展数据](#extension-data) |

每个类型的完整字段见[模板类型](../reference/schema)。

## 节点

节点分三类，`type` 区分：

| `type` | 是什么 | 有值吗 |
| --- | --- | --- |
| `field` | 字段：文本、数字、选择、日期、上传等 | 有，存在表单数据的 `key` 下 |
| `container` | 容器：栅格、卡片、标签页等布局，以及子表单、子表两种列表 | 布局容器没有；列表容器的值是行的数组 |
| `static` | 静态元素：分隔线、段落、标题、提示、图片、条码、二维码 | 没有 |

每个节点都有：

- `id`：在整份文档里唯一。设计器的选择、问题的定位、联动的实例都按它找节点。
- `kind`：种类，如 `text`、`grid`、`divider`，决定渲染成哪个元素、能写哪些属性。
- 三个属性包 `basic`、`data`、`appearance`：基础（标签、提示、初始值、隐藏与禁用）、数据（选项、精度、数据来源）与外观（尺寸、前后缀）。只写用到的属性，各种类的属性与取值见[种类与属性](../reference/kinds)。
- `linkage`：联动规则；字段与容器还有校验规则 `validation`。规则的写法见[校验与联动](./validation)。

容器另有区域 `regions`：一个区域是放子节点的一格，带自己的属性 `props`，如栅格一列的跨度、标签页一页的标题。

## 字段与表单数据

字段的数据键 `key` 是它的值在表单数据里的键：ASCII 字母或 `_` 开头，后接字母、数字或 `_`，在所在作用域里不能重复；`$` 开头的名字留给表达式里的变量。

值的形状随种类：文本是字符串，数字是数值，开关是布尔，多选组是字符串数组。打开某些属性会改变形状，如下拉打开「多选」后值是字符串数组。每个种类的值形状与空值见[种类与属性](../reference/kinds)。

渲染时字段的初始值取 `basic.initialValue`，没写就是种类的空值；交给渲染器的 `values` 叠在上面。

布局容器对数据透明：放在栅格、卡片、标签页里的字段，值仍在表单数据的顶层。列表容器（子表单、子表）有自己的数据键，值是行对象的数组，行里字段的键相对于行对象。下面这张出差申请的数据长这样：

<<< @/examples/templates/travel.ts#values

## 布局容器

| 种类 | 用法 |
| --- | --- |
| 栅格 `grid` | 按 12 列排版，每个区域是一格，`props.span` 是这一格占几列，排满一行自动换到下一行 |
| 卡片 `card` | 带标题 `basic.title` 的一块面板，只有一个区域 |
| 分组 `fieldset` | 带分组标题 `basic.legend` 的一组，只有一个区域 |
| 标签页 `tabs` | 每个区域是一页，页签文字是区域的 `props.title` |
| 折叠面板 `collapse` | 每个区域是一项，标题是 `props.title`，`props.expanded` 决定初始是否展开 |
| 表格布局 `table` | `appearance.rows` × `appearance.columns` 的格子，每个区域用 `props.row`、`props.column`、`props.rowSpan`、`props.columnSpan` 占一块；全部区域要恰好铺满表格，不能越界、重叠或留空 |

容器可以嵌套。卡片里放一个两列的栅格：

<<< @/examples/templates/travel.ts#card

标签页的每个区域是一页：

<<< @/examples/templates/travel.ts#tabs

## 列表

子表单与子表让用户按行录入，行可以新增、删除，`data.movable` 不为 `false` 时还能上下换序；`data.initialRows` 是没有数据时先给几行。

- **子表单** `subform`：每一行照着区域里的节点排一遍，区域里能放任意节点，包括栅格与另一个列表。
- **子表** `subtable`：按表格排，区域里只能放字段，一个字段是一列，列头取字段的标签。

子表的区域里放两个字段，就是两列：

<<< @/examples/templates/travel.ts#subtable

列表容器自己也能写校验：必填表示至少一行，长度按行数计。

## 静态元素

静态元素只展示、没有值：分隔线 `divider`、段落 `paragraph`、标题 `heading`、提示 `alert`、图片 `image`、条码 `barcode` 与二维码 `qrcode`。它们只有联动，没有校验，联动也只有显示与隐藏。

<<< @/examples/templates/travel.ts#static

## 表单设置 {#settings}

`settings` 管整张表单：

| 属性 | 取值 |
| --- | --- |
| `labelPlacement` | 标签在控件上方 `top`（缺省）还是左侧 `start` |
| `size` | 控件尺寸 `sm`、`md`、`lg`；字段自己写了 `appearance.size` 时以字段的为准 |
| `disabled` | 整表禁用，不能提交 |
| `readOnly` | 整表只读，仍可提交 |

## 扩展数据 {#extension-data}

文档与每个节点都可以带 `extensions`：扩展 id → 这个扩展自己的 JSON 对象。它只给扩展用，与业务属性分开，设计器编辑与复制粘贴时原样带着走。登记扩展的写法见「扩展」一章。

## 用代码拼模板

不经设计器、在代码里拼模板时，用 `createNode` 按种类新建节点：它会写好属性的缺省值，容器还会带上缺省的区域。拼好后用 `validateDocument` 自检：

<<< @/examples/snippets/create.ts#create

`validateDocument` 返回问题列表，空数组表示没有问题。问题码见[问题码](../reference/issues)。

## 示例

出差申请：卡片里的栅格、子表、子表单与标签页。改一个值，下方显示整份表单数据。

<FormDemo name="travel" />
