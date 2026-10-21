---
name: xihan-form-version-release
description: 为 XiHan.FormDesigner 准备版本、消费变更集、进出 rc 预发布、校验发布产物、打 v* 标签发 npm 或处理 Release 失败时使用。适用于“发版”“升版本”“发 rc”“打标签”“Release 红了”；只有用户明确要求实际发布时才推送标签或触发 Release 工作流。
---

# XiHan.FormDesigner 版本发布

发布机制的说明在 `form/.changeset/README.md`，步骤在 `AGENTS.md`「发版」。

## 前置条件

- 工作区干净、无冲突、无进行中的 merge / rebase；在 `dev` 上做，detached HEAD 不发版。
- 三个公开包经 changesets 的 `fixed` 组锁步同版，版本真源是它们的 `version`；playground 不计版。
- 预发布状态在 `form/.changeset/pre.json`（`mode: pre`、`tag: rc`）。预发布期间用过的变更集记在它的 `changesets` 里、文件留着，转正式版时才一并消费删掉，不要手删。
- 已推到远端的提交不 amend、不 rebase、不强推；要改就新增提交。

## 定版本

1. 在 `form/` 跑 `scripts/release/VersionUpgrade.bat`（或 `pwsh scripts/release/VersionUpgrade.ps1`）；先 `-DryRun` 看计划。参数：`-Channel keep|alpha|beta|rc|release`、`-Level derived|major|minor|patch`、`-Yes`。不替用户预选通道与级别。
2. 在 rc 通道里续发用 `-Channel keep -Level derived`，得到下一个 `-rc.N`；转正式版用 `-Channel release`，脚本执行 `changeset pre exit`。
3. 从一个没有预发布后缀的版本进 rc，changesets 只会出 `-rc.0`（N 按当前版本推导，不记在 `pre.json`）。要直接落到 rc.1 这样的号：先 `pnpm exec changeset pre enter rc`，再把三个包的 `version` 临时改成上一个号（如 `1.0.0-rc.0`），然后 `-Channel keep -Level derived -Yes`；`pre enter` 必须在改版本号之前，否则 `initialVersions` 记错。
4. 看一遍三个包的 `package.json`、`CHANGELOG.md` 与 `.changeset/` 的改动；在 `docs/changelog.md` 补这一版的一节（见 `xihan-form-changelog-collect`）。
5. `form/` 跑 `pnpm lint`、`pnpm build`、`pnpm typecheck`、`pnpm test`、`pnpm gate:publish`、`pnpm smoke --pack`；`docs/` 跑 `pnpm gate:gen`、`pnpm check:examples`、`pnpm lint`、`pnpm typecheck`、`pnpm build`；再 `git diff --check`。全过才提交 `build: v<版本>`。

## 发布

只有用户明确要求才做，一步一停：

1. 推 `dev`，等 dev 上的 CI 全绿。
2. `git fetch . dev:main` 快进 `main`（不是快进就停下查），推 `main`，等 main 上的 CI 全绿。
3. 在版本提交上打 `v<版本>` 标签并推送。标签号必须等于三个包的版本、预发布与否与 `pre.json` 一致，且在 `main` 的历史里；本地可在 `form/` 用 `RELEASE_TAG=v<版本> node scripts/release/check-release-tag.mjs` 先核。
4. `.github/workflows/release.yml` 依次跑「核对标签 → 发到 npm（`changeset publish --no-git-tag`）→ 发布后冒烟（`smoke.mjs --version`）→ 部署文档站」。看 Release 只看 `gh run view <id>` 的摘要，失败时再取失败步骤的日志原文。
5. 发完用 `npm view @xihan-form/core dist-tags`（runtime、designer 同样）核对：预发布版打在 `rc`，从没发过正式版的包首发也会进 `latest`；新包上 npm 自建的 `0.0.0-stage` 占位不用管。

## 失败时

- 冒烟报 `npm 上找不到 @xihan-form/…@<版本>`、E404、ETARGET、No matching version，是 npm 还没同步：等 `npm view @xihan-form/designer@<版本> version` 取得到，再 `gh run rerun <run-id> --failed` 补跑冒烟与部署文档站，不动标签。
- 发到 npm 报二次验证（OTP）一类错误，是令牌的事，报给用户，修好后同样 `rerun --failed`。
- 其它失败停下报告原文。不删标签重打、不移动标签、不手改 dist、不重复发布已在 npm 上的版本。
- 文档站只部署已经发布的版本（`deploy-docs.yml` 核对标签、main 上的包版本与 npm）。npm 包的版本不建 GitHub Release。
