---
name: xihan-form-create-pr
description: 为 XiHan.FormDesigner 准备、审查或创建 Pull Request 时使用。适用于生成 PR 标题与正文、比较当前分支和基线、填写仓库模板或执行 gh pr create；普通代码审查不使用。
---

# XiHan.FormDesigner 创建 PR

## 前置检查

- 读取 `git status --short --branch`；存在 rebase、merge、未解决冲突或 detached HEAD 时，不创建 PR。
- 分支名按 `AGENTS.md`「分支与 worktree」分组：`feat/<名>`、`fix/<名>`、`issue/<编号>`、`pr/<编号>-review`；仍是 `claude/<名>`、`codex/<名>` 等工具前缀时，推送前先改名。分支为 `issue/<编号>` 时在「关联 Issue」填写该编号。
- base 通常是 `dev`；`main` 只接收发版，不无依据改成 `main`。
- 用 `git log <base>..HEAD`、`git diff --stat <base>...HEAD` 和完整 diff 总结整条分支，不只看最后一个提交。
- 核对提交信息、变更集（`form/.changeset/`）、参考页（`docs/reference/` 是否随源码重新生成）、文档与测试是否与实际改动一致。

## PR 内容

严格使用 `.github/PULL_REQUEST_TEMPLATE.md`，保留「关联 Issue、变更类型、变更说明、影响范围、自测清单、破坏性变更、补充说明 / 截图」结构。

- 标题用 Conventional Commit 形态，准确概括使用者能看到的影响。
- 影响范围按 core / runtime / designer / 构建工程 / 文档写，不堆文件名。
- 自测清单只勾实际跑过的：`form/` 的 `pnpm lint`、`pnpm build`、`pnpm typecheck`、`pnpm test`，改了 `docs/` 时再写文档站的 `gate:gen`、`check:examples`、`lint`、`typecheck`、`build`；没跑或失败的写明原因。
- 「未引入第三方运行时依赖」「模板仍是纯数据」两条要对着 diff 核过再勾。
- 使用者能感知的改动必须带变更集；破坏性变化写清旧写法与新写法。

只要求草稿时只输出标题和正文，不写远程。明确要求创建 PR 时，确认分支已推送后用 `gh pr create`；可以推送当前分支，但禁止 force push、合并或修改其他远端状态。创建后返回 PR 链接。仓库另有 `.gitee/`、`.gitcode/` 两份模板，只在对应平台提 PR 时使用。
