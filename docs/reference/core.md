# 模型层 core

<!-- 本页由 docs/scripts/gen-reference.mjs 从源码生成，不要手改；源码变了之后在 docs/ 运行 pnpm gen。 -->

`@xihan-form/core` 是纯 TypeScript 的模型层：模板类型、模板自检、取值校验、联动求值与编辑操作，不依赖 DOM，浏览器、Node.js 与其它 JavaScript 运行环境里都能用。模板类型的字段见[模板类型](./schema)，种类的属性见[种类与属性](./kinds)。

## 检查与校验

### validateDocument() {#validatedocument}

```ts
declare function validateDocument(document: unknown, options?: ValidateDocumentOptions): readonly FormSchemaIssue[]
```

校验文档：输入可以是任意值（如反序列化的 JSON），逐项核对后返回全部问题，没有问题时返回空数组。种类、表单设置、编辑方式与规则按 `extensions` 合出的模型认；文档与各节点上的扩展数据只查形状。问题的路径从文档根算起，只用键与下标；问题落在节点、区域或规则上时由 target 标出。提供表达式引擎时，再按各规则所在位置可引用的名字检查表达式。文档与各节点的必需部分齐全、类型都对时，最后按扩展顺序跑各扩展的规则。严重程度缺省为 error，可用 `severity` 按问题码改。扩展冲突时抛 `DesignerExtensionError`。

### ValidateDocumentOptions {#validatedocumentoptions}

schema 自校验的选项。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `extensions?` | `readonly FormCoreExtension[]` | 种类、表单设置、编辑方式与规则都从这组扩展来，内置扩展自动排在最前；与渲染器、设计器的 extensions 是同一份。 |
| `expressionEngine?` | `ExpressionEngine` | 表达式引擎；提供时逐条检查规则里的表达式。 |
| `identifiers?` | `readonly string[]` | 宿主提供给表达式的额外顶层名字。 |
| `maxDepth?` | `number` | 节点嵌套层数上限，缺省 32。 |
| `severity?` | `Readonly<Partial<Record<FormSchemaIssueCode \| (string & {}), IssueSeverity \| 'off'>>>` | 按问题码改严重程度，`off` 去掉该码；缺省全部为 error。扩展规则的问题码也认。 |

### validateValues() {#validatevalues}

```ts
declare function validateValues(document: FormDocument, values: Readonly<Record<string, JsonValue>>, options?: ValidateValuesOptions): readonly ValueIssue[]
```

按声明式规则校验表单值，返回全部问题。隐藏或禁用的实例连同其后代都不校验；值为空时只看必填与 accepted（必须为 true），其余规则跳过；必填由节点状态决定，联动可以加上或去掉。正则整串匹配。有表达式规则却没有提供 expressionEngine 时抛 `TypeError`。

### ValidateValuesOptions {#validatevaluesoptions}

值校验的选项。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `expressionEngine?` | `ExpressionEngine` | 表达式引擎；有表达式规则时必须提供。 |
| `states?` | `ReadonlyMap<string, NodeState>` | 联动求出的节点状态；缺省时按静态设定：`basic.hidden` / `disabled` 与有没有必填规则。 |
| `variables?` | `Readonly<Record<string, unknown>>` | 宿主提供给表达式的额外变量。 |

### ValueIssue {#valueissue}

值校验的问题：在表单问题之上带着实例路径与规则里作者写的提示。

继承 `FormIssue`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `path` | `readonly (string \| number)[]` | 出问题的值在表单数据里的路径，列表里的字段带行号。 |
| `message?` | `string` | 规则里作者写的提示；没写时不带，由界面按问题码给出文案。 |

## 联动

### resolveLinkage() {#resolvelinkage}

```ts
declare function resolveLinkage(document: FormDocument, values: Readonly<Record<string, JsonValue>>, options?: ResolveLinkageOptions): LinkageResult
```

按文档顺序求联动：每个节点实例从静态设定（`basic.hidden` / `disabled` / `readOnly`、有没有必填规则）出发，依次执行条件成立的规则，排在后面的覆盖前面的；赋值立即写进工作副本，后面的表达式读到的是新值。规则执行完后叠上宿主的强制设定，再与表单设置的 `disabled` / `readOnly`、祖先容器的隐藏与禁用向下叠加。有带表达式的规则却没有提供 expressionEngine 时抛 `TypeError`。

### ResolveLinkageOptions {#resolvelinkageoptions}

联动求值的选项。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `expressionEngine?` | `ExpressionEngine` | 表达式引擎；有带条件或赋值的规则时必须提供。 |
| `variables?` | `Readonly<Record<string, unknown>>` | 宿主提供给表达式的额外变量，名字建议以 `$` 开头，避免与数据键冲突。 |
| `overrides?` | `ReadonlyMap<string, StateOverride>` | 宿主的强制设定，键是节点 id（作用于全部实例）或实例键（只作用于该实例，叠在节点 id 的设定之上）。 |

### LinkageResult {#linkageresult}

联动求值的结果。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `states` | `ReadonlyMap<string, NodeState>` | 各节点实例的状态，键由 `instanceKey` 生成。 |
| `values` | `Record<string, JsonValue>` | 执行赋值之后的表单值；输入不会被修改。 |
| `assignments` | `readonly Assignment[]` | 按执行顺序列出的赋值。 |
| `issues` | `readonly FormIssue[]` | 求值中出的问题，如表达式求值失败、条件结果不是布尔。 |

### NodeState {#nodestate}

节点实例的状态：已经叠加了祖先容器的隐藏与禁用。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `hidden` | `boolean` | 隐藏：不显示，不参与校验。 |
| `disabled` | `boolean` | 禁用：不能编辑，不参与校验。 |
| `readOnly` | `boolean` | 只读：不能编辑，仍参与校验。 |
| `required` | `boolean` | 必填。 |

## 新建

### createDocument() {#createdocument}

```ts
declare function createDocument(settings?: PropertyBag): FormDocument
```

新建一份空文档。

### createNode() {#createnode}

```ts
declare function createNode(registry: KindRegistry, kind: string, ids: IdAllocator, options?: CreateNodeOptions): FormNode
```

按种类原型新建节点；种类没有登记时抛 `TypeError`。

### CreateNodeOptions {#createnodeoptions}

新建节点的选项。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `key?` | `string` | 字段与列表容器的数据键；缺省由种类名与 id 派生。 |

## 扩展

### FormCoreExtension {#formcoreextension}

表单 core 层的扩展：种类（字段、容器、静态元素）、表单设置的属性、编辑方式与规则。运行时层与设计器层的扩展在它之上再加渲染、命令与面板，core 函数只读这里的字段。

继承 `DesignerExtensionCore<FormDocument, FormRuleContext>`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `kinds?` | `readonly KindDefinition[]` | 种类；种类名不能与内置的或别的扩展的重名。 |
| `documentProperties?` | `readonly FormPropertyDescriptor[]` | 表单设置的属性，path 是设置里的名字，追加在内置之后；没选中任何节点时属性面板编辑它们。 |

| 方法 | 说明 |
| --- | --- |
| `issueText(issue: FormSchemaIssue): string \| undefined` | 这个扩展自己的问题码（规则与编辑方式给出的）的说明文字；返回 undefined 时交给设计器的文案。 |

### createFormModel() {#createformmodel}

```ts
declare function createFormModel(extensions?: readonly FormCoreExtension[]): FormModel
```

合出表单模型：内置扩展 `FORM_CORE_EXTENSION` 在前，`extensions` 按顺序在后。扩展 id、种类名、表单设置的属性名、编辑方式等重名时抛 `DesignerExtensionError`；种类名不合规或容器区域个数的上下限不合法时抛 `TypeError`。同一个数组只合一次：元素把同一份 extensions 交给各个 core 函数时不重复合并。

## 全部导出

### bindings

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `createInitialValues` | 函数 | 由文档得出表单的初始值：字段取 `basic.initialValue`，没有则取种类的空值；列表容器取 `data.initialRows` 行。 |
| `createRowValues` | 函数 | 列表容器新增一行时的行对象：行内各字段取初始值，嵌套列表取各自的初始行数。 |
| `DataBinding` | 接口 | 一处数据绑定：字段，或带数据键的列表容器。 |
| `formDataFields` | 函数 | 表单数据的字段树（designer-kit 的 DataField）：字段是 value，标签取 `basic.label`；列表容器是 list，标签取 `basic.title`，子字段是一行里的字段；布局容器不占层级。 |
| `identifiersAt` | 函数 | 节点上的表达式可以引用的顶层名字：顶层作用域的全部数据键、`extra`，字段与列表容器另有 `$value`，位于列表容器里的节点另有 `$row` 与 `$index`。 |
| `isValueOfKind` | 函数 | 值是否符合值形状；`null` 只对标量与对象表示「没有值」。 |
| `listBindings` | 函数 | 按文档顺序列出全部数据绑定。 |
| `scopeKeys` | 函数 | 某个作用域里直接绑定的数据键，按文档顺序。 |

### copy

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `cloneNodesForInsert` | 函数 | 把节点改造成能插进 parent 区域（`null` 为文档顶层）的副本：节点、区域与规则的 id 全部由 ids 重新分配；直接落在目标作用域里的数据键与该作用域已有的键或彼此冲突时，改为 `deriveKey(种类, 新 id)`。 |
| `regionScope` | 函数 | 区域所在的数据作用域：最近的列表容器 id，文档顶层与不在列表里的区域为 `null`；区域不存在时返回 `undefined`。 |

### create

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `createDocument` | 函数 | 新建一份空文档。 |
| `createNode` | 函数 | 按种类原型新建节点；种类没有登记时抛 `TypeError`。 |
| `CreateNodeOptions` | 接口 | 新建节点的选项。 |
| `createRegion` | 函数 | 按容器种类新建一个区域；`props` 覆盖区域属性的缺省值。 |
| `deriveKey` | 函数 | 由种类名与 id 派生字段键：种类名转成小驼峰，接 `_` 与 id 里的字母数字。 |
| `FORM_SETTING_PROPERTIES` | 常量 | 表单设置的属性描述：标签位置、尺寸、整表禁用与只读，存放在文档的 `settings` 里。 |
| `isValidKey` | 函数 | 字段键是否合法：ASCII 字母或 `_` 开头，后接字母、数字、`_`，不是保留字；`$` 开头的名字留给运行时变量。 |

### expression

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `RUNTIME_VARIABLES` | 常量 | 运行时变量：当前字段的值、所在行与行号。 |

### extensions

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `createFormModel` | 函数 | 合出表单模型：内置扩展 `FORM_CORE_EXTENSION` 在前，`extensions` 按顺序在后。 |
| `FORM_CORE_EXTENSION` | 常量 | 内置扩展：内置种类、表单设置，以及选项列表与选项树两种编辑方式。 |
| `FORM_EXTENSION_SPACES` | 常量 | 表单各层扩展共用的名字空间：种类名与表单设置的属性名。 |
| `FormCoreExtension` | 接口 | 表单 core 层的扩展：种类（字段、容器、静态元素）、表单设置的属性、编辑方式与规则。 |
| `FormModel` | 接口 | 一组扩展合出的表单模型。 |
| `FormRuleContext` | 接口 | 规则拿到的上下文：合并后的种类登记表。 |

### issues

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `FormIssue` | 接口 | 一条值校验或联动问题。 |
| `FormIssueCode` | 类型 | 值校验与联动的问题码： |
| `FormIssueData` | 类型 | 问题附带的定位数据：名字、数量、区间，不放文案。 |
| `FormSchemaIssue` | 类型 | 一条模板结构问题：路径从文档根算起，节点、区域、规则用 target 标出（kind 为 node、region、rule）。 |
| `FormSchemaIssueCode` | 类型 | 模板结构问题的问题码：通用问题码加表单专属问题码。 |
| `FormSchemaProductCode` | 类型 | 模板结构问题里表单专属的问题码（通用问题码见 designer-kit/schema 的 CommonIssueCode）： |

### linkage

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `Assignment` | 接口 | 一次赋值：字段的实例路径与赋进去的值。 |
| `instanceKey` | 函数 | 节点实例的键：顶层节点是它的 id，列表里的节点在 id 后接 `#` 与逐层行号。 |
| `LinkageResult` | 接口 | 联动求值的结果。 |
| `NodeState` | 接口 | 节点实例的状态：已经叠加了祖先容器的隐藏与禁用。 |
| `resolveLinkage` | 函数 | 按文档顺序求联动：每个节点实例从静态设定（`basic.hidden` / `disabled` / `readOnly`、有没有必填规则）出发，依次执行条件成立的规则，排在后面的覆盖前面的；赋值立即写进工作副本，后面的表达式读到的是新值。 |
| `ResolveLinkageOptions` | 接口 | 联动求值的选项。 |
| `StateOverride` | 接口 | 宿主对节点自身状态的强制设定：给出的项覆盖联动结果，祖先的隐藏、禁用、只读仍向下叠加。 |

### operations

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `applyOperation` | 函数 | 对文档应用一个操作，返回新文档与逆操作。 |
| `applyOperations` | 函数 | 依次应用一组操作；逆操作是各操作逆操作按反序拼接。 |
| `FormOperation` | 类型 | 编辑操作。 |
| `FormOperationError` | 类 | 编辑操作无法应用时抛出；`message` 就是错误码，不带文案。 |
| `FormOperationErrorCode` | 类型 | 编辑操作的错误码。 |
| `OperationResult` | 接口 | 操作的结果：新文档与逆操作；没有带来变化时返回同一个文档、逆操作为空。 |
| `RuleList` | 类型 | 规则所在的列表。 |

### registry/builtin

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `BUILTIN_KINDS` | 常量 | 全部内置种类：字段、容器、静态元素。 |

### registry/builtin-containers

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `BUILTIN_CONTAINERS` | 常量 | 内置容器种类。 |
| `BUILTIN_STATICS` | 常量 | 内置静态元素种类。 |
| `tableCells` | 函数 | 读表格布局的全部单元格，`id` 是单元格区域的 id。 |
| `tableSize` | 函数 | 读表格布局的行数与列数。 |

### registry/builtin-fields

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `BUILTIN_FIELDS` | 常量 | 内置字段种类。 |

### registry/kinds

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `ContainerKindDefinition` | 接口 | 容器种类。 |
| `createKindRegistry` | 函数 | 创建种类登记表；种类名必须是小写短横线形式且不重复，否则抛 `TypeError`。 |
| `FieldKindDefinition` | 接口 | 字段种类。 |
| `KindDefinition` | 类型 | 节点种类。 |
| `kindLabel` | 函数 | 种类在某种语言下的显示名：先取语言标记完全相同的，再取同一语种的（zh-TW 没写时用 zh-CN），再取 en-US；种类没写 label、或这几样都没有时为 undefined。 |
| `KindLabel` | 类型 | 种类自带的显示名：键是 BCP 47 语言标记（如 en-US、zh-CN），值是这种语言下的名字。 |
| `KindRegistry` | 接口 | 节点种类登记表。 |
| `LINKAGE_ACTIONS` | 常量 | 各类节点可用的联动动作。 |
| `StaticKindDefinition` | 接口 | 静态元素种类。 |
| `StructureProblem` | 接口 | 容器的结构问题，由容器种类自行检查，问题码不带文案：给出 regionId 时落在该区域上，否则落在容器本身。 |
| `ValueKind` | 类型 | 字段值的形状： |

### registry/properties

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `checkFormPropertyValue` | 函数 | 检查属性值是否符合编辑方式；符合时为 `undefined`，否则给出问题码。 |
| `EMPTY_PROPERTY_SCHEMA` | 常量 | 空的属性描述表。 |
| `findFormPropertyValueIssue` | 函数 | 找出属性值第一处不符合编辑方式的地方；符合时为 `undefined`。 |
| `FORM_CONTROLS` | 常量 | 表单内置扩展登记的编辑方式 `tree-options`：选项树，元素是 `{ value: string, label: string, disabled?: boolean, tone?: Tone, description?: string }`，另可带 `children` 与 `hasChildren`。 |
| `FORM_PROPERTY_EDITORS` | 常量 | 表单内置的属性编辑器查找表，交给 designer-kit 的 `resolvePropertyEditor` 使用：按编辑方式取缺省编辑器，字段初始值按路径另用 `value` 编辑器（形状随字段种类）。 |
| `FormPropertyControl` | 类型 | 表单的编辑方式：designer-kit 的内建编辑方式，或扩展登记的编辑方式（`kind` 是登记的键）。 |
| `FormPropertyDescriptor` | 类型 | 表单的属性描述：`path` 是属性在所在属性包（basic / data / appearance、区域或表单设置）里的路径，表单只用一段 `[名字]`。 |
| `FormPropertyValueIssue` | 接口 | 属性值的一处问题：`path` 相对这个值，落在值本身时是 `[]`。 |
| `isValidPropertyValue` | 函数 | 属性值是否符合描述；`controls` 同 `checkFormPropertyValue`。 |
| `numberControl` | 函数 | 内建的数字编辑方式：control 是 number 时原样返回，否则为 undefined。 |
| `propertyName` | 函数 | 属性名，即属性路径唯一的一段。 |
| `PropertySchema` | 类型 | 按分组列出的属性描述。 |

### schema

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `AcceptedRule` | 接口 | 必须为 `true`：用于「必须勾选同意」，值为 `false` 或空时都不通过。 |
| `ContainerNode` | 接口 | 容器：子节点放在区域里。 |
| `ExpressionRule` | 接口 | 表达式：结果为 `false` 时不通过，为 `true` 或 `null` 时通过。 |
| `ExtensionData` | 类型 | 扩展数据：扩展 id → 这个扩展自己的 JSON 对象。 |
| `FieldNode` | 接口 | 字段：有数据键与值。 |
| `FORM_SCHEMA_VERSION` | 常量 | 当前的文档结构版本。 |
| `FormDocument` | 接口 | 表单文档：纯 JSON，不含任何代码。 |
| `FormNode` | 类型 | 表单节点。 |
| `LengthRule` | 接口 | 长度：字符串按字素计（`@xihan-ui/headless` 的 `graphemeLength`，与文本框的字数一致）、列表按元素个数，闭区间。 |
| `LinkageAction` | 类型 | 联动动作：条件成立时生效，不成立时回到节点的静态设定。 |
| `LinkageRule` | 接口 | 声明式联动规则；`when` 缺省表示总是成立。 |
| `NodeType` | 类型 | 节点类型。 |
| `PatternRule` | 接口 | 正则：`flags` 只允许 `i`、`m`、`s`、`u`，整串不匹配即不通过。 |
| `PROPERTY_GROUPS` | 常量 | 全部属性分组。 |
| `PropertyBag` | 类型 | 属性包：一组按名字存放的 JSON 值。 |
| `PropertyGroup` | 类型 | 节点的属性分组：基础、数据、外观。 |
| `RangeRule` | 接口 | 数值范围，闭区间。 |
| `Region` | 接口 | 区域：容器里放子节点的一格，如栅格的一列、标签页的一页、表格布局的一个单元格。 |
| `RequiredRule` | 接口 | 必填：值为空时不通过，空值判定取 `@xihan-ui/headless` 的 `isEmptyFormValue`：null、只含空白的字符串、空列表与元素全为空的列表算空，`false` 与 `0` 不算空。 |
| `StaticNode` | 接口 | 静态元素：只展示，没有值，如分隔线、说明文字。 |
| `ValidationKind` | 类型 | 校验规则的种类。 |
| `ValidationRule` | 类型 | 声明式校验规则。 |

### table-commands

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `insertTableLine` | 函数 | 在第 `at` 行（或列）之前插入一整行（列），`at` 等于行数时追加在末尾。 |
| `mergeTableCells` | 函数 | 合并单元格：所选单元格必须恰好拼成一个矩形，且矩形里没有未选的单元格。 |
| `removeTableLine` | 函数 | 删除第 `at` 行（或列）：只占这一行（列）的单元格删除，跨过它的单元格缩短，其后的单元格前移；表格至少保留一行（列）。 |
| `splitTableCell` | 函数 | 拆分单元格：跨行跨列都还原成 1，空出来的位置按行优先补上新的空单元格，紧跟在原单元格之后。 |

### traverse

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `collectDocumentIds` | 函数 | 文档里已用的全部 id：节点、区域与规则共用一个命名空间。 |
| `collectIds` | 函数 | 把节点、区域、规则里的全部 id 按出现顺序收进 out；不是对象的值跳过。 |
| `descendantsOf` | 函数 | 节点自身及全部后代。 |
| `findNode` | 函数 | 按 id 查节点；找不到返回 `undefined`。 |
| `findRegion` | 函数 | 按 id 查区域；找不到返回 `undefined`。 |
| `FoundNode` | 接口 | 节点的查找结果。 |
| `FoundRegion` | 接口 | 区域的查找结果：所在容器、容器链与区域下标。 |
| `NodeLocation` | 接口 | 节点在树里的位置：所在区域（文档顶层为 `null`）与下标。 |
| `NodeVisitor` | 类型 | 访问函数返回 `false` 时不再进入该节点的子节点。 |
| `VisitContext` | 接口 | 遍历时传给访问函数的上下文。 |
| `walkNodes` | 函数 | 按文档顺序深度优先访问全部节点。 |

### validate-document

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `validateDocument` | 函数 | 校验文档：输入可以是任意值（如反序列化的 JSON），逐项核对后返回全部问题，没有问题时返回空数组。 |
| `ValidateDocumentOptions` | 接口 | schema 自校验的选项。 |

### validate-values

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `validateValues` | 函数 | 按声明式规则校验表单值，返回全部问题。 |
| `ValidateValuesOptions` | 接口 | 值校验的选项。 |
| `ValueIssue` | 接口 | 值校验的问题：在表单问题之上带着实例路径与规则里作者写的提示。 |
