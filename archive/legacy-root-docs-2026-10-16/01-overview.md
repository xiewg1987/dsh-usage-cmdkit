# 仓库概览

独立的 **DeepSeek Harness 插件** 仓库（旁路 harness：`D:\ScriptProject\deepseek-harness`）。

## 产品方向（当前）

**用量 Dashboard**：Host 从 `session/event` 读取已有 provider usage → **本地 JSON**（默认保留 30 天）→ Client 整页圆环展示。  
详见 **[06-usage-dashboard-plan.md](./06-usage-dashboard-plan.md)**。

## 两半结构

| 半侧 | 位置 | 技术 |
|------|------|------|
| **Host** | `src/index.ts` | Node：hook、文件、remotes、Config；**无 React** |
| **Client** | `src/client/` → `lib/client.js` | React：Dashboard Tab；可选 Configure 练习 |

## 代码现状

- Host：**usage-dashboard** 插件行已占位，用量 hook **尚未实现**。
- Client：**占位**（见 `src/client/README.md`）。

## 归档

| 路径 | 说明 |
|------|------|
| `archive/greet-lab/` | Host + Client 配置卡完整对照 |
| `archive/notes-phase1/` | 笔记工具 Host Phase 1 |
| `archive/pre-client-learning-2026-10-13/` | 重置前文档快照 |
