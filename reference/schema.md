来源：https://form.docs.xihanfun.com/reference/schema

# 模板类型

<!-- 本页由 docs/scripts/gen-reference.mjs 从源码生成，不要手改；源码变了之后在 docs/ 运行 pnpm gen。 -->

表单文档 `FormDocument` 的全部类型，按 `@xihan-form/core` 的源码列出。当前结构版本 `FORM_SCHEMA_VERSION` 为 `1`。

各种类的属性包里有哪些属性见[种类与属性](./kinds)。

## 文档、节点与规则

### PropertyBag {#propertybag}

属性包：一组按名字存放的 JSON 值。

类型：<code>Readonly&lt;Record&lt;string, JsonValue&gt;&gt;</code>

### ExtensionData {#extensiondata}

扩展数据：扩展 id → 这个扩展自己的 JSON 对象。只给扩展用，与业务属性分开；编辑与复制粘贴原样带着走。

类型：<code>Readonly&lt;Record&lt;string, JsonObject&gt;&gt;</code>

### PropertyGroup {#propertygroup}

节点的属性分组：基础、数据、外观。校验与联动另以规则列表存放。

类型：<code>'basic' &#124; 'data' &#124; 'appearance'</code>

### RequiredRule {#requiredrule}

必填：值为空时不通过，空值判定取 `@xihan-ui/headless` 的 `isEmptyFormValue`：null、只含空白的字符串、空列表与元素全为空的列表算空，`false` 与 `0` 不算空。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | <code>string</code> | 是 | 规则 id，在所在规则列表里唯一；设计器编辑与问题定位都按它找规则。 |
| `kind` | <code>'required'</code> | 是 | 规则种类。 |
| `message` | <code>string</code> | 可省 | 不通过时给最终用户看的提示；不写时由运行时按问题码给出缺省文案。 |

### AcceptedRule {#acceptedrule}

必须为 `true`：用于「必须勾选同意」，值为 `false` 或空时都不通过。只适用于布尔值字段。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | <code>string</code> | 是 | 规则 id，在所在规则列表里唯一；设计器编辑与问题定位都按它找规则。 |
| `kind` | <code>'accepted'</code> | 是 | 规则种类。 |
| `message` | <code>string</code> | 可省 | 不通过时给最终用户看的提示；不写时由运行时按问题码给出缺省文案。 |

### LengthRule {#lengthrule}

长度：字符串按字素计（`@xihan-ui/headless` 的 `graphemeLength`，与文本框的字数一致）、列表按元素个数，闭区间。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | <code>string</code> | 是 | 规则 id，在所在规则列表里唯一；设计器编辑与问题定位都按它找规则。 |
| `kind` | <code>'length'</code> | 是 | 规则种类。 |
| `min` | <code>number</code> | 可省 | 最少多少个字符或元素。 |
| `max` | <code>number</code> | 可省 | 最多多少个字符或元素。 |
| `message` | <code>string</code> | 可省 | 不通过时给最终用户看的提示；不写时由运行时按问题码给出缺省文案。 |

### RangeRule {#rangerule}

数值范围，闭区间。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | <code>string</code> | 是 | 规则 id，在所在规则列表里唯一；设计器编辑与问题定位都按它找规则。 |
| `kind` | <code>'range'</code> | 是 | 规则种类。 |
| `min` | <code>number</code> | 可省 | 下限。 |
| `max` | <code>number</code> | 可省 | 上限。 |
| `message` | <code>string</code> | 可省 | 不通过时给最终用户看的提示；不写时由运行时按问题码给出缺省文案。 |

### PatternRule {#patternrule}

正则：`flags` 只允许 `i`、`m`、`s`、`u`，整串不匹配即不通过。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | <code>string</code> | 是 | 规则 id，在所在规则列表里唯一；设计器编辑与问题定位都按它找规则。 |
| `kind` | <code>'pattern'</code> | 是 | 规则种类。 |
| `pattern` | <code>string</code> | 是 | 正则的源码，不带两边的斜杠。 |
| `flags` | <code>string</code> | 可省 | 正则标志。 |
| `message` | <code>string</code> | 可省 | 不通过时给最终用户看的提示；不写时由运行时按问题码给出缺省文案。 |

### ExpressionRule {#expressionrule}

表达式：结果为 `false` 时不通过，为 `true` 或 `null` 时通过。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | <code>string</code> | 是 | 规则 id，在所在规则列表里唯一；设计器编辑与问题定位都按它找规则。 |
| `kind` | <code>'expression'</code> | 是 | 规则种类。 |
| `expression` | <code>string</code> | 是 | 受限表达式，`$value` 是字段自己的值。 |
| `message` | <code>string</code> | 可省 | 不通过时给最终用户看的提示；不写时由运行时按问题码给出缺省文案。 |

### ValidationRule {#validationrule}

声明式校验规则。`message` 是模板作者写给最终用户的提示，缺省时由运行时按规则种类给出。

取其一：<code><a href="#requiredrule">RequiredRule</a></code>、<code><a href="#acceptedrule">AcceptedRule</a></code>、<code><a href="#lengthrule">LengthRule</a></code>、<code><a href="#rangerule">RangeRule</a></code>、<code><a href="#patternrule">PatternRule</a></code>、<code><a href="#expressionrule">ExpressionRule</a></code>。

### ValidationKind {#validationkind}

校验规则的种类。

类型：<code><a href="#validationrule">ValidationRule</a>['kind']</code>

### LinkageAction {#linkageaction}

联动动作：条件成立时生效，不成立时回到节点的静态设定。
- `show` / `hide`：显示 / 隐藏。
- `enable` / `disable`：可用 / 禁用。
- `require` / `optional`：设为必填 / 取消必填。
- `assign`：把 `value` 表达式的结果赋给字段。

类型：<code>'show' &#124; 'hide' &#124; 'enable' &#124; 'disable' &#124; 'require' &#124; 'optional' &#124; 'assign'</code>

### LinkageRule {#linkagerule}

声明式联动规则；`when` 缺省表示总是成立。同一状态有多条规则成立时，排在后面的生效。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | <code>string</code> | 是 | 规则 id，在所在规则列表里唯一。 |
| `action` | <code><a href="#linkageaction">LinkageAction</a></code> | 是 | 条件成立时做什么。 |
| `when` | <code>string</code> | 可省 | 条件，受限表达式，结果为 `true` 时成立；缺省总是成立。 |
| `value` | <code>string</code> | 可省 | `assign` 的取值，受限表达式；其它动作不用。 |

### FieldNode {#fieldnode}

字段：有数据键与值。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | <code>'field'</code> | 是 | 节点类型。 |
| `id` | <code>string</code> | 是 | 节点 id，在整份文档里唯一。 |
| `kind` | <code>string</code> | 是 | 种类，如 `text`、`select`，决定渲染方式与可用的属性。 |
| `key` | <code>string</code> | 是 | 数据键：字段的值在表单数据里的键，在所在作用域里唯一。 |
| `basic` | <code><a href="#propertybag">PropertyBag</a></code> | 是 | 基础属性，如标签、提示、初始值、隐藏与禁用。 |
| `data` | <code><a href="#propertybag">PropertyBag</a></code> | 是 | 数据属性，如选项、精度、数据来源。 |
| `appearance` | <code><a href="#propertybag">PropertyBag</a></code> | 是 | 外观属性，如尺寸、前后缀。 |
| `validation` | <code>readonly <a href="#validationrule">ValidationRule</a>[]</code> | 是 | 校验规则。 |
| `linkage` | <code>readonly <a href="#linkagerule">LinkageRule</a>[]</code> | 是 | 联动规则。 |
| `extensions` | <code><a href="#extensiondata">ExtensionData</a></code> | 可省 | 各扩展放在这个节点上的数据。 |

### Region {#region}

区域：容器里放子节点的一格，如栅格的一列、标签页的一页、表格布局的一个单元格。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | <code>string</code> | 是 | 区域 id，在整份文档里唯一。 |
| `props` | <code><a href="#propertybag">PropertyBag</a></code> | 是 | 区域属性，如栅格的列宽、标签页的标题、表格布局单元格的位置。 |
| `children` | <code>readonly <a href="#formnode">FormNode</a>[]</code> | 是 | 放在这一格里的节点。 |

### ContainerNode {#containernode}

容器：子节点放在区域里。列表作用域的容器（子表单、子表）带 `key`，它的值是行对象的列表，区域里字段的键相对于行对象。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | <code>'container'</code> | 是 | 节点类型。 |
| `id` | <code>string</code> | 是 | 节点 id，在整份文档里唯一。 |
| `kind` | <code>string</code> | 是 | 种类，如 `grid`、`subform`，决定渲染方式与可用的属性。 |
| `key` | <code>string</code> | 可省 | 数据键：只有列表容器有，值是行对象的列表。 |
| `basic` | <code><a href="#propertybag">PropertyBag</a></code> | 是 | 基础属性，如标签、提示、初始值、隐藏与禁用。 |
| `data` | <code><a href="#propertybag">PropertyBag</a></code> | 是 | 数据属性，如选项、精度、数据来源。 |
| `appearance` | <code><a href="#propertybag">PropertyBag</a></code> | 是 | 外观属性，如尺寸、前后缀。 |
| `validation` | <code>readonly <a href="#validationrule">ValidationRule</a>[]</code> | 是 | 校验规则：只对列表容器的整份列表生效。 |
| `linkage` | <code>readonly <a href="#linkagerule">LinkageRule</a>[]</code> | 是 | 联动规则。 |
| `regions` | <code>readonly <a href="#region">Region</a>[]</code> | 是 | 区域，按顺序排列。 |
| `extensions` | <code><a href="#extensiondata">ExtensionData</a></code> | 可省 | 各扩展放在这个节点上的数据。 |

### StaticNode {#staticnode}

静态元素：只展示，没有值，如分隔线、说明文字。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | <code>'static'</code> | 是 | 节点类型。 |
| `id` | <code>string</code> | 是 | 节点 id，在整份文档里唯一。 |
| `kind` | <code>string</code> | 是 | 种类，如 `divider`、`paragraph`，决定渲染方式与可用的属性。 |
| `basic` | <code><a href="#propertybag">PropertyBag</a></code> | 是 | 基础属性，如正文、标题文字与隐藏。 |
| `data` | <code><a href="#propertybag">PropertyBag</a></code> | 是 | 数据属性。 |
| `appearance` | <code><a href="#propertybag">PropertyBag</a></code> | 是 | 外观属性，如级别、宽度。 |
| `linkage` | <code>readonly <a href="#linkagerule">LinkageRule</a>[]</code> | 是 | 联动规则：只有显示与隐藏。 |
| `extensions` | <code><a href="#extensiondata">ExtensionData</a></code> | 可省 | 各扩展放在这个节点上的数据。 |

### FormNode {#formnode}

表单节点。

取其一：<code><a href="#fieldnode">FieldNode</a></code>、<code><a href="#containernode">ContainerNode</a></code>、<code><a href="#staticnode">StaticNode</a></code>。

### NodeType {#nodetype}

节点类型。

类型：<code><a href="#formnode">FormNode</a>['type']</code>

### FormDocument {#formdocument}

表单文档：纯 JSON，不含任何代码。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `schemaVersion` | <code>typeof FORM_SCHEMA_VERSION</code> | 是 | 结构版本，当前是 `FORM_SCHEMA_VERSION`。 |
| `settings` | <code><a href="#propertybag">PropertyBag</a></code> | 是 | 表单设置，如标签位置、尺寸、整表禁用与只读。 |
| `children` | <code>readonly <a href="#formnode">FormNode</a>[]</code> | 是 | 顶层节点，按顺序排列。 |
| `extensions` | <code><a href="#extensiondata">ExtensionData</a></code> | 可省 | 各扩展放在文档上的数据。 |

## 选项 {#options}

选项：选项列表用 designer-kit 的内建编辑方式 `options`，选项树用 `treeOptions`，都要求 label。每项是 `{ value: string, label: string, disabled?: boolean, tone?: Tone, description?: string }`，选项树的项另可带 `children`（下一层的选项）与 `hasChildren`（有子项但还没给出，首次展开时向宿主要）。按 `@xihan-ui/core/options` 的 `findOptionViolation` 严格检查：不许多余的键，`value` 不为空、同一层里不重复，选项树最多 32 层；问题落在那一项的那个键上，如 `[2, "value"]`、`[0, "children", 1, "label"]`。
