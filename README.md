<div align="center">

<h1>XiHan.FormDesigner</h1>

<h3>A fast, lightweight, efficient and thoughtfully built framework-agnostic form designer</h3>

<p>
  <a href="https://github.com/XiHanFun/XiHan.FormDesigner/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/XiHanFun/XiHan.FormDesigner/ci.yml?branch=dev&style=flat-square&label=CI" /></a>
  <a href="https://www.npmjs.com/package/@xihan-form/designer"><img alt="npm" src="https://img.shields.io/npm/v/@xihan-form/designer?style=flat-square&logo=npm&logoColor=white&color=cb3837" /></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/github/license/XiHanFun/XiHan.FormDesigner?style=flat-square&color=green" /></a>
  <a href="https://github.com/XiHanFun/XiHan.FormDesigner/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/XiHanFun/XiHan.FormDesigner?style=flat-square&logo=github&label=Stars&color=1f6feb" /></a>
  <a href="https://gitee.com/XiHanFun/XiHan.FormDesigner"><img alt="Gitee Stars" src="https://gitee.com/XiHanFun/XiHan.FormDesigner/badge/star.svg" /></a>
  <a href="https://gitcode.com/XiHanFun/XiHan.FormDesigner"><img alt="GitCode Stars" src="https://gitcode.com/XiHanFun/XiHan.FormDesigner/star/badge.svg" /></a>
</p>

<p>
  <a href="https://form.docs.xihanfun.com"><b>Docs</b></a> ·
  <a href="#getting-started"><b>Getting Started</b></a> ·
  <a href="https://form.docs.xihanfun.com/changelog"><b>Changelog</b></a>
</p>

<p><b>English</b> | <a href="./README_cn.md">简体中文</a></p>

</div>

XiHan.FormDesigner is a framework-agnostic form designer delivered as Web Components. One JSON definition drives both the designer and rendering on business pages. It is part of the XiHanFun open-source ecosystem.

## Features

| Feature | Description |
| --- | --- |
| Framework-agnostic | Native Web Components for Vue, React, Angular and pages without a framework |
| No third-party dependencies | Nothing third-party at runtime |
| Templates are data | Templates are JSON that neither contain nor execute code |
| Data stays with you | Components make no network requests; data, storage and permissions go through callbacks |
| One definition | The same JSON drives design, rendering, validation and linkage |

## Getting Started

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

Templates, validation and language packs are covered in the [quickstart](https://form.docs.xihanfun.com/quickstart).

## Packages

| Package | Description |
| --- | --- |
| `@xihan-form/core` | Model layer: form schema, validation rules, linkage rules and editing commands, with no DOM dependency |
| `@xihan-form/runtime` | Runtime: form rendering, values and validation |
| `@xihan-form/designer` | Designer: visual form design |

Dependencies run `designer → runtime → core`, and business pages only need `runtime`.

## Local Development

Requires Node.js 24+ and pnpm 11+. The development preview runs at `http://localhost:5192`.

```bash
cd form
pnpm install
pnpm dev
```

## Ecosystem

| Project | Description |
| --- | --- |
| [XiHan.Framework](https://github.com/XiHanFun/XiHan.Framework) | .NET microkernel development framework |
| [XiHan.UI](https://github.com/XiHanFun/XiHan.UI) | Framework-agnostic headless UI component library |
| [XiHan.BasicApp](https://github.com/XiHanFun/XiHan.BasicApp) | A beautifully crafted general-purpose admin kernel built on XiHan.Framework and XiHan.UI |
| [XiHan.FlowDesigner](https://github.com/XiHanFun/XiHan.FlowDesigner) | Framework-agnostic flow designer |
| [XiHan.PrintDesigner](https://github.com/XiHanFun/XiHan.PrintDesigner) | Framework-agnostic print designer |
| [XiHan.ReportDesigner](https://github.com/XiHanFun/XiHan.ReportDesigner) | Framework-agnostic report designer |

## Documentation

The documentation site is written in Chinese.

[Renderer](https://form.docs.xihanfun.com/guide/renderer) · [Designer](https://form.docs.xihanfun.com/guide/designer) · [Template structure](https://form.docs.xihanfun.com/guide/template) · [Changelog](https://form.docs.xihanfun.com/changelog)

## Contributing

[Issues](https://github.com/XiHanFun/XiHan.FormDesigner/issues) and pull requests are welcome. Commits follow Conventional Commits, and changes must pass the CI gates. Community: QQ group [462371834](https://qm.qq.com/q/qYp1Urv3z2). Support the project: [sponsorship page](https://docs.xihanfun.com/cosmos/sponsor).

## License

[MIT](./LICENSE) © 2021-Present XiHanFun and contributors. The XiHan.FormDesigner name, interface design and original visual expression belong to the author.
