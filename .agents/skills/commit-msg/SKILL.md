---
name: xihan-form-commit-msg
description: 根据 XiHan.FormDesigner 当前暂存区生成一行提交信息时使用。适用于“提交信息”“commit msg”“msg”或提交前概括 staged changes；只生成消息，不负责暂存、解决冲突或执行提交。
---

# XiHan.FormDesigner 提交信息

## 工作流

1. 运行 `git status --short --branch`，存在未解决冲突时停止并指出冲突，不生成假定已完成的提交信息。
2. 只读取 `git diff --cached --stat`、`git diff --cached` 和最近 20 条提交；未暂存内容不纳入，除非用户明确要求。
3. 暂存区为空时直接说明，不根据工作区或聊天内容猜消息。
4. 把全部暂存改动归纳为一个意图，输出一行 Conventional Commit。

格式：`<type>(<scope>): <中文说明>`。type 取 `feat`、`fix`、`refactor`、`perf`、`docs`、`style`、`test`、`build`、`ci`、`chore`、`revert`。

scope 取 `core`、`runtime`、`designer`、`docs`、`repo`；一笔同时改了几层就按依赖方向组合，如 `feat(core,runtime,designer,docs)`，不逐文件罗列。只动文档站可以写 `docs:` 不带 scope；版本提交固定写 `build: v<版本>`。

删除或改名公开 API、元素的属性 / 事件 / 方法 / 部件、扩展点形状，或旧模板读不进来时加 `!`，如 `feat(designer,docs)!:`。说明写使用者能看到的结果，不写「改文件、加判断」这类内部步骤。只要求消息时，最终只输出提交标题，不附解释、代码块或候选列表。
