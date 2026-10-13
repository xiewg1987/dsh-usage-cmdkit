# 仓库概览

独立的 **DeepSeek Harness 插件** 仓库（旁路 harness：`D:\ScriptProject\deepseek-harness`）。

## 两半结构

| 半侧 | 位置 | 技术 |
|------|------|------|
| **Host** | `src/index.ts` | Node，Config / 可选工具，**无 React** |
| **Client** | `src/client/` → `lib/client.js` | 浏览器，**React TSX**，slots / 配置卡 |

## 当前阶段

**只学 Client 半**：Plugins 配置卡（`plugins.row.config`）。  
Host 已留最小 Config；实现任务在 **`docs/02-client-learning.md`**。

归档：`archive/greet-lab/`（完整对照）、`archive/notes-phase1/`、`archive/pre-client-learning-2026-10-13/`。
