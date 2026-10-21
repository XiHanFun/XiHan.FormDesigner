来源：https://form.docs.xihanfun.com/reference/issues

# 问题码

<!-- 本页由 docs/scripts/gen-reference.mjs 从源码生成，不要手改；源码变了之后在 docs/ 运行 pnpm gen。 -->

问题都不带文案，只有问题码、定位与参数；下表的说明来自中文语言包 `formZhCN`，其中的 {名} 是参数。

## 模板问题 {#schema}

模板问题由 `validateDocument` 与设计器的问题列表给出，缺省都是错误级，`severity` 选项可以按问题码改为警告或去掉；有错误级问题的模板，渲染器不渲染、派发 `schema-error`。

一条模板结构问题：路径从文档根算起，节点、区域、规则用 target 标出（kind 为 node、region、rule）。问题码除了 FormSchemaIssueCode，还有扩展给出的：扩展规则的问题码以「扩展 id 末段.」开头，扩展登记的编辑方式由它自己的 check 给出。

### 通用问题码

属性值与结构的通用检查，各款设计器共用。

| 问题码 | 设计器里的说明 | 参数 |
| --- | --- | --- |
| `required` | 缺少必填的值 | — |
| `invalid-type` | 取值类型不对 | — |
| `invalid-value` | 取值无效 | — |
| `out-of-range` | 取值超出范围 | — |
| `not-integer` | 必须是整数 | — |
| `invalid-option` | 不是可选的值 | — |
| `invalid-color` | 颜色无效 | — |
| `empty` | 不能为空 | — |
| `unknown-key` | 未定义的属性 | — |
| `duplicate-key` | 数据键 {key} 重复 | `key` |
| `duplicate-id` | id {id} 重复 | `id` |
| `duplicate-value` | 选项的值重复 | — |
| `unknown-control` | 没有登记这种编辑方式 | — |

### 表单问题码

模板结构问题里表单专属的问题码（通用问题码见 designer-kit/schema 的 CommonIssueCode）：
- `document.unsupportedVersion`：结构版本不受支持；`document.tooDeep`：嵌套层数超过上限。
- `node.unknownKind` / `node.kindTypeMismatch`：种类没有登记 / 登记的类型与节点类型不符。
- `region.childNotAllowed`：区域不收这种节点（如子表只收字段）。
- `table.cellOutOfBounds` / `table.cellOverlap` / `table.cellGap`：表格布局的单元格越界、重叠、留空。
- `rule.notApplicable`：校验规则不适用于字段的种类或值形状；`rule.boundsMissing`：长度或范围规则上下限都没给；`rule.invalidRange`：下限大于上限；`rule.invalidPattern`：正则编译不过，参数 reason 给出原因。
- `linkage.actionNotApplicable`：联动动作不适用于节点类型。
- `expression.invalid`：表达式引擎报出问题，参数带上引擎的问题码与源码区间。
- `field.dependencyWithoutSource`：声明了选项依赖却没有选项来源；`field.unknownDependency`：依赖的键在所在作用域及其外层都找不到；`field.selfDependency`：依赖指向字段自己。

| 问题码 | 设计器里的说明 | 参数 |
| --- | --- | --- |
| `document.unsupportedVersion` | 不支持的模板版本 {version} | `version` |
| `document.tooDeep` | 嵌套超过 {max} 层 | `max` |
| `node.unknownKind` | 未登记的种类 {kind} | `kind` |
| `node.kindTypeMismatch` | 种类 {kind} 与节点类型不符 | `kind` |
| `region.childNotAllowed` | 这里不能放{kind} | `kind` |
| `table.cellOutOfBounds` | 单元格超出表格 | — |
| `table.cellOverlap` | 单元格与其它单元格重叠 | — |
| `table.cellGap` | 表格第 … 行第 … 列空着 | `row`、`column` |
| `rule.notApplicable` | {kind}规则不适用于这个字段 | `kind` |
| `rule.boundsMissing` | 最小值、最大值至少给一个 | — |
| `rule.invalidRange` | 最小值大于最大值 | — |
| `rule.invalidPattern` | 正则表达式无效 | — |
| `linkage.actionNotApplicable` | 「{action}」不适用于这里 | `action` |
| `expression.invalid` | 表达式有误 | — |
| `field.dependencyWithoutSource` | 声明了选项依赖，但没有选项来源 | — |
| `field.unknownDependency` | 找不到依赖的字段 {key} | `key` |
| `field.selfDependency` | 字段不能依赖自己 | — |

## 值问题 {#value}

值问题由 `validateValues`、控制器与渲染器的校验给出，落在字段上，渲染器把文案写在字段下方并汇总到错误摘要。规则写了 `message` 时显示它，否则用下表的缺省文案。

值校验与联动的问题码：
- `XH_FORM_VALUE_REQUIRED`、`XH_FORM_VALUE_NOT_ACCEPTED`、`XH_FORM_VALUE_TOO_SHORT`、`XH_FORM_VALUE_TOO_LONG`、`XH_FORM_VALUE_TOO_SMALL`、`XH_FORM_VALUE_TOO_LARGE`、`XH_FORM_VALUE_PATTERN_MISMATCH`、`XH_FORM_VALUE_EXPRESSION_FALSE`：值不满足规则。
- `XH_FORM_VALUE_TYPE_MISMATCH`：值的形状与字段不符，规则无法判定。
- `XH_FORM_INVALID_PATTERN`：校验时正则编译不过。
- `XH_FORM_EXPRESSION_FAILED`：求值失败；`XH_FORM_CONDITION_NOT_BOOLEAN`：条件结果不是布尔或 null。

| 问题码 | 渲染器里的缺省文案 | 参数 |
| --- | --- | --- |
| `XH_FORM_VALUE_REQUIRED` | 此项必填 | — |
| `XH_FORM_VALUE_NOT_ACCEPTED` | 请勾选此项 | — |
| `XH_FORM_VALUE_TOO_SHORT` | 至少输入 {min} 个字符 | `min` |
| `XH_FORM_VALUE_TOO_LONG` | 最多输入 {max} 个字符 | `max` |
| `XH_FORM_VALUE_TOO_SMALL` | 不能小于 {min} | `min` |
| `XH_FORM_VALUE_TOO_LARGE` | 不能大于 {max} | `max` |
| `XH_FORM_VALUE_PATTERN_MISMATCH` | 格式不正确 | — |
| `XH_FORM_VALUE_EXPRESSION_FALSE` | 取值不符合要求 | — |
| `XH_FORM_VALUE_TYPE_MISMATCH` | 取值类型不正确 | — |
| `XH_FORM_INVALID_PATTERN` | 校验用的正则表达式无效 | — |
| `XH_FORM_EXPRESSION_FAILED` | 校验表达式求值失败 | — |
| `XH_FORM_CONDITION_NOT_BOOLEAN` | 校验表达式的结果不是真或假 | — |

## 运行时错误 {#runtime}

运行时错误码：
- `XH_FORM_RT_INVALID_DOCUMENT`：文档没通过 schema 自校验（有 error 级问题），全部问题在 `issues`。
- `XH_FORM_RT_NO_ENGINE`：文档里有表达式，却没有提供表达式引擎。
- `XH_FORM_RT_UNKNOWN_NODE` / `XH_FORM_RT_UNKNOWN_PATH`：节点 id 或数据路径找不到。
- `XH_FORM_RT_INVALID_VALUE`：值的形状与字段不符。
- `XH_FORM_RT_NOT_A_LIST`：路径指向的不是列表容器。
- `XH_FORM_RT_INDEX_OUT_OF_RANGE`：行号越界。
- `XH_FORM_RT_NO_OPTIONS`：目标不是选项类字段。
- `XH_FORM_RT_NO_OPTION_LOADER`：字段有选项来源，却没有提供选项加载函数。
- `XH_FORM_RT_NO_OPTION_SOURCE`：按搜索串或父节点加载选项，但字段没有选项来源（静态选项）。
- `XH_FORM_RT_INVALID_OPTIONS`：加载函数为某个父节点返回的子项不符合字段的选项形状。
- `XH_FORM_RT_DISPOSED`：控制器已经销毁。
- `XH_FORM_RT_NOT_READY`：渲染器还没有可用的控制器（没给模板，或模板无效）。
- `XH_FORM_RT_NO_RENDERER`：渲染器找不到某个种类的渲染方式，`data.kind` 是种类名。

`FormRuntimeError` 的 `code` 是上面的错误码之一，`data` 带定位数据，模板无效时 `issues` 是全部模板问题。
