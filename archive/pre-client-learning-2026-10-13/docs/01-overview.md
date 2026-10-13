# 仓库概览

## 这是什么

独立的 **DeepSeek Harness（DSH）插件** 仓库。在这里开发、提交；不要把业务代码提交进 `deepseek-harness`。

旁路 harness 路径（本机）：`D:\ScriptProject\deepseek-harness`。

## 两半结构（记住即可）

| 半侧 | 跑在哪 | 典型职责 |
|------|--------|----------|
| **Host** | 本机 Node（`pnpm dsh web` 起的进程） | Config、可选工具、`ctx.on('…')` |
| **Client（UI 练习重点）** | 浏览器 | Plugins 配置卡、`plugins.row.config` 等 |

网页 **不能**直接访问你的硬盘。Host 工具在 Node 执行；**UI 卡片在浏览器里改 Config**，不必经过 LLM。

## 插件能覆盖什么 / 不能覆盖什么

**能：** Volatile 配置 + Plugins 行配置页、工具、toolview（进阶）、部分 slot。

**不能：** 整页对话壳换皮、取消输入框改成桌宠。

## 当前阶段

- **greet** 已封存：`archive/greet-lab/`（Host+Client 完整样本）
- **笔记** 已封存：`archive/notes-phase1/`
- **当前练习：Web UI 插件** — Plugins 配置卡（见 `02-ui-plugin-practice.md`）
- 代码由你实现；AI 按你的提问辅助
