<div align="center">

<h1>XiHan.FormDesigner</h1>

<h3>快速、轻量、高效、用心的框架无关表单设计器</h3>

<p>
  <a href="https://github.com/XiHanFun/XiHan.FormDesigner/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/XiHanFun/XiHan.FormDesigner/ci.yml?branch=dev&style=flat-square&label=CI" /></a>
  <a href="https://www.npmjs.com/package/@xihan-form/designer"><img alt="npm" src="https://img.shields.io/npm/v/@xihan-form/designer?style=flat-square&logo=npm&logoColor=white&color=cb3837" /></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/github/license/XiHanFun/XiHan.FormDesigner?style=flat-square&color=green" /></a>
  <a href="https://github.com/XiHanFun/XiHan.FormDesigner/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/XiHanFun/XiHan.FormDesigner?style=flat-square&logo=github&label=Stars&color=1f6feb" /></a>
  <a href="https://gitee.com/XiHanFun/XiHan.FormDesigner"><img alt="Gitee Stars" src="https://gitee.com/XiHanFun/XiHan.FormDesigner/badge/star.svg" /></a>
  <a href="https://gitcode.com/XiHanFun/XiHan.FormDesigner"><img alt="GitCode Stars" src="https://gitcode.com/XiHanFun/XiHan.FormDesigner/star/badge.svg" /></a>
</p>

<p>
  <a href="https://form.docs.xihanfun.com"><b>文档</b></a> ·
  <a href="#快速开始"><b>快速开始</b></a> ·
  <a href="https://form.docs.xihanfun.com/changelog"><b>更新日志</b></a>
</p>

<p><a href="./README.md">English</a> | <b>简体中文</b></p>

</div>

XiHan.FormDesigner 是框架无关的表单设计器，以 Web Components 交付，同一份 JSON 定义同时驱动设计器与业务页面的渲染，属曦寒懿（XiHanFun）开源生态。

## 特性

| 特性 | 说明 |
| --- | --- |
| 框架无关 | 原生 Web Components，适用于 Vue、React、Angular 与无框架页面 |
| 零第三方依赖 | 运行时不引入第三方包 |
| 模板即数据 | 模板为 JSON，不含也不执行代码 |
| 数据自主 | 组件不发网络请求，数据、存储与权限经回调交由使用方 |
| 定义复用 | 同一份 JSON 驱动设计、渲染、校验与联动 |

## 快速开始

```bash
pnpm add @xihan-form/runtime @xihan-ui/web-components @xihan-ui/styles
```

```ts
import { defineFormRenderer } from '@xihan-form/runtime'
import '@xihan-ui/styles/index.css'
import '@xihan-form/runtime/style.css'

defineFormRenderer()

const renderer = document.createElement('xh-form-renderer')
renderer.schema = schema
renderer.addEventListener('submit', (event) => save(event.detail.values))
document.body.append(renderer)
```

模板、校验与语言包的写法见[快速开始](https://form.docs.xihanfun.com/quickstart)。

## 包结构

| 包 | 说明 |
| --- | --- |
| `@xihan-form/core` | 模型层：表单 schema、校验规则、联动规则与编辑命令，不依赖 DOM |
| `@xihan-form/runtime` | 运行时：表单渲染、取值与校验 |
| `@xihan-form/designer` | 设计器：可视化表单设计 |

依赖方向为 `designer → runtime → core`，业务页面仅需 `runtime`。

## 本地开发

需 Node.js 24+ 与 pnpm 11+，开发预览页位于 `http://localhost:5192`。

```bash
cd form
pnpm install
pnpm dev
```

## 生态

| 项目 | 说明 |
| --- | --- |
| [XiHan.Framework](https://github.com/XiHanFun/XiHan.Framework) | .NET 微内核开发框架 |
| [XiHan.UI](https://github.com/XiHanFun/XiHan.UI) | 框架无关 Headless UI 组件库 |
| [XiHan.BasicApp](https://github.com/XiHanFun/XiHan.BasicApp) | 基于 XiHan.Framework 和 XiHan.UI 的超高颜值通用中后台内核 |
| [XiHan.FlowDesigner](https://github.com/XiHanFun/XiHan.FlowDesigner) | 框架无关流程设计器 |
| [XiHan.PrintDesigner](https://github.com/XiHanFun/XiHan.PrintDesigner) | 框架无关打印设计器 |
| [XiHan.ReportDesigner](https://github.com/XiHanFun/XiHan.ReportDesigner) | 框架无关报表设计器 |

## 文档

[渲染器](https://form.docs.xihanfun.com/guide/renderer) · [设计器](https://form.docs.xihanfun.com/guide/designer) · [模板结构](https://form.docs.xihanfun.com/guide/template) · [更新日志](https://form.docs.xihanfun.com/changelog)

## 参与

欢迎提交 [Issue](https://github.com/XiHanFun/XiHan.FormDesigner/issues) 与 Pull Request，提交遵循 Conventional Commits，改动须通过 CI 门禁。交流：QQ 群 [462371834](https://qm.qq.com/q/qYp1Urv3z2)。支持项目：[赞助页](https://docs.xihanfun.com/cosmos/sponsor)。

## 许可证

[MIT](./LICENSE) © 2021-Present XiHanFun and contributors。XiHan.FormDesigner 的名称、界面视觉设计与原创视觉表达归作者所有。
