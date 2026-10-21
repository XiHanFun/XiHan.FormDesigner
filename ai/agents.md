来源：https://form.docs.xihanfun.com/ai/agents

# For Agents

给 Claude Code、Cursor、Codex、GitHub Copilot 这类 AI 编程工具的入口：在项目里用表单设计器时，怎样让 AI 写对接法；参与表单仓库开发时，AI 该读什么。

表单设计器没有单独的命令行或 MCP 服务端，AI 工具要的资料在两处：本站构建时产出的[机读文档](./llms)，以及仓库根的 `AGENTS.md`。表单用到的 XiHan.UI 另有自己的 [AI 辅助开发](https://ui.docs.xihanfun.com/ai/agents)资料。

## 复制这段提示词

把下面这段放进对话，或写进项目的 `AGENTS.md` / `CLAUDE.md` / `.cursor/rules`：

```text
这个项目用曦寒表单设计器（@xihan-form/*）设计表单模板、按模板渲染表单并校验提交的数据。
写代码前先读 https://form.docs.xihanfun.com/llms.txt，按需读取其中列出的页面（站点地址后加 .md 取 Markdown）。
元素、属性、事件、模板结构、种类与问题码以文档和项目里装的版本为准，不要凭记忆写，也不要套用别的表单组件的 API。
用到 XiHan.UI 的组件、设计令牌或语言包时，再读 https://ui.docs.xihanfun.com/llms.txt。
```

## 要装的包

| 用途 | 安装 | 注册 | 引入的样式 |
| --- | --- | --- | --- |
| 业务页面填表 | `pnpm add @xihan-form/runtime @xihan-ui/web-components @xihan-ui/styles` | `defineFormRenderer()` | `@xihan-ui/styles/index.css`、`@xihan-form/runtime/style.css` |
| 设计模板 | `pnpm add @xihan-form/designer @xihan-form/runtime @xihan-ui/styles @xihan-ui/designer-shell` | `defineFormDesigner()` | 上面两份，再加 `@xihan-ui/designer-shell/style.css`、`@xihan-form/designer/style.css` |
| 服务端或脚本里复核 | `pnpm add @xihan-form/core` | — | — |

`@xihan-form/runtime` 会带上 `@xihan-form/core`。代码里要 import `@xihan-form/core`（模板类型 `FormDocument`、`validateDocument`、`validateValues` 等）时，也把它写进项目的依赖。`@xihan-ui/*` 是表单各包的 peer 依赖，由项目装唯一的一份，与项目自己用的 XiHan.UI 同一个版本，页面上不会出现两份 UI；代码里直接 import 的 `@xihan-ui/*`（如设置界面语言用的 `@xihan-ui/web-components`）同样写进项目的依赖。

## 关键约定

把这几条一并告诉 AI，常见的错写多出在这里：

- **先注册再用**：元素不在 import 时注册，应用启动时调用一次 `defineFormRenderer()` 或 `defineFormDesigner()`，重复调用不报错；`defineFormDesigner()` 已经包含渲染器。
- **对象走属性**：模板、数据、扩展与回调这类对象交给元素的属性（如 `schema`、`values`、`extensions`、`loadOptions`、`uploadFile`），不写成 attribute。Vue 里用 `.prop` 修饰，并把 `xh-` 开头的标签声明为自定义元素，见[在前端框架里使用](../guide/host#在前端框架里使用)。
- **模板是纯 JSON**：模板是一份 `FormDocument`，不含函数与脚本；字段的 `key` 是表单数据的键，校验与联动的条件、取值写成受限表达式。保存前用设计器的 `validate()` 或 core 的 `validateDocument` 检查，问题码见[问题码](../reference/issues)。
- **宿主管保存、取数与权限**：组件不发网络请求。设计器每次修改派发 `schema-change`，保存命令派发 `save`，宿主存好后调用 `markSaved()`；渲染器的选项与附件经 `loadOptions`、`uploadFile` 回调，校验通过派发 `submit`、没通过派发 `invalid`。服务端用 `resolveLinkage` 求出联动状态后再交给 `validateValues` 复核，见[与宿主集成](../guide/host)。
- **扩展走 `extensions`**：种类、渲染方式、属性编辑器、模板规则、命令与面板都经 `extensions` 登记，只对这一个实例生效，不改包内源码，见[扩展](../guide/extensions)。
- **语言包合并后全局设置**：界面文字缺省是英文。语言包在 `@xihan-form/runtime/locale`，名字是 `form` 加 XiHan.UI 语言包的名字（`zhCN` 对 `formZhCN`），与 UI 同一语言的那份合并：`setXhConfig(mergeXhConfig(zhCN, formZhCN))`，见[快速开始](../quickstart#界面语言)。

## 参与表单仓库开发

仓库根的 `AGENTS.md` 是写给 AI 的仓库规范：

| 内容 | 说明 |
| --- | --- |
| 仓库概览与目录结构 | `form/` 是三个包与开发预览页的工作区，`docs/` 是本站 |
| 常用命令 | 构建、类型检查、单测、Lint、产物契约与冒烟，以及文档站的命令 |
| 文档站 | 参考页由源码生成、不手改，正文的示例放在 `examples/` 并经类型检查与模板自检 |
| 分层与依赖 | `designer → runtime → core`，core 不碰 DOM，运行时依赖只允许 `@xihan-form/*` 与 `@xihan-ui/*` |
| 硬性约定 | 模板即数据、无全局状态、数据由使用方提供、对外契约、命名与语言包、样式、注释 |
| 发版、分支、Git 与提交 | 各自的做法与禁止事项 |

`CLAUDE.md` 是指向 `AGENTS.md` 的链接，Claude Code 打开仓库即读到；Codex 直接读 `AGENTS.md`；Cursor、GitHub Copilot 等工具在各自的规则文件里写一句「先读仓库根的 AGENTS.md」即可。

## 相关

- [LLMs.txt](./llms) · [快速开始](../quickstart) · [与宿主集成](../guide/host)
- [XiHan.UI 的 AI 辅助开发](https://ui.docs.xihanfun.com/ai/agents)
