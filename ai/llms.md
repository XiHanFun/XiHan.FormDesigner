来源：https://form.docs.xihanfun.com/ai/llms

# LLMs.txt

文档站在构建时产出一组给大语言模型读的机读资产，内容与站点正文同源。AI 工具读取它们即可了解表单设计器的模板结构、元素、API 与用法。

## 可用资源

| 文件 | 说明 |
| --- | --- |
| [llms.txt](https://form.docs.xihanfun.com/llms.txt) | 索引：全部页面的标题、一句话摘要与地址，以及下列资产的入口 |
| [llms-full.txt](https://form.docs.xihanfun.com/llms-full.txt) | 全站正文，正文引用的示例源码已内联 |
| [llms-guide.txt](https://form.docs.xihanfun.com/llms-guide.txt) | 指南：模板结构、校验与联动、渲染器、设计器、扩展与宿主集成 |
| [llms-reference.txt](https://form.docs.xihanfun.com/llms-reference.txt) | 参考：种类与属性、模板类型、问题码，以及渲染器、设计器与 core 的公开接口 |

**单页 Markdown**：任何一页的站点地址后加 `.md` 即可取到这一页的 Markdown，如 [guide/template.md](https://form.docs.xihanfun.com/guide/template.md)、[reference/kinds.md](https://form.docs.xihanfun.com/reference/kinds.md)。每页正文上方的「取本页 Markdown」也指向它。

`llms-full.txt` 体积较大，多数场景读 `llms.txt` 索引后按需取单页，或只取 `llms-guide.txt`、`llms-reference.txt` 中的一份。

表单的控件、样式与语言包来自 XiHan.UI，它另有一套机读资产：

| 站点 | 索引 |
| --- | --- |
| 视图组件 | [ui.docs.xihanfun.com/llms.txt](https://ui.docs.xihanfun.com/llms.txt) |

## 在 AI 工具中使用

所有工具都可以用同一段提示词：

```text
阅读 https://form.docs.xihanfun.com/llms.txt 了解曦寒表单设计器，写表单相关代码时按需读取其中列出的页面（站点地址后加 .md 取 Markdown）；用到 XiHan.UI 的组件、令牌或语言包时再读 https://ui.docs.xihanfun.com/llms.txt。以文档为准，不要凭记忆写元素、属性、事件与模板结构。
```

| 工具 | 做法 |
| --- | --- |
| Claude Code | 写进项目的 `CLAUDE.md`，或用 `/memory` 记下 |
| Cursor | 在对话中用 `@Docs` 添加 `https://form.docs.xihanfun.com/llms.txt`，或写进 `.cursor/rules` |
| Codex | 写进项目的 `AGENTS.md` |
| GitHub Copilot | 写进 `.github/copilot-instructions.md` |
| Windsurf | 写进 `.windsurf/rules` |

文档站上的资产对应最新发布的版本。表单没有自己的 MCP 服务端；用到 XiHan.UI 的部分，能接入 MCP 的工具可以用 [XiHan.UI 的 MCP Server](https://ui.docs.xihanfun.com/ai/mcp) 按项目装的版本查组件与令牌。

## 相关

- [For Agents](./agents) · [XiHan.UI 的 LLMs.txt](https://ui.docs.xihanfun.com/ai/llms)
