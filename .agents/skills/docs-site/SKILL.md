---
name: xihan-form-docs-site
description: 改 XiHan.FormDesigner 文档站 docs/ 时使用：正文页、导航与侧栏、参考页生成（gen-reference）、examples 示例与 FormDemo、机读资产 llms.txt、更新日志页与文档站门禁。适用于“改文档”“加一页”“参考页不对”“示例跑不起来”“llms.txt”；组件行为本身的改动用 designer-development。
---

# XiHan.FormDesigner 文档站

站点是 VitePress 加组织主题 `@xihanfun/vitepress-theme`（npm 正式包），地址 https://form.docs.xihanfun.com 。命令都在 `docs/` 执行；表单三个包经 `link:` 读 `form/packages/*` 的 dist，先在 `form/` 跑 `pnpm build`。

## 页面与配置

- 正文：`introduction.md`、`quickstart.md`、`guide/`、`ai/`、`changelog.md`；导航、侧栏与机读资产的配置都在 `.vitepress/config.ts`。导航「指南」下拉与侧栏要一起改，跨站链接写完整地址。
- `reference/` 由 `scripts/gen-reference.mjs` 从源码生成（内置种类与属性、`formZhCN` 的文案、TypeScript 源码注释），不手改；参考页说得不对就改源码注释，再 `pnpm gen`。
- 主题已有的样式与组件（含每页的「取本页 Markdown」）不在站点里复制或改写；站点自己的只放 `.vitepress/theme/` 里的 `FormDemo.vue` 与 `demo.css`。
- 表单包要的 `@xihan-ui/*` 由 `docs/package.json` 装唯一的一份，`config.ts` 的 `vite.resolve.dedupe` 名单让 `link:` 进来的包也解析到这一份，否则页面上两份 UI、界面语言对不上。表单包多依赖一个 `@xihan-ui/*` 时两处一起补。
- 只写已经做完的能力；不写种类数、组件数与依赖的具体版本号，不写预发布阶段的铺垫。正文里含 `{{` 的行内代码写成 `<code v-pre>…</code>`。

## 示例

正文里的 TypeScript 都放在 `examples/`，用 `<<< @/examples/…#片段` 引入，不在 Markdown 里另写一份：

| 目录 | 用法 | 检查 |
| --- | --- | --- |
| `templates/` | 导出 `schema` 与 `values` 的模板 | `pnpm check:examples` 自检模板并按模板校验示例数据 |
| `demos/` | 导出 `mount(host)`，页面写 `<FormDemo name="…" />` 真实运行 | `pnpm typecheck` |
| `snippets/`、`extensions/` | 只引入片段 | `pnpm typecheck` |

## 机读资产

`config.ts` 的 `llms` 配置在构建时产出 `llms.txt`、`llms-full.txt`、`llms-guide.txt`、`llms-reference.txt` 与每页的 `.md`；`transform` 把 `<<<` 片段内联成代码块、去掉示例舞台。新开一个目录时在 `llms.sections`（必要时 `bundles`）里登记。构建后到 `.vitepress/dist/` 确认这几份文件都在。

## 门禁

```bash
pnpm gate:gen
pnpm check:examples
pnpm lint
pnpm typecheck
pnpm build
```

再在仓库根跑 `git diff --check`。站内死链会让构建失败。`docs/public/CNAME`、`.nojekyll` 与 `.github/workflows/deploy-docs.yml` 是站点契约，不因清理而删；部署由 `deploy-docs.yml` 做（main 上 `docs/` 或 `form/` 有变更时、Release 发完包后），只部署已经发布的版本，文档改动进 main 的规矩见 `AGENTS.md`「发版」。只改文档时不必跑 `form/` 的全量门禁，但改了源码注释或公开 API 要连 `pnpm gen` 与 `form/` 的门禁一起跑。
