---
name: xihan-form-changelog-collect
description: 收集 XiHan.FormDesigner 两个版本或引用之间使用者能感知的变化、核对变更集或更新文档站 docs/changelog.md 时使用。适用于“整理更新日志”“这版改了什么”“补 changelog”；它不提升版本、不消费变更集，也不发布 npm 包。
---

# XiHan.FormDesigner 变更日志整理

## 事实源

- 用户指定的起止标签或提交；没给终点用当前 HEAD，没给起点先提出最近的 `v*` 标签供确认。
- `git log <from>..<to>`、实际 diff、`form/.changeset/*.md`（预发布期间用过的记在 `form/.changeset/pre.json` 的 `changesets` 里，文件留着）。
- 三个包的 `CHANGELOG.md`（由 VersionUpgrade 从变更集生成，不手改）与 `docs/changelog.md` 现有的写法。

## 收录规则

- 只收 `@xihan-form/core`、`@xihan-form/runtime`、`@xihan-form/designer` 的使用者能感知的变化：公开 API、元素的属性 / 事件 / 方法 / 部件、模板结构、扩展点、样式外观、语言包文案、问题码。
- CI、门禁、测试、文档站、playground、构建与发版脚本、README 不收，除非改变了发布物或用法。
- 每条开头标 **新增 / 修复 / 调整 / 移除**，写「改了什么、影响谁、要做什么」，官方平实口径，不写内部步骤。
- 包名、属性、事件、导出与问题码用反引号。破坏性变化写清旧写法与新写法；模板结构变了要写旧模板怎么读进来。
- 同一变化跨 core、runtime、designer 时合成一条使用者能看到的结果，不拆成实现清单。

## 写进文档站

`docs/changelog.md` 每版一节：`## v<版本>（YYYY-MM-DD）`，日期写计划发布的那天，发布推迟了另起一笔改日期。三个包锁步同版，一节里按包列条目。这一页由人在升版本的同一笔里补，导航上的版本号取 core 的版本，不用另改。

本技能只整理与核对，不运行 VersionUpgrade、`changeset version`，不删变更集，不改版本号；那些归 `xihan-form-version-release`。
