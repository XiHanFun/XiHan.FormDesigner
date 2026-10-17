# 校验与联动

校验与联动都是写在模板里的规则：字段与容器的 `validation` 是校验规则，`linkage` 是联动规则。需要计算的地方写成受限表达式，表达式只能读表单数据与宿主给的变量，不能执行任何代码。

## 校验规则

| `kind` | 不通过的情况 | 规则里的字段 |
| --- | --- | --- |
| `required` | 值为空：`null`、只含空白的字符串、空数组，或元素全为空的数组；`false` 与 `0` 不算空 | — |
| `accepted` | 值不是 `true`，用于「必须勾选同意」，只适用于布尔值字段 | — |
| `length` | 字符串的字数或数组的元素个数不在 `[min, max]` 里；字数按用户看到的字计，一个表情算一个 | `min`、`max`，至少给一个 |
| `range` | 数值不在 `[min, max]` 里 | `min`、`max`，至少给一个 |
| `pattern` | 整串不匹配正则 | `pattern`（不带两边的斜杠）、`flags`（只允许 `i`、`m`、`s`、`u`） |
| `expression` | 表达式的结果是 `false`；`true` 与 `null` 都算通过 | `expression`，`$value` 是字段自己的值 |

每条规则都有 `id`，在所在规则列表里唯一；`message` 可省，写了就是不通过时给用户看的提示，不写时用渲染器按问题码给的缺省文案，见[问题码](../reference/issues#value)。每个种类适用哪些规则见[种类与属性](../reference/kinds)，写了不适用的规则时模板自检报 `rule.notApplicable`。

校验的约定：

- 值为空时只看 `required` 与 `accepted`，其余规则跳过，「选填但填了就要合规」不必另写条件。
- 隐藏或禁用的字段不校验，连同被隐藏、禁用的容器里的全部字段；只读的字段照常校验。
- 列表容器（子表单、子表）自己的规则针对整份列表：`required` 表示至少一行，`length` 按行数计；行里的字段各按各的规则校验。

<<< @/examples/templates/expense.ts#rules

## 什么时候校验

- 一个字段第一次校验的时机由渲染器的 `validateOn` 决定：缺省 `blur` 是离开字段时，`change` 是改值时，`submit` 是提交时。校验过的字段此后随改值重算。
- 提交时校验全部字段。没通过时派发 `invalid`，焦点移到第一个出问题的字段，表单上方列出错误摘要；通过时派发 `submit`。
- 宿主也可以随时调用 `validate()` 校验全部字段、`validateField(path)` 校验一个字段，两者都返回 `{ valid, issues }`，不派发提交事件。

## 联动规则

联动规则按条件改变节点的状态，或给字段赋值：

| `action` | 条件成立时 | 适用于 |
| --- | --- | --- |
| `show` / `hide` | 显示 / 隐藏 | 字段、容器、静态元素 |
| `enable` / `disable` | 可用 / 禁用 | 字段、容器 |
| `require` / `optional` | 必填 / 不必填 | 字段 |
| `assign` | 把 `value` 表达式的结果赋给字段 | 字段 |

`when` 是条件，结果为 `true` 时成立；不写表示总是成立。条件不成立时节点回到模板里的静态设定：`basic.hidden`、`basic.disabled`、`basic.readOnly`，以及有没有 `required` 规则。

按类型显示、按条件必填：

<<< @/examples/templates/expense.ts#show

联动的约定：

- 每个节点从静态设定出发，按文档顺序依次执行条件成立的规则，同一状态有多条规则成立时排在后面的生效。
- 赋值立即生效，后面的表达式读到的是新值；赋值引起的连锁变化会重算到稳定为止，仍不稳定时渲染器派发 `linkage-error`。
- 隐藏与禁用向下叠加：容器隐藏了，里面的节点都隐藏。
- 被隐藏的字段保留它的值，重新显示时还在；提交时交出的数据不含隐藏字段的值。
- `require` 让没有 `required` 规则的字段变成必填，提示用缺省文案；`optional` 让有 `required` 规则的字段暂时不必填。

## 表达式

表达式是 [XiHan.UI 的受限表达式](https://ui.docs.xihanfun.com/runtime/expression)：有四则运算、比较、`&&`、`||`、`!`、条件运算 `?:`，以及逻辑、数学、聚合、文本与日期函数，不能调用宿主代码以外的任何东西。数字按十进制计算，`0.1 + 0.2 == 0.3` 成立。

表达式里能用的名字：

| 名字 | 是什么 |
| --- | --- |
| 顶层的数据键 | 表单数据顶层的值，如 `type`、`total`；列表容器的键是行的数组，如 `items` |
| `$value` | 字段或列表容器自己的值 |
| `$row` | 列表里的节点所在的那一行，如 `$row.qty` |
| `$index` | 列表里的节点所在的行号，从 0 起 |
| `$` 开头的宿主变量 | 渲染器 `variables` 属性给的值，如 `$limit` |

`a.b` 在 `a` 是数组时逐行取字段，聚合函数会把数组展开，所以 `SUM(items.amount)` 就是明细各行小计之和。值为 `null` 时运算大多得到 `null`，条件是 `null` 时不成立。

行里的小计与表单的合计都用赋值算出：

<<< @/examples/templates/expense.ts#row

<<< @/examples/templates/expense.ts#total

合计超过宿主给的限额时，事由变成必填。限额经渲染器的 `variables` 传入，名字以 `$` 开头：

<<< @/examples/templates/expense.ts#variables

<<< @/examples/demos/expense.ts#render

模板自检会检查每条表达式：写错语法、用了不认识的名字或函数，都报 `expression.invalid`。宿主变量要告诉自检：`validateDocument(schema, { expressionEngine, identifiers: ['$limit'] })`。

## 示例

切到「差旅」，出差城市出现并变成必填；改数量或单价，小计与合计跟着变；合计超过 5000 时事由变成必填。直接提交，下方列出没通过的规则。

<FormDemo name="expense" />
