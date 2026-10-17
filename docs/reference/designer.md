# 设计器

<!-- 本页由 docs/scripts/gen-reference.mjs 从源码生成，不要手改；源码变了之后在 docs/ 运行 pnpm gen。 -->

`@xihan-form/designer` 的公开接口。样式在 `@xihan-form/designer/style.css`，还要同时引入 `@xihan-ui/designer-shell/style.css` 与 `@xihan-form/runtime/style.css`。

## `<xh-form-designer>`

注册 &lt;xh-form-designer&gt; 与它用到的全部元素：渲染器（画布与预览共用）及其库内元素、工具栏与菜单等库内元素、设计器零件；重复调用不报错。宿主自定义字段渲染器用到的元素由宿主注册。

### 属性

| 属性 | attribute | 类型 | 说明 |
| --- | --- | --- | --- |
| `expressionEngine` | — | `ExpressionEngine \| undefined` | 校验表达式与预览用，缺省为 createExpressionEngine()。 |
| `commandLayout` | — | `DesignerCommandLayout \| undefined` | 工具栏与右键菜单的排列：位置（toolbar、menu:node、menu:region、menu:cell、menu:blank）→ 若干组命令 id，内置命令与扩展命令混排。写了某个位置就只显示列出的；没写的位置用内置的缺省排列，再把 placement 含它的扩展命令追加成一组。 |
| `previewValues` | — | `Readonly<Record<string, JsonValue>> \| undefined` | 预览的示例数据。 |
| `loadOptions` | — | `OptionLoader \| undefined` | 预览的选项加载。 |
| `translations` | — | `Partial<FormDesignerTranslations> \| undefined` | 元素自己的文案，压在全局配置之上。 |
| `readonly` | `readonly` | `boolean \| undefined` | 可选择、浏览与预览，不能修改。 |
| `mode` | `mode` | `FormDesignerMode \| undefined` | 设计态或预览态，缺省 design。 |
| `previewWidth` | `preview-width` | `FormPreviewWidth \| undefined` | 预览宽度，缺省 full。 |
| `panels` | `panels` | `string \| undefined` | 空格分隔的 toolbar palette properties issues，缺省全部；画布常驻。 |

### 存取器

| 属性 | 读写 | 类型 | 说明 |
| --- | --- | --- | --- |
| `schema` | 可读写 | `FormDocument` | 当前模板；赋值即装载：清空历史与选择，赋回当前这一份不重新装载。 |
| `extensions` | 可读写 | `readonly FormDesignerExtension[] \| undefined` | 扩展：种类、渲染、属性编辑器、编辑方式、规则、命令与面板都从这里来，内置扩展自动排在最前；画布、预览与校验用同一份。赋值时当场合并查重，冲突抛 DesignerExtensionError、什么都不变；各扩展的 setup 在元素连上文档时调用、断开时清理。同一个扩展对象换了引用当作卸下再装上，宿主要保持引用稳定。 |
| `canUndo` | 只读 | `boolean` | 有可撤销的修改。 |
| `canRedo` | 只读 | `boolean` | 有可重做的修改。 |
| `canPaste` | 只读 | `boolean` | 内部剪贴板里有内容可粘贴。 |
| `dirty` | 只读 | `boolean` | 有没保存的修改：上次 `markSaved` 之后改过。 |

### 方法

| 方法 | 说明 |
| --- | --- |
| `execute(operations: readonly FormOperation[], options?: ExecuteOptions): FormDocument` | 执行一组操作并记为一步撤销；返回新模板。 |
| `undo(): boolean` | 撤销一步；没有可撤销的时返回 false。 |
| `redo(): boolean` | 重做一步；没有可重做的时返回 false。 |
| `markSaved(): void` | 把当前模板记为已保存：`dirty` 变为 false，并派发 `dirty-change`。 |
| `addNode(kind: string, target?: FormDropTarget): FormNode \| undefined` | 按种类新建节点并选中它；目标缺省为选中节点之后，没有选中时为末尾。目标不收时返回 undefined。 |
| `select(selection: Partial<FormSelection>): void` | 选中节点或区域：给了非空的 regions 就选区域，否则选 nodes。 |
| `getSelection(): FormSelection` | 当前的选择。 |
| `deleteSelection(): boolean` | 删除选中的节点或区域；只读或什么都没删时返回 false。 |
| `copy(): FormClipboard \| undefined` | 复制选中的节点，放进这个设计器的剪贴板并返回；没有选中时返回 undefined。 |
| `cut(): FormClipboard \| undefined` | 复制并删除选中的节点；只读或没有选中时返回 undefined。 |
| `paste(clipboard?: FormClipboard): FormSelection` | 粘贴：给了内容就粘贴它，否则粘贴最近一次复制或剪切的内容；返回新的选择。 |
| `duplicate(): FormSelection` | 复制选中节点并紧跟在原节点之后粘贴，不改动剪贴板；返回新的选择。 |
| `validate(): readonly FormSchemaIssue[]` | 检查模板结构，规则里的表达式用 expressionEngine 检查。 |
| `scrollToNode(id: string): void` | 滚动到节点：必要时先切到所在的标签页、展开所在的折叠项。 |
| `revealNode(id: string): void` | 节点不在可见区内时才滚动到它。 |

### 事件

事件都是冒泡的 `CustomEvent`。

| 事件 | detail | 说明 |
| --- | --- | --- |
| `schema-change` | `{ schema: FormDocument, operations: readonly FormOperation[], kind: FormSchemaChangeKind }` | 模板变了：执行操作、撤销、重做或换了 `schema`；`schema` 是变化后的模板，`operations` 是这一步实际应用的操作。 |
| `selection-change` | `FormSelection` | 选择变了。 |
| `dirty-change` | `{ dirty: boolean }` | 有没有未保存修改的状态变了。 |
| `issues-change` | `{ issues: readonly FormSchemaIssue[] }` | 模板问题变了；`issues` 是当前全部问题。 |
| `save` | `Record<string, never>` | 用户要保存：按了 Ctrl / ⌘ + S 或点了保存命令。保存由宿主做，存好后调用 `markSaved()`。 |
| `node-dblclick` | `{ id: string }` | 双击了画布上的节点。 |
| `node-contextmenu` | `{ id: string, x: number, y: number }` | 要在节点上打开右键菜单，`x`、`y` 是视口坐标；可取消，取消后不打开内建菜单。 |
| `blank-contextmenu` | `{ x: number, y: number }` | 要在画布空白处打开右键菜单；可取消，取消后不打开内建菜单。 |
| `mode-change` | `{ mode: FormDesignerMode }` | 在设计态与预览态之间切换了。 |

## 类型

### FormDesignerMode {#formdesignermode}

设计态或预览态。取值：`design`、`preview`。

### FormPreviewWidth {#formpreviewwidth}

预览宽度：全宽、平板、手机，设计态画布同样生效。取值：`full`、`tablet`、`phone`。

### FormDesignerPanel {#formdesignerpanel}

可收起的面板；画布常驻，不在其中。取值：`toolbar`、`palette`、`properties`、`issues`。

### FormSchemaChangeKind {#formschemachangekind}

schema-change 的来源。取值：`execute`、`undo`、`redo`、`load`。

### FormSelection {#formselection}

选择：选中的节点，或同一个容器里的区域（栅格的列、标签页、折叠项、表格单元格），二者互斥，按选中的先后。选中区域时 nodes 为空。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `nodes` | `readonly string[]` | 选中节点的 id。 |
| `regions?` | `readonly string[]` | 选中区域的 id，都在同一个容器里。 |

### FormDropTarget {#formdroptarget}

放置位置：区域 id（`null` 为文档顶层）与放在该区域现有子节点里的第几个之前，缺省放到末尾。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `parent` | `string \| null` | 区域 id；`null` 为文档顶层。 |
| `index?` | `number` | 放在该区域现有子节点里的第几个之前，从 0 起；缺省放到末尾。 |

### FormClipboard {#formclipboard}

剪贴板内容：被复制的节点，按文档顺序，不含被选中节点的后代里重复选中的那些。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `nodes` | `readonly FormNode[]` | 被复制的节点，粘贴时 id 全部换新。 |

## 扩展与命令

### FormDesignerExtension {#formdesignerextension}

表单设计器层的扩展：运行时层的全部字段，加上属性编辑器、命令、面板、导入导出与 setup。

其余成员见视图组件文档的 [designer-shell](https://ui.docs.xihanfun.com/runtime/designer-shell)。

继承 `FormRuntimeExtension`、`DesignerShellExtension<FormDesignerContext, FormPropertyEditor, FormDocument, FormRuleContext>`。

### FormDesignerContext {#formdesignercontext}

命令、面板与扩展装上时拿到的上下文。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `designer` | `XhFormDesigner` | 这个设计器实例。 |
| `translations` | `FormDesignerTranslations` | 此刻生效的设计器文案。 |

### FormDesignerCommand {#formdesignercommand}

设计器的命令。

```ts
type FormDesignerCommand = DesignerCommand<FormDesignerContext>
```

### FormMenuSubject {#formmenusubject}

右键菜单落在哪类对象上：节点、区域、表格布局的单元格，或空白处。取值：`node`、`region`、`cell`、`blank`。

## 文案

### FormDesignerTranslations {#formdesignertranslations}

表单设计器的文案：无参的是字符串，带参的是函数。

文案键是 `xh-form-designer`，中文在 `@xihan-form/runtime/locale` 的 `formZhCN` 里。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `label` | `string` | 设计器的可访问名。 |
| `toolbar` | `string` | 工具栏的可访问名。 |
| `canvas` | `string` | 画布的可访问名。 |
| `palette` | `string` | 物料面板的标题。 |
| `properties` | `string` | 属性面板的标题。 |
| `issues` | `string` | 问题列表的标题。 |
| `undo` | `string` | 撤销命令。 |
| `redo` | `string` | 重做命令。 |
| `cut` | `string` | 剪切命令。 |
| `copy` | `string` | 复制命令。 |
| `paste` | `string` | 粘贴命令。 |
| `duplicate` | `string` | 再制命令：复制并紧跟着粘贴。 |
| `delete` | `string` | 删除命令。 |
| `selectParent` | `string` | 选中上一级命令。 |
| `moveUp` | `string` | 上移命令。 |
| `moveDown` | `string` | 下移命令。 |
| `selectAll` | `string` | 全选命令。 |
| `save` | `string` | 保存命令。 |
| `clear` | `string` | 清空命令。 |
| `design` | `string` | 切到设计态。 |
| `preview` | `string` | 切到预览态。 |
| `previewWidth` | `string` | 预览宽度这组按钮的可访问名。 |
| `widthFull` | `string` | 全宽。 |
| `widthTablet` | `string` | 平板宽度。 |
| `widthPhone` | `string` | 手机宽度。 |
| `propertiesTab` | `string` | 属性区的「属性」页签。 |
| `validationTab` | `string` | 属性区的「校验」页签。 |
| `linkageTab` | `string` | 属性区的「联动」页签。 |
| `emptyCanvas` | `string` | 画布为空时的提示。 |
| `emptyRegion` | `string` | 区域为空时的提示。 |
| `settings` | `string` | 什么都没选时属性区的标题。 |
| `addRule` | `string` | 新增规则的按钮。 |
| `removeRule` | `string` | 删除规则的按钮。 |
| `ruleMessage` | `string` | 规则的「提示」输入框。 |
| `ruleWhen` | `string` | 联动规则的「条件」输入框。 |
| `ruleValue` | `string` | 联动赋值的「取值」输入框。 |
| `ruleMin` | `string` | 规则的「最小值」输入框。 |
| `ruleMax` | `string` | 规则的「最大值」输入框。 |
| `rulePattern` | `string` | 正则规则的「正则」输入框。 |
| `ruleFlags` | `string` | 正则规则的「标志」输入框。 |
| `ruleExpression` | `string` | 表达式规则的「表达式」输入框。 |
| `ruleAction` | `string` | 联动规则的「动作」选择框。 |
| `noRules` | `string` | 还没有规则时的提示。 |
| `variableValue` | `string` | 表达式补全里运行时变量 `$value` 的说明。 |
| `variableRow` | `string` | 表达式补全里运行时变量 `$row` 的说明。 |
| `variableIndex` | `string` | 表达式补全里运行时变量 `$index` 的说明。 |
| `mergeCells` | `string` | 表格布局右键菜单：合并单元格。 |
| `splitCell` | `string` | 表格布局右键菜单：拆分单元格。 |
| `insertRowAbove` | `string` | 表格布局右键菜单：在上方插入行。 |
| `insertRowBelow` | `string` | 表格布局右键菜单：在下方插入行。 |
| `insertColumnLeft` | `string` | 表格布局右键菜单：在左侧插入列。 |
| `insertColumnRight` | `string` | 表格布局右键菜单：在右侧插入列。 |
| `removeRow` | `string` | 表格布局右键菜单：删除行。 |
| `removeColumn` | `string` | 表格布局右键菜单：删除列。 |
| `sourceStructure` | `string` | 问题列表里结构问题的来源小标签。 |
| `sourceBinding` | `string` | 问题列表里数据绑定问题的来源小标签。 |

| 方法 | 说明 |
| --- | --- |
| `nodeTag(kind: string, key: string \| undefined): string` | 画布上选中节点的标签，如「单行文本 · name」。 |
| `category(category: string): string` | 物料分类名，按种类的 category。 |
| `kind(kind: string): string` | 种类名，按 kind。 |
| `group(group: string): string` | 属性分组名：basic / data / appearance / region / settings。 |
| `property(kind: string, group: string, name: string): string` | 属性名：先按「种类:分组.名」，再按「分组.名」，最后按名查。 |
| `option(name: string, value: string): string` | select 选项的文案，按属性名与选项值。 |
| `ruleKind(kind: string): string` | 校验规则种类名。 |
| `linkageAction(action: string): string` | 联动动作名。 |
| `unboundKey(key: string): string` | 数据键不在宿主数据模型里。 |
| `issue(issue: FormSchemaIssue): string` | 模板结构问题的说明，按问题码与参数；扩展给出的问题码先取扩展的 issueText，都没有时显示问题码本身。 |

## 编辑模型

设计器内部的编辑模型也一并导出，不显示界面、只想按操作改模板时可以直接用。创建表单编辑模型。

```ts
declare function createFormEditor(options: FormEditorOptions): FormEditor
```

### FormEditorOptions {#formeditoroptions}

创建编辑模型的选项。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `document` | `FormDocument` | 初始文档。 |
| `extensions?` | `readonly FormCoreExtension[]` | 种类、编辑方式与规则从这组扩展来，内置扩展自动排在最前；与设计器的 extensions 是同一份。 |
| `expressionEngine?` | `ExpressionEngine` | 校验时检查表达式用的引擎，不给时不检查表达式内容。 |
| `identifiers?` | `readonly string[]` | 宿主提供给表达式的额外顶层名字。 |
| `historyLimit?` | `number` | 撤销步数上限，缺省 100。 |
| `mergeWithin?` | `number` | 同一合并键相隔多少毫秒内并入上一步，缺省 1000。 |

| 方法 | 说明 |
| --- | --- |
| `now(): number` | 取当前时间（毫秒），合并相邻修改时用；缺省 `Date.now`。 |

### FormEditor {#formeditor}

表单编辑模型：当前文档、撤销历史与选择，以及各种编辑操作；不碰 DOM。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `document` | `FormDocument` | 当前文档。 |
| `registry` | `KindRegistry` | 按扩展合出的种类登记表。 |
| `history` | `History<FormDocument, FormOperation>` | 撤销历史：能否撤销、重做，是否有未保存的修改。 |
| `selection` | `FormSelection` | 当前的选择。 |

| 方法 | 说明 |
| --- | --- |
| `setExtensions(extensions: readonly FormCoreExtension[]): void` | 换一组扩展：之后新建、放置与校验都按它；冲突时抛 DesignerExtensionError、什么都不变。 |
| `load(document: FormDocument): void` | 装载新文档：清空历史与选择，剪贴板保留；文档变化的 cause 为 reset。 |
| `execute(operations: readonly FormOperation[], options?: ExecuteOptions): FormDocument` | 执行一组操作并记为一步撤销；返回新文档。 |
| `undo(): boolean` | 撤销一步；没有可撤销的时返回 false。 |
| `redo(): boolean` | 重做一步；没有可重做的时返回 false。 |
| `seal(): void` | 封口：此后带同一合并键的修改另起一步。 |
| `transact<T>(run: () => T, label?: string): T` | 把 run 里的全部修改合为一步撤销。 |
| `markSaved(): void` | 把当前文档记为已保存，此后 `history.dirty` 为 false，直到再改。 |
| `select(selection: Partial<FormSelection>, mode?: FormSelectMode): void` | 选中节点或区域：给了非空的 regions 就选区域（只留与第一个同一容器的），否则选 nodes。 |
| `clearSelection(): void` | 清空选择。 |
| `canDrop(nodeIds: readonly string[], target: FormDropTarget): boolean` | 节点能否放到目标位置：目标区域存在，不放进自己或自己的后代，目标区域收这种节点（如子表只收字段）。 |
| `canAdd(kind: string, target: FormDropTarget): boolean` | 种类能否新建到目标位置；种类未登记时为 false。 |
| `canPasteAt(clipboard: FormClipboard, target: FormDropTarget): boolean` | 一段剪贴板内容能否粘贴到目标位置：非空、目标区域收这些节点、种类都已登记。 |
| `addNode(kind: string, target?: FormDropTarget, options?: ExecuteOptions): FormNode \| undefined` | 按种类新建节点并选中它；目标缺省为选中节点之后，没有选中时为顶层末尾。种类未登记时抛错；目标不收时返回 undefined。 |
| `moveNodes(nodeIds: readonly string[], target: FormDropTarget, options?: ExecuteOptions): boolean` | 移动一组节点到目标位置，保持它们在文档里的先后；放不下时返回 false。 |
| `deleteSelection(options?: ExecuteOptions): boolean` | 删除选中的节点；选中区域时删除这些区域，删完要少于容器的区域下限或容器是表格布局时不删。什么都没删时返回 false。 |
| `setProperty(nodeId: string, group: PropertyGroup, name: string, value: JsonValue \| undefined, options?: ExecuteOptions): void` | 写节点的属性；value 为 undefined 时删除该属性。连续写同一属性合为一步，直到 seal。 |
| `setRegionProperty(regionId: string, name: string, value: JsonValue \| undefined, options?: ExecuteOptions): void` | 写区域的属性，合并规则同 setProperty。 |
| `setSetting(name: string, value: JsonValue \| undefined, options?: ExecuteOptions): void` | 写表单设置，合并规则同 setProperty。 |
| `setKey(nodeId: string, key: string, options?: ExecuteOptions): void` | 改数据键，合并规则同 setProperty。 |
| `addRule(nodeId: string, list: RuleList, rule: FormRuleInit \| Omit<LinkageRule, 'id'>, index?: number, options?: ExecuteOptions): ValidationRule \| LinkageRule` | 新增一条规则并返回它；index 缺省为末尾。 |
| `updateRule(nodeId: string, list: RuleList, rule: ValidationRule \| LinkageRule, options?: ExecuteOptions): void` | 整条替换规则，连续替换同一条规则合为一步。 |
| `removeRule(nodeId: string, list: RuleList, ruleId: string, options?: ExecuteOptions): void` | 删除一条规则。 |
| `moveRule(nodeId: string, list: RuleList, ruleId: string, index: number, options?: ExecuteOptions): void` | 把一条规则移到 index 处。 |
| `addRegion(containerId: string, index?: number, props?: Readonly<Record<string, JsonValue>>, options?: ExecuteOptions): Region` | 给容器新增一个区域并返回它；index 缺省为末尾，props 覆盖区域属性的缺省值。 |
| `removeRegion(regionId: string, options?: ExecuteOptions): void` | 删除一个区域，连同其中的节点。 |
| `moveRegion(regionId: string, index: number, options?: ExecuteOptions): void` | 把一个区域移到容器里的 index 处。 |
| `setGridSpan(regionId: string, span: number, options?: ExecuteOptions): void` | 设栅格区域的跨度：取整并夹在属性描述的上下限之间。 |
| `mergeCells(containerId: string, regionIds: readonly string[], options?: ExecuteOptions): void` | 合并表格布局的单元格，所选单元格须恰好拼成一个矩形。 |
| `splitCell(containerId: string, regionId: string, options?: ExecuteOptions): void` | 拆分表格布局的单元格。 |
| `insertTableLine(containerId: string, axis: TableAxis, at: number, options?: ExecuteOptions): void` | 在表格布局的第 at 行或列之前插入一行或一列。 |
| `removeTableLine(containerId: string, axis: TableAxis, at: number, options?: ExecuteOptions): void` | 删除表格布局的第 at 行或列。 |
| `copy(): FormClipboard \| undefined` | 复制选中的节点；没有选中时返回 undefined。 |
| `cut(options?: ExecuteOptions): FormClipboard \| undefined` | 复制并删除选中的节点。 |
| `paste(clipboard?: FormClipboard, target?: FormDropTarget, options?: ExecuteOptions): FormSelection` | 粘贴并选中粘贴出的节点：id 全部换新，与目标作用域冲突的数据键改为派生键。内容缺省为最近一次 copy 的，目标缺省为选中节点之后、没有选中时为顶层末尾；目标不收时什么都不做，返回空选择。 |
| `duplicate(options?: ExecuteOptions): FormSelection` | 复制选中节点并紧跟在原节点之后粘贴，不改动剪贴板。 |
| `validate(): readonly FormSchemaIssue[]` | 按当前登记表做 schema 自校验。 |
| `subscribe(listener: (change: FormEditorChange) => void): () => void` | 订阅文档与选择的变化，返回取消函数。 |

## 全部导出

### clipboard

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `checkFormClipboard` | 函数 | 检查一段剪贴板内容（如拖来的片段）：节点非空、结构合法、种类在内置种类与 extensions 里、id 不重复时原样返回，否则为 undefined。 |
| `decodeFormClipboard` | 函数 | 解析剪贴板文本：不是表单的剪贴板包、版本不认得时返回 undefined，内容按 checkFormClipboard 检查。 |
| `encodeFormClipboard` | 函数 | 把剪贴板内容序列化成剪贴板包的 JSON 文本。 |
| `readFormClipboard` | 函数 | 从剪贴板事件的数据里读出表单的剪贴板内容：先取表单自己的类型，没有再取 text/plain。 |
| `writeFormClipboard` | 函数 | 把剪贴板内容写进剪贴板事件的数据：表单自己的类型一份，text/plain 一份。 |

### commands

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `FORM_COMMANDS` | 常量 | 内置命令。 |
| `FORM_MENU_LAYOUTS` | 常量 | 右键菜单各主体的缺省排列；commandLayout 没写 menu:&lt;主体&gt; 时用它。 |
| `FORM_TOOLBAR_LAYOUT` | 常量 | 工具栏的缺省排列；commandLayout 没写 toolbar 时用它，再把 placement 含 toolbar 的扩展命令追加成一组。 |
| `FormDesignerCommand` | 类型 | 设计器的命令。 |
| `FormDesignerContext` | 接口 | 命令、面板与扩展装上时拿到的上下文。 |
| `FormMenuSubject` | 类型 | 右键菜单落在哪类对象上：节点、区域、表格布局的单元格，或空白处。 |

### editor

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `createFormEditor` | 函数 | 创建表单编辑模型。 |
| `FormClipboard` | 接口 | 剪贴板内容：被复制的节点，按文档顺序，不含被选中节点的后代里重复选中的那些。 |
| `FormDropTarget` | 接口 | 放置位置：区域 id（`null` 为文档顶层）与放在该区域现有子节点里的第几个之前，缺省放到末尾。 |
| `FormEditor` | 接口 | 表单编辑模型：当前文档、撤销历史与选择，以及各种编辑操作；不碰 DOM。 |
| `FormEditorChange` | 类型 | 编辑模型的变化：文档变化带上历史变化的种类与实际应用的操作；选择变化带上新的选择。 |
| `FormEditorOptions` | 接口 | 创建编辑模型的选项。 |
| `FormRuleInit` | 类型 | 校验规则或联动规则，不带 id；id 由编辑模型分配。 |
| `FormSelection` | 接口 | 选择：选中的节点，或同一个容器里的区域（栅格的列、标签页、折叠项、表格单元格），二者互斥，按选中的先后。 |
| `FormSelectMode` | 类型 | 选择方式：替换、追加或切换。 |

### extensions

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `createFormDesignerModel` | 函数 | 合出设计器用的模型；任何一处重名都抛 DesignerExtensionError。 |
| `FORM_DESIGNER_EXTENSION` | 常量 | 设计器的内置扩展：内置命令。 |
| `FormDesignerExtension` | 接口 | 表单设计器层的扩展：运行时层的全部字段，加上属性编辑器、命令、面板、导入导出与 setup。 |
| `FormDesignerModel` | 接口 | 一组设计器扩展合出的东西：运行时模型、命令表与属性编辑器表。 |

### form-designer

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `defineFormDesigner` | 函数 | 注册 &lt;xh-form-designer&gt; 与它用到的全部元素：渲染器（画布与预览共用）及其库内元素、工具栏与菜单等库内元素、设计器零件；重复调用不报错。 |
| `FORM_DESIGNER_TAG` | 常量 | 设计器的标签名。 |
| `FormDesignerEventMap` | 接口 | 设计器派发的事件。 |
| `FormDesignerMode` | 类型 | 设计态或预览态。 |
| `FormDesignerPanel` | 类型 | 可收起的面板；画布常驻，不在其中。 |
| `FormPreviewWidth` | 类型 | 预览宽度：全宽、平板、手机，设计态画布同样生效。 |
| `FormSchemaChangeKind` | 类型 | schema-change 的来源。 |
| `XhFormDesigner` | 类 | `<xh-form-designer>`：可视化编辑表单模板，物料、画布、属性与问题列表都在里面；模板的保存与权限交给宿主，经 `schema-change`、`save` 事件与 `markSaved()` 往来。 |

### palette

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `FormCanvasDragPayload` | 接口 | 从画布上拖动节点时的数据；owner 是发起拖动的设计器，只在同一个设计器里放下。 |
| `FormDragSubject` | 类型 | 拖来的东西：新建的种类、未经检查的片段，或本设计器画布上的节点。 |
| `FormFragmentDragPayload` | 接口 | 拖放片段：任意来源（如扩展的模板库面板）经 startDrag 交来的一段节点，松手时按粘贴的规则换 id 插入。 |
| `FormPalettePayload` | 类型 | 物料随 item-activate 与拖动交出的数据：新建某个种类，或插入一段片段（如模板库里的一组字段）。 |

### properties

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `FormPropertyEditor` | 类型 | 宿主的属性编辑器，经 `editors` 压在内建编辑器之上。 |
