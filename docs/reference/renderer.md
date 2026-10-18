# 渲染器

<!-- 本页由 docs/scripts/gen-reference.mjs 从源码生成，不要手改；源码变了之后在 docs/ 运行 pnpm gen。 -->

`@xihan-form/runtime` 的公开接口：渲染器元素、表单控制器与相关类型。样式在 `@xihan-form/runtime/style.css`，语言包在 `@xihan-form/runtime/locale`。

## `<xh-form-renderer>`

注册 &lt;xh-form-renderer&gt; 与内置字段、容器用到的库内元素；重复调用不报错。宿主自定义字段渲染器用到的元素由宿主注册。

### 属性

| 属性 | attribute | 类型 | 说明 |
| --- | --- | --- | --- |
| `schema` | — | `FormDocument \| undefined` | 表单模板。 |
| `expressionEngine` | — | `ExpressionEngine \| undefined` | 表达式引擎，缺省为 @xihan-ui/expression 的 createExpressionEngine()。 |
| `values` | — | `Readonly<Record<string, JsonValue>> \| undefined` | 初始数据兼 reset 与 isDirty 的基准；控制器建好后再赋值等于 setFormData(values, { baseline: true })，与当前值相同时不动。 |
| `variables` | — | `Readonly<Record<string, unknown>> \| undefined` | 宿主提供给表达式的变量，名字以 `$` 开头。 |
| `loadOptions` | — | `OptionLoader \| undefined` | 选项加载函数。 |
| `uploadFile` | — | `FileUploader \| undefined` | 文件字段的上传函数，交给 xh-file-upload 的 upload；组件自己不发请求。 |
| `readonly` | `readonly` | `boolean \| undefined` | 整表只读：仍可提交。attribute 按三态读：没写或写 "false" 不生效，其余写法生效。 |
| `disabled` | `disabled` | `boolean \| undefined` | 整表禁用：不能提交。attribute 按三态读：没写或写 "false" 不生效，其余写法生效。 |
| `validateOn` | `validate-on` | `FormValidateOn \| undefined` | 单字段首次校验的时机，缺省 `blur`；校验过的字段此后随改值重算。 |
| `submitAction` | — | `FormSubmitAction \| undefined` | 提交通过校验后调用的异步动作。 |
| `translations` | — | `Partial<FormRendererTranslations> \| undefined` | 元素自己的文案，压在全局配置之上。 |

### 存取器

| 属性 | 读写 | 类型 | 说明 |
| --- | --- | --- | --- |
| `extensions` | 可读写 | `readonly FormRuntimeExtension[] \| undefined` | 扩展：种类、渲染、编辑方式与规则都从这里来，内置扩展自动排在最前；与设计器、validateDocument 的 extensions 是同一份。赋值时当场合并查重，冲突抛 DesignerExtensionError、什么都不变；换了就重建控制器。同一个扩展对象换了引用也算换了，宿主要保持引用稳定。 |
| `controller` | 只读 | `FormController \| null` | 当前的表单控制器；没给模板或模板无效时为 `null`。模板等属性一变就换一个新的，见 `ready` 事件。 |

### 方法

| 方法 | 说明 |
| --- | --- |
| `getFormData(options?: GetFormDataOptions): Record<string, JsonValue>` | 当前表单值的副本。 |
| `setFormData(data: Readonly<Record<string, JsonValue>>, options?: SetFormDataOptions): void` | 按模板替换全部绑定值，见控制器的 setFormData。 |
| `getValue(path: JsonPath): JsonValue \| undefined` | 按数据路径读值的副本。 |
| `setValue(path: JsonPath, value: JsonValue): void` | 写一个字段或列表容器的值。 |
| `validate(): ValidationOutcome` | 校验全部字段并显示问题。 |
| `validateField(path: JsonPath): ValidationOutcome` | 校验一个字段或列表容器并显示它的问题。 |
| `reset(): void` | 回到基准值并清空校验状态。 |
| `isDirty(): boolean` | 当前值与基准值是否不同。 |
| `submit(): void` | 走一次提交：与回车、提交键同一条路径；结果看 `submit` / `invalid` 事件。 |
| `focusField(target: string \| JsonPath): boolean` | 让一个字段获得焦点；target 是节点 id 或数据路径。字段不存在时返回 false。 |

### 事件

事件都是冒泡的 `CustomEvent`。

| 事件 | detail | 说明 |
| --- | --- | --- |
| `ready` | `{ controller: FormController }` | 按模板建好控制器、渲染出表单时派发；换了模板、扩展、表达式引擎或选项加载函数后重建，再派发一次。 |
| `schema-error` | `{ code: FormRuntimeErrorCode, data: Readonly<Record<string, string \| number>>, issues: readonly FormSchemaIssue[] }` | 模板没通过自检或缺少表达式引擎，表单不渲染；`issues` 是全部模板问题。 |
| `value-change` | `{ paths: readonly JsonPath[], values: Record<string, JsonValue> }` | 表单值变了：用户输入、联动赋值、增删行或宿主赋值；`paths` 是变化的数据路径，`values` 是变化后的整份数据。 |
| `issues-change` | `{ paths: readonly JsonPath[], issues: readonly ValueIssue[] }` | 字段的校验问题变了；`paths` 是问题有变化的数据路径，`issues` 是当前全部问题。 |
| `submit` | `{ values: Record<string, JsonValue> }` | 提交通过了校验；`values` 不含隐藏字段的值。 |
| `invalid` | `{ issues: readonly ValueIssue[], values: Record<string, JsonValue> }` | 提交没通过校验，焦点已移到第一个出问题的字段；`issues` 是全部问题。 |
| `submit-error` | `{ cause: unknown, values: Record<string, JsonValue> }` | `submitAction` 返回的 thenable 失败了；`cause` 是失败的原因。 |
| `linkage-error` | `{ issues: readonly LinkageIssue[] }` | 联动规则求值出了问题，或多轮重算后仍不稳定；问题有变化时派发。 |

### FormValidateOn {#formvalidateon}

单字段首次校验的时机。

```ts
type FormValidateOn = 'submit' | 'blur' | 'change'
```

### FormSubmitAction {#formsubmitaction}

提交通过校验后调用的异步动作；返回的 thenable 落定前表单处于提交中。

```ts
type FormSubmitAction = (detail: { readonly values: Record<string, JsonValue> }) => PromiseLike<unknown> | void
```

## 表单控制器

### createFormController() {#createformcontroller}

```ts
declare function createFormController(options: FormControllerOptions): FormController
```

创建表单控制器。创建时先做 schema 自校验，有 error 级问题就抛 `XH_FORM_RT_INVALID_DOCUMENT`（问题列表在 `issues`）；文档里有表达式却没有引擎时抛 `XH_FORM_RT_NO_ENGINE`。不碰 DOM，不写全局状态，多个实例互不影响。

### FormControllerOptions {#formcontrolleroptions}

创建表单控制器的选项。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `document` | `FormDocument` | 表单模板。 |
| `extensions?` | `readonly FormCoreExtension[]` | 种类、编辑方式与规则从这组扩展来，内置扩展自动排在最前；与渲染器的 extensions 是同一份。 |
| `expressionEngine?` | `ExpressionEngine` | 表达式引擎；文档里有表达式时必须提供。 |
| `variables?` | `Readonly<Record<string, unknown>>` | 宿主提供给表达式的额外变量，名字以 `$` 开头。 |
| `values?` | `Readonly<Record<string, JsonValue>>` | 初始数据，叠在 schema 的初始值之上；也是 `reset` 与 `isDirty` 最初的基准。 |
| `loadOptions?` | `OptionLoader` | 选项加载函数；有字段带选项来源时，`reloadOptions` 需要它。 |

### FormController {#formcontroller}

表单控制器。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `document` | `FormDocument` | 创建时传入的表单模板。 |

| 方法 | 说明 |
| --- | --- |
| `getFormData(options?: GetFormDataOptions): Record<string, JsonValue>` | 当前表单值的副本，已含联动赋值。 |
| `getValue(path: JsonPath): JsonValue \| undefined` | 按数据路径读值的副本；不存在时为 `undefined`。 |
| `setFormData(data: Readonly<Record<string, JsonValue>>, options?: SetFormDataOptions): void` | 按 schema 替换全部绑定值：没给的回到初始值，多带的键原样保留；同时清空校验状态。`baseline` 为 `true` 时，填入的值同时成为 `reset` 与 `isDirty` 的基准。 |
| `setValue(path: JsonPath, value: JsonValue): void` | 写一个字段或列表容器的值；形状不符时抛错。值确实变了时，依赖它的选项字段回到空值，并逐级带上依赖这些字段的字段。 |
| `getState(target: FormTarget): NodeState \| undefined` | 节点实例的状态；节点 id 只取顶层实例，列表里的实例用实例键或数据路径。 |
| `getIssues(): readonly ValueIssue[]` | 当前展示的校验问题。 |
| `getLinkageIssues(): readonly LinkageIssue[]` | 最近一次联动重算的问题。 |
| `validate(): ValidationOutcome` | 校验全部字段，隐藏或禁用的实例跳过、值保留；此后每次改值都会重算问题。 |
| `validateField(path: JsonPath): ValidationOutcome` | 校验一个字段或列表容器（含此刻各行里的字段）；此后它们的问题随改值重算，之后新增的行不算在内。 |
| `reset(): void` | 回到基准值并清空校验状态；宿主的强制设定与已加载的选项保留。基准是创建时的值，或最近一次带 `baseline` 填入的值。 |
| `isDirty(): boolean` | 当前值与 `reset` 之后的值是否不同。 |
| `setHidden(target: FormTarget, hidden: boolean \| null): void` | 强制隐藏、禁用、只读：`true` / `false` 强制，`null` 撤销强制。 |
| `setDisabled(target: FormTarget, disabled: boolean \| null): void` | 强制禁用：`true` / `false` 强制，`null` 撤销强制。 |
| `setReadOnly(target: FormTarget, readOnly: boolean \| null): void` | 强制只读：`true` / `false` 强制，`null` 撤销强制。 |
| `addRow(listPath: JsonPath, options?: AddRowOptions): void` | 列表容器的行：新增、删除、移动。行级的强制设定、选项与校验进度跟着行走。 |
| `removeRow(listPath: JsonPath, index: number): void` | 删掉列表容器的第 `index` 行（从 0 起）。 |
| `moveRow(listPath: JsonPath, from: number, to: number): void` | 把列表容器的第 `from` 行移到第 `to` 行（从 0 起）。 |
| `reloadOptions(target?: FormTarget): Promise<void>` | 重新加载选项：不给目标时加载全部带选项来源的字段实例。提供了加载函数时，选项依赖的值一变（改值、整份替换、重置、联动赋值），依赖它的字段实例会自动重新加载。 |
| `searchOptions(target: FormTarget, query: string): Promise<void>` | 带搜索串重新加载一个字段实例的选项：请求的 `query` 即这个串，之后因依赖值变化的自动重载也带着它。只用于带选项来源的字段；连续调用时只认最后一次的结果。 |
| `loadChildren(target: FormTarget, parent: string): Promise<readonly OptionItem[]>` | 懒加载选项树里某个节点的直接子项：请求带上 `parent`，返回校验过的子项，不写进字段的选项状态。字段没有选项来源时报 `XH_FORM_RT_NO_OPTION_SOURCE`，返回的子项形状不对时报 `XH_FORM_RT_INVALID_OPTIONS`。 |
| `getOptions(target: FormTarget): OptionsState` | 字段实例的选项：带选项来源时是加载状态，否则是 schema 里的静态选项。 |
| `setVariables(variables: Readonly<Record<string, unknown>>): void` | 替换宿主变量并重算联动。 |
| `subscribe(listener: (event: FormEvent) => void): () => void` | 订阅变更，返回取消函数。 |
| `dispose(): void` | 销毁：取消全部订阅，之后调用任何方法都抛错，晚到的选项结果被丢弃。 |

### ValidationOutcome {#validationoutcome}

校验结果。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `valid` | `boolean` | 没有问题。 |
| `issues` | `readonly ValueIssue[]` | 校验出的问题。 |

### GetFormDataOptions {#getformdataoptions}

读取表单数据的选项。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `omitHidden?` | `boolean` | 为 `true` 时去掉隐藏实例的值（含被隐藏容器里的字段与整个被隐藏的列表）。 |

### SetFormDataOptions {#setformdataoptions}

替换表单数据的选项。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `baseline?` | `boolean` | 为 `true` 时，填入的值同时成为 `reset` 与 `isDirty` 的基准。 |

### AddRowOptions {#addrowoptions}

新增行的选项。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `index?` | `number` | 插入位置，缺省追加到末尾。 |
| `values?` | `Readonly<Record<string, JsonValue>>` | 新行的数据，缺的键取 schema 初始值。 |

## 选项与上传

### OptionLoader {#optionloader}

宿主提供的选项加载函数，返回选项数组或它的 Promise。

```ts
type OptionLoader = (request: OptionRequest) => readonly OptionItem[] | Promise<readonly OptionItem[]>
```

### OptionRequest {#optionrequest}

交给宿主加载函数的请求。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `source` | `string` | 字段的 `data.optionSource`。 |
| `nodeId` | `string` | 字段节点的 id。 |
| `path` | `JsonPath` | 字段实例的数据路径。 |
| `values` | `Readonly<Record<string, JsonValue>>` | 当前表单值的副本。 |
| `query?` | `string` | 搜索串：可输入筛选的字段（组合框）在输入时带上，宿主按它返回匹配的选项；没有输入过时不带。 |
| `parent?` | `string` | 懒加载：要取直接子项的那个节点的值，宿主只返回它的子项；取整棵（顶层）时不带。 |

### OptionItem {#optionitem}

一个选项；树形选项可带 `children`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `value` | `string` | 选中后写进表单数据的值。 |
| `label` | `string` | 显示的文字。 |
| `disabled?` | `boolean` | 禁用：显示但不能选。 |
| `children?` | `readonly OptionItem[]` | 子项，只有树形选项（级联、树选择）用。 |
| `hasChildren?` | `boolean` | 选项树里有子项但还没给出：首次展开时经 `parent` 再请求一次它的直接子项。 |

### OptionsState {#optionsstate}

一个字段实例的选项状态。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `status` | `'idle' \| 'loading' \| 'ready' \| 'error'` | 加载状态：没加载过、加载中、已就绪、失败。静态选项总是 `ready`。 |
| `items` | `readonly OptionItem[]` | 当前的选项；加载中时是上一次的结果，失败时为空。 |

### FileUploader {#fileuploader}

宿主提供的上传函数：返回带 `id` 的结果时，这个文件转成附件记录写进字段值。

```ts
type FileUploader = (request: UploadRequest) => FileUploadResult | undefined | void | Promise<FileUploadResult | undefined | void>
```

### UploadRequest {#uploadrequest}

交给宿主上传函数的请求：UI 的单个文件上传请求，加上所属字段。

继承 `FileUploadRequest`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `target` | `string \| undefined` | 字段的 `data.uploadTarget`。 |
| `nodeId` | `string` | 字段节点的 id。 |
| `path` | `JsonPath` | 字段实例的数据路径。 |

## 扩展

### FormRuntimeExtension {#formruntimeextension}

表单运行时层的扩展：core 层的全部字段，加上各种类的渲染，键是种类名。列表容器（子表单、子表）由渲染器自己按 xh-field-array 建，不经 containerRenderers。

继承 `FormCoreExtension`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `fieldRenderers?` | `Readonly<Record<string, FieldRenderer>>` | 字段种类的渲染方式：种类名 → 字段渲染器。 |
| `containerRenderers?` | `Readonly<Record<string, ContainerBuilder>>` | 容器种类的部件树：种类名 → 建出容器元素与各区域放子节点的位置。 |
| `staticRenderers?` | `Readonly<Record<string, StaticBuilder>>` | 静态元素种类的部件树：种类名 → 建出静态元素。 |

### FieldRenderer {#fieldrenderer}

字段渲染器：按种类登记，渲染器为每个字段实例调用一次。

```ts
type FieldRenderer = (context: FieldRendererContext) => FieldRendererInstance
```

### FieldRendererContext {#fieldrenderercontext}

交给字段渲染器的上下文。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `document` | `Document` | 渲染器所在的文档，建节点用。 |
| `node` | `FieldNode` | 字段节点。 |
| `path` | `JsonPath` | 字段实例的数据路径。 |
| `value` | `JsonValue \| undefined` | 字段当前的值。 |
| `state` | `NodeState` | 联动状态与整表的只读、禁用合并后的结果。 |
| `error` | `string \| undefined` | 当前展示的错误文案；没有错误时为 `undefined`。 |
| `options` | `OptionsState \| undefined` | 选项类字段的选项状态，其余为 `undefined`。 |
| `searchOptions` | `((query: string) => void) \| undefined` | 带搜索串重新加载本字段的选项，结果经 `options` 回来；字段没有选项来源或宿主没给 `loadOptions` 时为 `undefined`。 |
| `reloadOptions` | `(() => void) \| undefined` | 重新加载本字段的选项（如取数失败后重试），结果经 `options` 回来；字段没有选项来源或宿主没给 `loadOptions` 时为 `undefined`。 |
| `loadChildren` | `((parent: string) => Promise<readonly OptionItem[]>) \| undefined` | 懒加载选项树里某个节点的直接子项；字段没有选项来源或宿主没给 `loadOptions` 时为 `undefined`。 |
| `size` | `FieldSize` | 控件尺寸：字段自己的 `appearance.size`，没写时取表单设置的 `size`。 |
| `translations` | `FormRendererTranslations` | 渲染器当前的文案。 |
| `uploadFile` | `((request: FileUploadRequest) => ReturnType<FileUploader>) \| undefined` | 上传一个文件，请求里已带上本字段；宿主没给 `uploadFile` 时为 `undefined`。 |

| 方法 | 说明 |
| --- | --- |
| `setValue(value: JsonValue): void` | 写值，交给控制器的 setValue；值的形状由种类登记的 valueKind 把关，不符时抛 `XH_FORM_RT_INVALID_VALUE`。 |
| `commit(): void` | 一次编辑结束（如失焦）。 |

### FieldRendererInstance {#fieldrendererinstance}

字段渲染器产出的实例。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `element` | `HTMLElement` | 控件节点：作为 `<xh-field>` 的 control 部件放进字段外壳，标签、提示与错误文案由外壳给出，不必自带。 |

| 方法 | 说明 |
| --- | --- |
| `update(context: FieldRendererContext): void` | 值、状态、错误或选项变化时调用。 |
| `destroy(): void` | 节点移除前调用。 |

## 文案

### FormRendererTranslations {#formrenderertranslations}

渲染器的文案：无参的是字符串，带参的是函数。

文案键是 `xh-form-renderer`，各语言的文案在 `@xihan-form/runtime/locale`，如中文的 `formZhCN`。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `optionsEmpty` | `string` | 没有选项。 |
| `addRow` | `string` | 列表容器的新增把手。 |
| `fileDropzone` | `string` | 文件字段投放区的说明。 |
| `valueRequired` | `string` | 值校验问题的文案，按问题码取：`XH_FORM_VALUE_REQUIRED`。规则写了 message 时用规则的。 |
| `valueNotAccepted` | `string` | `XH_FORM_VALUE_NOT_ACCEPTED`。 |
| `valuePatternMismatch` | `string` | `XH_FORM_VALUE_PATTERN_MISMATCH`。 |
| `valueExpressionFalse` | `string` | `XH_FORM_VALUE_EXPRESSION_FALSE`。 |
| `valueTypeMismatch` | `string` | `XH_FORM_VALUE_TYPE_MISMATCH`。 |
| `invalidPattern` | `string` | `XH_FORM_INVALID_PATTERN`。 |
| `expressionFailed` | `string` | `XH_FORM_EXPRESSION_FAILED`。 |
| `conditionNotBoolean` | `string` | `XH_FORM_CONDITION_NOT_BOOLEAN`。 |

| 方法 | 说明 |
| --- | --- |
| `errorSummary(count: number): string` | 错误摘要的标题。 |
| `errorSummaryItem(label: string, message: string): string` | 错误摘要里的一条：字段标签与问题文案。 |
| `valueTooShort(min: number): string` | `XH_FORM_VALUE_TOO_SHORT`，参数是长度下限。 |
| `valueTooLong(max: number): string` | `XH_FORM_VALUE_TOO_LONG`，参数是长度上限。 |
| `valueTooSmall(min: number): string` | `XH_FORM_VALUE_TOO_SMALL`，参数是下限。 |
| `valueTooLarge(max: number): string` | `XH_FORM_VALUE_TOO_LARGE`，参数是上限。 |

## 全部导出

### designer-translations

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `DEFAULT_FORM_DESIGNER_TRANSLATIONS` | 常量 | 表单设计器的缺省文案。 |
| `FormDesignerTranslations` | 接口 | 表单设计器的文案：无参的是字符串，带参的是函数。 |

### extensions

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `createFormRuntimeModel` | 函数 | 合出运行时模型：core 的合并查重见 `createFormModel`，内置渲染 `FORM_RUNTIME_EXTENSION` 排在传入的之前；同一种类的渲染登记了两次时抛 `DesignerExtensionError`。 |
| `FORM_RUNTIME_EXTENSION` | 常量 | 运行时层的内置扩展：内置种类的渲染。 |
| `FormRuntimeExtension` | 接口 | 表单运行时层的扩展：core 层的全部字段，加上各种类的渲染，键是种类名。 |
| `FormRuntimeModel` | 接口 | 一组运行时扩展合出的模型：core 模型加上按种类名查的三张渲染表。 |

### renderer/containers

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `ContainerBuilder` | 类型 | 按种类建容器节点。 |
| `ContainerView` | 接口 | 容器的节点：宿主元素与每个区域放子节点的位置。 |
| `StaticBuilder` | 类型 | 按种类建静态元素节点。 |
| `StaticView` | 接口 | 静态元素的节点。 |

### renderer/element

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `defineFormRenderer` | 函数 | 注册 &lt;xh-form-renderer&gt; 与内置字段、容器用到的库内元素；重复调用不报错。 |
| `FORM_RENDERER_TAG` | 常量 | 渲染器的标签名。 |
| `FormRendererEventMap` | 接口 | 渲染器派发的事件。 |
| `FormSubmitAction` | 类型 | 提交通过校验后调用的异步动作；返回的 thenable 落定前表单处于提交中。 |
| `FormValidateOn` | 类型 | 单字段首次校验的时机。 |
| `XhFormRenderer` | 类 | `<xh-form-renderer>`：按表单模板渲染出表单，取值、赋值、校验、重置与提交都经它的方法；选项加载与附件上传经回调交给宿主，组件自己不发请求。 |

### renderer/fields/index

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `FORM_FIELD_RENDERERS` | 常量 | 内置字段种类的渲染器。 |

### renderer/types

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `FieldRenderer` | 类型 | 字段渲染器：按种类登记，渲染器为每个字段实例调用一次。 |
| `FieldRendererContext` | 接口 | 交给字段渲染器的上下文。 |
| `FieldRendererInstance` | 接口 | 字段渲染器产出的实例。 |
| `FieldSize` | 类型 | 字段的尺寸档。 |
| `FileUploader` | 类型 | 宿主提供的上传函数：返回带 `id` 的结果时，这个文件转成附件记录写进字段值。 |
| `UploadRequest` | 接口 | 交给宿主上传函数的请求：UI 的单个文件上传请求，加上所属字段。 |

### state/controller

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `AddRowOptions` | 接口 | 新增行的选项。 |
| `createFormController` | 函数 | 创建表单控制器。 |
| `FormController` | 接口 | 表单控制器。 |
| `FormControllerOptions` | 接口 | 创建表单控制器的选项。 |
| `FormEvent` | 类型 | 变更通知，带着变化范围： |
| `FormEventType` | 类型 | 变更通知的种类。 |
| `FormTarget` | 类型 | 寻址：字符串是节点 id 或实例键（节点 id 后接 `#` 与逐层行号，即 states 通知里的键），数组是数据路径。 |
| `GetFormDataOptions` | 接口 | 读取表单数据的选项。 |
| `LinkageIssue` | 类型 | 联动问题：表达式求值的问题，或联动多轮重算后仍不稳定。 |
| `SetFormDataOptions` | 接口 | 替换表单数据的选项。 |
| `ValidationOutcome` | 接口 | 校验结果。 |

### state/errors

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `FormRuntimeError` | 类 | 运行时错误；`message` 就是错误码。 |
| `FormRuntimeErrorCode` | 类型 | 运行时错误码： |

### state/options

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `OptionItem` | 接口 | 一个选项；树形选项可带 `children`。 |
| `OptionLoader` | 类型 | 宿主提供的选项加载函数，返回选项数组或它的 Promise。 |
| `OptionRequest` | 接口 | 交给宿主加载函数的请求。 |
| `OptionsState` | 接口 | 一个字段实例的选项状态。 |

### translations

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `DEFAULT_FORM_RENDERER_TRANSLATIONS` | 常量 | 渲染器的缺省文案。 |
| `FormRendererTranslations` | 接口 | 渲染器的文案：无参的是字符串，带参的是函数。 |

## `@xihan-form/runtime/locale` 的导出

### locale

| 名称 | 种类 | 说明 |
| --- | --- | --- |
| `formDeDE` | 常量 | 德语：渲染器、设计器与 designer-shell 零件。 |
| `formEnUS` | 常量 | 英语：渲染器、设计器与 designer-shell 零件。 |
| `formEsES` | 常量 | 西班牙语：渲染器、设计器与 designer-shell 零件。 |
| `formFrFR` | 常量 | 法语：渲染器、设计器与 designer-shell 零件。 |
| `formJaJP` | 常量 | 日语：渲染器、设计器与 designer-shell 零件。 |
| `formKoKR` | 常量 | 韩语：渲染器、设计器与 designer-shell 零件。 |
| `formPtBR` | 常量 | 葡萄牙语（巴西）：渲染器、设计器与 designer-shell 零件。 |
| `formRuRU` | 常量 | 俄语：渲染器、设计器与 designer-shell 零件。 |
| `formZhCN` | 常量 | 简体中文：渲染器、设计器与 designer-shell 零件。 |
| `formZhTW` | 常量 | 繁体中文（台湾）：渲染器、设计器与 designer-shell 零件。 |
