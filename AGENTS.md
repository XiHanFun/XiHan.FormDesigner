# AGENTS.md

本文件约束在 XiHan.FormDesigner 仓库内工作的 AI Agent。回答和提交说明使用中文；代码标识、公开 API 与标准术语保持英文。

## 仓库概览

XiHan.FormDesigner 是框架无关的表单设计器，以原生 Web Components 交付，任何前端项目都能使用。本仓库是开源版（MIT），必须能独立安装、构建和使用，不接收依赖私有包的代码。

### 技术栈

| 技术 | 要求 | 用途 |
| --- | --- | --- |
| Node.js | 24+ | 脚本、构建与测试 |
| pnpm | 11+ | 工作区包管理 |
| TypeScript | 6.x | 类型与源码 |
| tsdown | 0.22 | 库打包（ESM only） |
| Vitest | 4.x | 单元测试 |
| Web Components | Light DOM | 对外交付形态 |
| ESLint + oxlint | @antfu/eslint-config | Lint |

## 目录结构

```text
/
├─ AGENTS.md
├─ CLAUDE.md -> AGENTS.md         # Claude Code 仓库指令入口
├─ .github/ .gitee/ .gitcode/     # 三平台 Issue / PR 模板，GitHub 另有 CI
├─ docs/                           # 产品文档站（VitePress，独立的 pnpm 项目）
└─ form/                           # pnpm monorepo 根
   ├─ packages/
   │  ├─ core/                    # @xihan-form/core：模型层，纯 TS，不碰 DOM
   │  ├─ runtime/                 # @xihan-form/runtime：业务页面用的运行时元素
   │  └─ designer/                # @xihan-form/designer：设计器元素
   └─ playground/                 # @xihan-form/playground：开发预览页（private，不发布）
```

仓库根没有 package.json，库命令在 `form/` 执行，文档站命令在 `docs/` 执行。

## 常用命令（`form/`）

| 任务 | 命令 |
| --- | --- |
| 安装 | `pnpm install --frozen-lockfile` |
| 开发预览 | `pnpm dev`（http://localhost:5192） |
| 构建 | `pnpm build` |
| 类型检查 | `pnpm typecheck` |
| 单测 | `pnpm test` |
| Lint | `pnpm lint` |

`pnpm build` 按依赖拓扑依次构建 core、runtime、designer。runtime 与 designer 经包的 `exports` 读取上游 dist，改了上游先重建再验证下游。

开发预览页在 `form/playground`，用 Vite 起在 5192 端口（strictPort）：页面分渲染器与设计器两页：渲染器页是一张示例报销单，演示排布、联动、校验、异步与级联选项、只读与禁用和中文语言包；设计器页用同一张报销单演示画布、选择、键盘编辑、撤销重做与预览宽度。
它直接引用各包的源码，改了源码即时生效，不必先 `pnpm build`；`@xihan-ui/*` 经 overrides 读同级 XiHan.UI 的产物，启动前先在 `XiHan.UI/ui` 构建依赖的包：

```bash
# XiHan.UI/ui
pnpm --filter "@xihan-ui/web-components..." --filter "@xihan-ui/designer-kit..." --filter "@xihan-ui/designer-shell..." --filter "@xihan-ui/expression..." --filter "@xihan-ui/icons..." --filter "@xihan-ui/styles..." build
# XiHan.FormDesigner/form
pnpm dev
```

这是开发预览，不是产品：页面只用 UI 的令牌、皮肤与元素，不另写一套样式，也不进任何发布物。

## 文档站（`docs/`）

产品文档站用 VitePress 加组织统一主题 `@xihanfun/vitepress-theme`，做法与打印设计器的文档站一致。

| 任务 | 命令（在 `docs/`） |
| --- | --- |
| 安装 | `pnpm install --frozen-lockfile` |
| 开发 | `pnpm dev` |
| 构建 | `pnpm build`（站内死链会让构建失败） |
| 重新生成参考页 | `pnpm gen`；`pnpm gate:gen` 只比对、不写文件 |
| 示例类型检查 | `pnpm typecheck` |
| 示例模板自检 | `pnpm check:examples` |
| Lint | `pnpm lint` |

- 表单三个包经 `link:` 读 `form/packages/*` 的产物，先在 `form/` 构建；`@xihan-ui/*` 与 `form/` 工作区一样经 overrides 读同级 XiHan.UI 的产物，UI 5.0.0 正式发布后删掉那一段。
- `docs/reference/` 由 `scripts/gen-reference.mjs` 从源码生成（内置种类的属性描述与缺省值、`formZhCN`、TypeScript 源码注释），不手改。改了种类、属性、问题码、公开 API 或这些注释，在 `docs/` 跑 `pnpm gen` 并随改动一起提交；参考页的说明不对，就改源码注释。
- 正文里的 TypeScript 示例都放在 `examples/`，用 `<<< @/examples/…#片段` 引入，不在 Markdown 里另写一份：`templates/` 下导出 `schema` 与 `values` 的模板由 `check:examples` 自检并按模板校验示例数据，`demos/` 下的 `.ts` 导出 `mount(host)`、页面上写 `<FormDemo name="…" />` 真实运行，`snippets/` 只做类型检查。
- 站点自己的导航、侧栏与示例组件放在 `docs/.vitepress/`，不复制或改写主题已提供的样式。
- 正文里含 `{{` 的行内代码写成 `<code v-pre>…</code>`，否则会被 Vue 当成插值吃掉，构建也不报错。
- 文档只写已经做完的能力；不写种类数、组件数与依赖的具体版本号，不写预发布阶段的铺垫。
- 站点地址是 https://form.docs.xihanfun.com：`docs/public/CNAME`、`docs/public/.nojekyll` 与 `.github/workflows/deploy-docs.yml`（main 上 `docs/` 或 `form/` 有变更时先装好并构建 `form/`，再构建文档站，部署到 gh-pages）属于站点契约，不因清理构建配置而删除；主题配置的 `llms.site` 与 `docs/package.json` 的 `homepage` 写同一个地址。`form/` 的 overrides 生效期间这条流水线跑不通，与不推送远端的约定一致。

## 分层与依赖

- 依赖方向固定为 `designer → runtime → core`，不得反向引用。
- core 只做模型：schema 类型、校验、编辑命令与算法。tsconfig 不含 DOM 类型库，不得触碰 DOM。
- runtime 是业务页面使用的元素，体积敏感；设计器专用的代码不进 runtime。
- 所有包源码不得 import 任何前端框架（ESLint 已拦截）。
- 运行时依赖只允许 `@xihan-form/*` 与 `@xihan-ui/*`；引入任何其他依赖之前先征得维护者同意。

## 硬性约定

- **模板即数据**：模板是纯 JSON，禁止 `eval`、`new Function`、动态插入脚本和把用户内容拼进 `innerHTML`。需要计算的地方用受限的表达式解析，不执行字符串代码。
- **无全局状态**：不往 `window` 上挂对象，不读写固定键名的 localStorage，不在模块顶层产生副作用；同一页面放多个实例互不影响。
- **数据由使用方提供**：组件不发网络请求，数据、存储与权限都经回调或属性交给使用方。
- **对外契约**：复杂数据走 property 不走 attribute；事件用 `CustomEvent`；公开方法、事件和属性都要有类型声明。
- **命名（四款设计器统一）**：元素名一律 `xh-form-*`，渲染器是 `<xh-form-renderer>`；表单模板的属性叫 `schema`；表达式引擎叫 `expressionEngine`，格式化叫 `formatter`；事件名照 XiHan.UI 的写法，不带前缀、用短横线，如 `value-change`。内建文案按产品出一份语言包 `formZhCN`（`@xihan-form/runtime/locale`，渲染器与设计器共用），宿主用 `mergeXhConfig` 与 UI 的语言包合并，类型经 `XhTranslationOverrides` 的模块扩充补进去。
- **样式**：Light DOM，样式只消费 `@xihan-ui` 设计令牌，不写颜色、间距、圆角等散值。
- **注释**：只写代码做什么，不写为什么这样设计、也不写任何参考项目名称；设计理由写进提交说明。
- **源码文件头**：

```ts
/*
 * Copyright (c) 2021-Present XiHanFun and contributors.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */
```

## 分支与 worktree

- 主检出上的日常改动直接提交到 `dev`；`main` 只接收发版。
- 开 worktree 时分支按用途分组：`feat/<名>`、`fix/<名>`、`issue/<编号>`、`pr/<编号>-review`；工具生成的 `claude/<名>` 等分支在首次提交前改名。
- worktree 分支的合并、推送、PR 以及删除，只在用户明确要求时执行。

## Git 与提交

- 保留用户已有和无关改动；不要 reset、checkout 或清理它们。
- 使用 Conventional Commits：`<type>(<scope>): <中文说明>`，scope 取 `core`、`runtime`、`designer`、`docs`、`repo`。
- 一项完整功能一个提交；改 `form/` 的提交前跑 `pnpm lint`、`pnpm build`、`pnpm typecheck`、`pnpm test`，改 `docs/` 的在 `docs/` 跑 `pnpm gate:gen`、`pnpm check:examples`、`pnpm lint`、`pnpm typecheck`、`pnpm build`，都要过 `git diff --check`。
- 不推送、不发布、不创建远程 PR，除非用户明确要求。

## 禁止事项

- 不凭记忆猜 `@xihan-ui` 的 API、部件、事件或令牌，先查 XiHan.UI 源码或文档。
- 不复制其他项目的源码；参考他人设计只学思路。
- 不添加静默兜底和推测性兼容。
- 不通过放宽 Lint 或类型检查掩盖实现问题。
