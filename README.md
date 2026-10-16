# dsh-usage-dashboard

DSH 第三方插件：在 **DSH Web** 里展示 **本地 token 用量 Dashboard**（圆环、按来源/时间聚合）。  
数据来自 harness 已有 **session / turn usage**；Host **写 profile 下 JSON**；Client 经 **remotes** 读聚合。**不**额外调模型、**不**依赖开放平台统计 API。

旁路 harness：`D:\ScriptProject\deepseek-harness`（本仓库 `package.json` 里 `@deepseek-ai/*` 为 `link:`）。

## 目标

| 做 | 不做 |
|----|------|
| turn 结束后累加与「本轮用量」同类的 token 桶 | VS Code 侧栏、开始页卡片、桌宠 |
| 日 rollup JSON，默认保留约 **30 天** | 为统计注册 LLM Tool |
| 右栏 Tab：今日 / 7 日 / 30 日 + 按 provider Tab | MiniMax TOKEN PLAN 条（可另做） |

Token 字段对齐 harness `TokenUsageProjection` 四桶：`uncachedInputTokens`、`outputTokens`、`cacheReadTokens`、`cacheWriteTokens`（缺项按 0）。

## 架构

```
模型响应 → usage 已在 DSH 会话内
  → Host：session/event（及必要时 stream usage）→ merge 进 usage-stats.json → prune 旧日
  → remotes：getUsageSummary / clearUsage
  → Client：Dashboard 拉 remotes，刷新 / 清空
```

| 半侧 | 目录 |
|------|------|
| Host | `src/index.ts` |
| Client | `src/client/` → `lib/client.js` |

Client **不得** import Host 或直读磁盘。

## 实施顺序

详见 **[docs/README.md](./docs/README.md)**。当前从 **步骤 1** 开始：

1. **[获取统计数据](./docs/01-collect-usage-stats.md)** — `session/event` + `deriveTurnTokenUsage`，与 Web「本轮用量」对齐  
2. [持久化 JSON](./docs/02-persist-stats.md)  
3. [remotes + Client Dashboard](./docs/03-remotes-and-client.md)  
4. 可选 Config — `storagePath`、`retentionDays`

## 联调

**仅 Host（patch，无 Client）**

```powershell
cd D:\ScriptProject\deepseek-harness
pnpm dsh web --patch ../dsh-usage-dashboard/patch.dev.yml
```

**Host + Client**

```powershell
pnpm dsh plugin --profile web add D:/ScriptProject/dsh-usage-dashboard
pnpm dsh web
```

同一次启动 **不要** 混用 `--patch` 与 `plugin add`（patch 的 `name: './src/index.ts'` **不会**挂 `./client`）。

```powershell
cd D:\ScriptProject\dsh-usage-dashboard
pnpm install
pnpm run typecheck
```

插件 patch 行：`id: usage-dashboard`，包名 `dsh-usage-dashboard`。

## 目录

```
docs/             实施文档（从 01 获取统计开始）
src/index.ts
src/client/
cordis.patch.yml
patch.dev.yml
scripts/build-client.mjs
archive/          历史样本（只读对照）
```

## 外部参考

- [DSH 插件教程](https://dumplinghuman.github.io/dsh-plugin-tutorial/)（事件 / Cordis）
- [extension-cookbook.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/extension-cookbook.zh.md)（`session/event`）
- [Whale Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)（本地 JSON 思路，UI 不同）

## 状态

`private: true` 实验仓库。Host / Client **尚未实现**；以 **docs/** 与代码为准。
