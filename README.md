# dsh-usage-dashboard

DSH 第三方插件：在 **DSH Web** 里展示 **本地 token 用量 Dashboard**（圆环、按来源/时间聚合）。  
数据来自 harness 已有 **session / turn usage**；Host **写 profile 下 JSON**；Client 经 **认证路由** 读聚合。**不**额外调模型、**不**依赖开放平台统计 API。

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
  → Host：session/event 事件流 → 攒出 turn 段 → deriveTurnTokenUsage → merge 进 usage-stats.json → prune 旧日
  → Host：Connection 认证通道注册 /api/usage.summary、/api/usage.clear
  → Client：右栏 Tab 同源 fetch 读汇总，刷新 / 清空
```

| 半侧 | 目录 |
|------|------|
| Host | `src/index.ts` |
| Client | `src/client/` → `lib/client.js` |
| 两半共享 | `src/protocol.ts`（只有常量与类型） |

Client **不得** import Host 或直读磁盘。

### 数据通道：为什么不是官方 remotes

`ctx.remote.<namespace>` 对第三方插件是**关闭**的：

- Client 侧只装配 `@deepseek-ai/dsh-api-remotes`，该包是 harness 内部包，
  它**静态 import** 被选业务包的 `/remote` 子路径（`packages/api/remotes/src/client/index.ts`），
  第三方包加不进那份清单。
- Remote 客户端还要求 typert 生成的 `lib/typert.remote-client.*` 产物（harness 的 `pnpm run build:lib` 管线）。

本插件走的是**第三方插件可用的通道**：`ctx.connection.fetch.register` 在 Connection 的
认证栅栏（Host/Origin 检查 + 浏览器会话 cookie）内注册一条精确路由，浏览器用同源 `fetch` 直读。
harness 自己的 `ui-deliverables` 等包也是这个路子（`/api/changes.summary` 等）。

详见 [docs/03-remotes-and-client.md](./docs/03-remotes-and-client.md)。

### 不回读会话历史

harness 已弃用 `session.snapshotEvents()` 等同步历史读取（决策：
`2026-09-09-deprecate-synchronous-session-event-reads`），存储演进后完整事件序列不再保证常驻内存。
因此本插件在 `session/event` 事件流上就地攒一个 turn 的段：`turn/start` 开缓冲、`turn/end` 交出。
内存占用与 turn 长度成正比，与会话历史长度无关。

## 实施顺序

详见 **[docs/README.md](./docs/README.md)**。

1. **[获取统计数据](./docs/01-collect-usage-stats.md)** — `session/event` + `deriveTurnTokenUsage`，与 Web「本轮用量」对齐 ✅
2. [持久化 JSON](./docs/02-persist-stats.md) — 日 rollup + 30 天 prune ✅
3. [数据通道与 Client](./docs/03-remotes-and-client.md) — 认证路由 + 右栏 Dashboard ✅
4. 可选 Config — `storagePath`、`retentionDays`

## 联调

**仅 Host（patch，无 Client）**

```powershell
cd D:\ScriptProject\deepseek-harness
pnpm dsh web --patch ../dsh-usage-dashboard/patch.dev.yml
```

**Host + Client**

先构建浏览器半（`lib/client.js` 是产物，不入库）：

```powershell
cd D:\ScriptProject\dsh-usage-dashboard
pnpm install
pnpm run typecheck
pnpm run build:client
```

再装载（**必须用 `plugin add`，不要用 `--patch`**：patch 的 `name: './src/index.ts'` **不会**挂 `./client`）：

```powershell
cd D:\ScriptProject\deepseek-harness
pnpm dsh plugin --profile web add D:/ScriptProject/dsh-usage-dashboard
pnpm dsh web
```

同一次启动 **不要** 混用 `--patch` 与 `plugin add`。

插件 patch 行：`id: dsh-usage-dashboard`，包名 `dsh-usage-dashboard`（行 id 与包名同名：Loader 的行 id 在同一 profile 内唯一，同名会**静默**顶掉别人的行，不报错）。

## 目录

```
docs/             实施文档（00 统一说明 + 01/02/03 步骤文档）
src/index.ts      Host 入口：采集 + 落盘
src/turn-events.ts  turn 事件收集器（事件流 buffer，不回读历史）
src/usage-store.ts  日 rollup 持久化与汇总
src/host-routes.ts  Connection 认证路由
src/protocol.ts   Host / Client 共享的常量与类型
src/client/       浏览器半（右栏 Tab）
cordis.patch.yml
patch.dev.yml
scripts/build-client.mjs
archive/          历史样本（只读对照）
```

## 外部参考

- [DSH 插件教程](https://dumplinghuman.github.io/dsh-plugin-tutorial/)（事件 / Cordis）
- [extension-cookbook.zh.md](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/cookbook/extension-cookbook.zh.md)（`session/event`）
- [API Gateway 参考](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/api-gateway.zh.md)（remote 通道的边界）
- [Whale Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)（本地 JSON 思路，UI 不同）

## 状态

`private: true` 实验仓库。**Host 步骤 1/2/3 与 Client 半均已实现**；
步骤 1/2/3 的冒烟验证（事件收集 → 折叠 → 落盘 → 汇总 → 清空、浏览器半 factory 装载）已通过；
**已在真实 `dsh web` 里端到端跑过**（`dsh plugin --profile web add` 装载，web profile）：
右栏「用量」Tab 能读出汇总并画出主环，今日 / 7 日 / 30 日切换、刷新、按来源列表都正常。

两处仍需注意：

- **布局按面板实测宽度选**（≥1200px 走 hero 版），不按 `sidebar.fullscreen`——
  窗口窄时右栏会自动全屏，那时可用宽度反而更小。
- **清空只验到路由层**：真实 profile 的统计数据没有在联调里被清过。
