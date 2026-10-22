---
name: xihan-form-designer-development
description: 实现、重构、修复或测试 XiHan.FormDesigner 的 core、runtime 与 designer 时使用。覆盖模板 schema 与种类登记、渲染器 <xh-form-renderer> 与控制器、设计器 <xh-form-designer>、extensions 扩展点、语言包、复用 XiHan.UI 与提交门禁；只改规则与表达式读 rules-expression，只改文档站读 docs-site。
---

# XiHan.FormDesigner 开发

开始前读 `AGENTS.md`；写用例前读 `references/testing.md`。

## 落点

| 改什么 | 在哪 |
| --- | --- |
| 模板类型、`FORM_SCHEMA_VERSION` | `form/packages/core/src/schema.ts` |
| 内置种类与属性描述 | `core/src/registry/`（`builtin-fields.ts`、`builtin-containers.ts`、`properties.ts`） |
| 模板自检、问题码 | `core/src/validate-document.ts`、`core/src/issues.ts` |
| 取值校验、联动求值 | `core/src/validate-values.ts`、`core/src/linkage.ts`（规则写法见 rules-expression） |
| 编辑操作 | `core/src/operations.ts`、`table-commands.ts`、`copy.ts` |
| 渲染器元素与字段渲染 | `runtime/src/renderer/`（`element.ts`、`fields/`、`containers.ts`、`list.ts`） |
| 不经界面的控制器 | `runtime/src/state/controller.ts` |
| 语言包 | `runtime/src/locale/`，设计器文案的键在 `runtime/src/designer-translations.ts`、英文在 `designer-english.ts` |
| 设计器元素 | `designer/src/form-designer.ts`，画布、命令、面板、属性、规则、引导各一个文件 |
| 扩展点 | `core/src/extensions.ts` → `runtime/src/extensions.ts` → `designer/src/extensions.ts`，一层叠一层 |

## 边界

- 依赖方向 `designer → runtime → core`，不反向引用；core 不碰 DOM，runtime 体积敏感、不放设计器专用代码。
- 运行时依赖只允许 `@xihan-form/*` 与 `@xihan-ui/*`。UI 已有的组件、编码器、算法与格式化一律直接用；常用能力缺了先报给协调会话、在 XiHan.UI 补上，不在本仓另写。设计器外壳、菜单栏、设置对话框、面板与历史来自 `@xihan-ui/designer-shell`，共有的扩展形状来自 `@xihan-ui/designer-kit`。
- `@xihan-ui/*` 是 peer 依赖（`^5.1.0`）加 `devDependencies`（`catalog:`）；UI 的新能力要等 UI 发版、升 catalog 后才进得来。
- 模板是纯 JSON：不 `eval`、不 `new Function`、不把用户内容拼进 `innerHTML`；组件不发网络请求，选项与附件经 `loadOptions`、`uploadFile` 交给宿主；不往 `window` 挂东西、不用固定键名的 localStorage（设计器草稿按 `draftKey` 区分）。
- 新能力优先做成 `extensions` 的登记项，按实例生效；元素对外：复杂数据走 property，事件是 `CustomEvent`，名字照 UI 的写法（如 `value-change`）。
- 新文案：先加进 `designer-translations.ts`（或渲染器的 `translations.ts`）的类型与英文，再补 `locale/` 下每一种语言，少键多键都是类型错误。
- 改了种类、属性、问题码、公开 API 或源码注释，在 `docs/` 跑 `pnpm gen` 一起提交（见 docs-site）。
- 注释只写做什么；为什么写进提交说明。源码文件带 MIT 文件头。

## 门禁

先跑改动相关的用例（`pnpm --filter @xihan-form/<包> test`），再在 `form/` 全跑：

```bash
pnpm lint
pnpm build
pnpm typecheck
pnpm test
```

runtime 与 designer 经 `exports` 读上游 dist，改了上游先 `pnpm build` 再测下游。改了 `docs/` 同时跑文档站门禁；最后 `git diff --check`。各步退出码都是 0 才提交，一项完整功能一笔；使用者能感知的改动附变更集（`pnpm changeset`）。

开发预览：`form/` 下 `pnpm dev`（http://localhost:5192），直接引用源码。
