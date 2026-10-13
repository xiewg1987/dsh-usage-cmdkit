# 仓库概览

## 这是什么

独立的 **DeepSeek Harness（DSH）插件** 仓库。在这里开发、提交；不要把业务代码提交进 `deepseek-harness`。

旁路 harness 路径（本机）：`D:\ScriptProject\deepseek-harness`。

## 两半结构（记住即可）

| 半侧 | 跑在哪 | 典型职责 |
|------|--------|----------|
| **Host** | 本机 Node（`pnpm dsh web` 起的进程） | `defineTool`、读盘写盘、`ctx.on('tools/…')` |
| **Client（可选）** | 浏览器 | Plugins 配置卡、`plugins.row.config` 等 |

网页 **不能**直接访问你的硬盘。工具在 Host 上执行，结果再显示到 Web。

## 插件能覆盖什么 / 不能覆盖什么

**能：** 工具、工具策略（pre/post-execute）、Volatile 配置、Plugins 里自己的配置页、（进阶）工具结果 toolview。

**不能：** 整页对话壳换皮、取消输入框改成语音桌宠——那是产品壳，不是本插件范围。

## 当前阶段

- **greet** 已封存：`archive/greet-lab/`
- **方案 A Phase 1**（txt 笔记）已封存：`archive/notes-phase1/`
- **当前练习：方案 A Phase 2** — JSON 存储（见 `02-plan-a-notes.md`）
- 代码由你实现；AI 按你的提问辅助，默认不替你写完整业务除非你明确要求
