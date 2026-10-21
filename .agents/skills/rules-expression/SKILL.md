---
name: xihan-form-rules-expression
description: 改 XiHan.FormDesigner 的校验规则、联动规则、表达式的接入与求值作用域，或服务端复核写法时使用。适用于“加一种校验规则”“联动不生效”“表达式报错”“$row / 宿主变量”“服务端怎么复核”；表达式语言本身的语义归 XiHan.UI 的 @xihan-ui/expression，不在本仓改。
---

# XiHan.FormDesigner 规则与表达式

规则的使用者文档是 `docs/guide/validation.md`，问题码见 `docs/reference/issues.md`（由源码生成）。

## 规则在哪

- 规则的类型在 `form/packages/core/src/schema.ts`：校验 `required`、`accepted`、`length`、`range`、`pattern`、`expression`；联动 `show` / `hide`、`enable` / `disable`、`require` / `optional`、`assign`。
- 每个种类适用哪些校验规则在 `core/src/registry/builtin-fields.ts`（如布尔值字段只有 `required`、`accepted`、`expression`）；写了不适用的规则，模板自检报 `rule.notApplicable`。
- 自检在 `core/src/validate-document.ts`，取值校验在 `core/src/validate-values.ts`，联动在 `core/src/linkage.ts`，可引用的名字由 `core/src/bindings.ts` 从模板算出；设计器的规则页签在 `designer/src/rules.ts`、`rule-lists.ts`、`expression-editor.ts`。
- 加一种规则要一起改：类型、适用表、自检、取值校验、语言包里的缺省提示（每种语言）、设计器的规则编辑；`docs/` 跑 `pnpm gen` 更新参考页，附变更集。

## 表达式怎么接

- 模板里的表达式只存源码字符串。求值由宿主注入的引擎完成：`expressionEngine: createExpressionEngine()`（`@xihan-ui/expression`），core 只定义与 UI 同形状的 `ExpressionEngine` 类型，求值与条件判定调 UI 的 `evaluateSource`、`conditionOf`。
- 运行时变量是 `$value`、`$row`、`$index`（`core/src/expression.ts` 的 `RUNTIME_VARIABLES`）；宿主变量也以 `$` 开头，由渲染器的 `variables` 给；数据键不能以 `$` 开头。
- 自检要知道宿主变量：`validateDocument(schema, { expressionEngine, identifiers: ['$limit'] })`，写错语法或用了不认识的名字报 `expression.invalid`。
- 约定以 `docs/guide/validation.md` 为准：值为空时只看 `required` 与 `accepted`；隐藏或禁用的字段不校验；联动按文档顺序执行、后面的生效，`assign` 连锁重算到稳定，仍不稳定时渲染器派发 `linkage-error`；条件是 `null` 时不成立，`expression` 规则的结果是 `null` 算通过。

## 表达式语义归 UI

- 数字是十进制（`0.1 + 0.2 == 0.3`）、舍入、日期、空值与除以零等行为都由 `@xihan-ui/expression` 定，规格在 https://ui.docs.xihanfun.com/runtime/expression ，跨实现一致性用例在 XiHan.UI 的 `ui/packages/engine/expression/tests/fixtures/conformance.json`（.NET 复刻逐条比对）。
- 发现语义问题回 XiHan.UI 修，改语义要同时改一致性用例并写 UI 的变更集；本仓不另写一套求值，也不在本仓的用例里重测语义（用 `tests/fake-engine.ts` 的假引擎）。

## 服务端复核

core 不依赖 DOM，Node.js 里直接用：先 `resolveLinkage(schema, values, { expressionEngine, variables })` 求出联动状态，再 `validateValues(schema, linkage.values, { expressionEngine, states: linkage.states, variables })`。不求联动会漏掉按条件变成必填的字段、把隐藏字段也当成要校验；联动赋值的字段以重算出的值为准。写法见 `docs/examples/snippets/host.ts`。

门禁与提交同 `xihan-form-designer-development`。
