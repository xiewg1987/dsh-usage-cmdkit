# 用量 Dashboard 方案

在 **DSH Web 壳内** 提供整页统计 UI（圆环图、分来源 Tab、今日/7 日/30 日），数据 **仅来自本地已发生的模型调用**，**纯文件存储**，默认最多保留 **30 天**。

## 1. 目标与非目标

### 目标

- 每次 **turn**（用户一问对应的 agent 轮次边界）结算后，累加 token 用量。
- Dashboard 展示与内置 **「本轮用量」** 同类的字段：未缓存输入、输出、缓存读/写（有则计，无则 0）。
- 按 **provider / model** 分 Tab（如 总 / 某提供方）。
- **刷新**：Client 再拉 remotes；**清空**：Host  truncate 或删除统计文件。
- 全程 **不额外消耗 LLM token**（不为此注册会触发模型的 Tool）。

### 非目标

- VS Code 式侧栏图标、开始页第三张卡。
- 独立桌面桌宠（Electron `desktop` profile）。
- **MiniMax / 平台 TOKEN PLAN** 进度条（需开放平台 HTTP，**可选 Phase D+**，与本地统计分离）。
- 无限期全量 turn 明细归档（默认只保留 30 天日 rollup）。

## 2. 数据从哪来（无额外统计 API）

模型 **每一次** Chat 请求的响应里，适配器已解析为 `@deepseek-ai/dsh-llm` 的 **`TokenUsage`**（见 harness `packages/llm/llm/src/types.ts`）：

| 字段 | 含义 |
|------|------|
| `inputTokens` | 未缓存输入（与 cache 分列） |
| `outputTokens` | 输出 |
| `cacheReadTokens` / `cacheWriteTokens` | 缓存读/写（可选） |
| `totalTokens` | 可选合计 |

DSH Web 弹层 **「本轮用量」**（`ui-chat` / `TurnUsagePanel`）使用 **`TokenUsageProjection`** 四桶：`uncachedInputTokens`、`outputTokens`、`cacheReadTokens`、`cacheWriteTokens`。

插件 **不再次请求 provider**；只在 Host 监听：

- **`ctx.on('session/event', …)`** — 持久 settlement、turn 边界（参考 harness `docs/cookbook/extension-cookbook.zh.md`）。
- 必要时从 assistant stream 解析 **`type: 'usage'`** chunk（`expandAssistantStream`）。

**提供方 / 模型** 从当前 session 路由读取（本地配置），非外网查询。

### turn 边界

一轮用户问题可能包含 **多 step**（工具、多段模型调用）。记账应以 harness 的 **turn** 为准（如 `turn/end` 或该 turn 上最终 usage 投影），避免同一 turn 重复累加 step；实现时对照 `token-meter` / `session-stats` 行为。

## 3. 存储：纯文件、本地落地

### 谁写盘

仅 **Host（Node）** 使用 `fs` 读写。Client **禁止**直接读 profile 路径。

### 默认路径

建议（实现时可 Config 覆盖）：

```text
$DSH_HOME/profiles/web/usage-stats.json
```

或与 Whale 类似，放在当前 **managed profile** 目录下单一 JSON。路径写入 README / Config 说明，**不**提交进 git。

### 文件结构（推荐：日 rollup）

便于 7/30 日圆环与 30 天 prune：

```json
{
  "version": 1,
  "retentionDays": 30,
  "days": {
    "2026-03-16": {
      "total": {
        "uncachedInputTokens": 0,
        "outputTokens": 0,
        "cacheReadTokens": 0,
        "cacheWriteTokens": 0
      },
      "byProvider": {
        "minimax-cn": {
          "uncachedInputTokens": 0,
          "outputTokens": 0,
          "cacheReadTokens": 0,
          "cacheWriteTokens": 0
        }
      }
    }
  }
}
```

- **时区**：「日」键用 **本地** `YYYY-MM-DD`。
- 每次 hook 成功：**merge 进当天桶** + `pruneDays(retentionDays)` 删除更早的 `days` 键。
- 可选：另存 `lastTurns.jsonl`（最近 N 条 turn 明细）用于调试；非 MVP 必需。

### 保留策略

| 配置 | 默认 |
|------|------|
| `retentionDays` | `30`（「最多约一月」为产品默认，非 DSH 硬限制） |

清空计数器 = Host 删除文件或重置 `days: {}`。

## 4. Host ↔ Client

| 能力 | 实现 |
|------|------|
| 读聚合 | remotes：`getUsageSummary()` → `{ today, d7, d30, byProvider }` |
| 清空 | remotes：`clearUsage()` |
| 刷新 | Client 再次调用 `getUsageSummary()`（可选 Host 重读文件） |

实时性：Host 在 hook 写盘后，若有订阅机制则 push；MVP 可 **Client 进入 Tab 时拉一次 + 手动刷新**。

## 5. Client UI

- **位置**：优先 **右栏 Tab**（`sidebarRightTabs` + `sidebar.right.pane.tab`），整页 Dashboard。
- **内容**：三圆环（今日/7 日/30 日）、来源 Tab、合计 tok、刷新/清空。
- **技术**：React 18 + 图表库；`plugin add` + `lib/client.js`。
- **Config（Phase D）**：可选 Volatile 字段（路径、保留天数），可在 Dashboard 内或后续 Configure 槽位编辑。

## 6. 与 `--patch` / `plugin add`

| 方式 | Host hook | Client Dashboard |
|------|-----------|------------------|
| `dsh web --patch patch.dev.yml` | ✅ | ❌ 不加载 client |
| `plugin add` + `dsh web` | ✅ | ✅ |

开发顺序：先用 **patch** 验证 hook 与 JSON 文件；再上 **plugin add** 做 Client。

## 7. 实施阶段（验收）

### Phase A — Host hook

- [ ] 订阅 `session/event`（及必要时的 usage chunk）。
- [ ] 每 turn 累加后 `usage-stats.json` 数字变化。
- [ ] 终端 log 可选；**不**注册 LLM Tool。

### Phase B — remotes

- [ ] `getUsageSummary` 与文件一致。
- [ ] `clearUsage` 生效。

### Phase C — Client

- [ ] 右栏 Tab 显示三环与 Tab。
- [ ] 刷新/清空调用 remotes。

### Phase D — Config（可选）

- [ ] Volatile：`storagePath`、`retentionDays`。
- [ ] Configure 卡或 Dashboard 内编辑。

## 8. 参考

| 资源 | 用途 |
|------|------|
| [dumplinghuman 教程 第 5 章](https://dumplinghuman.github.io/dsh-plugin-tutorial/) | 事件 hook 入门 |
| harness `docs/cookbook/extension-cookbook.zh.md` | `session/event`、`agent/assistant-stream` |
| harness `packages/llm/token-meter` | `TokenUsageProjection`、turn 用量 |
| [Whale Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) | 本地 JSON 路径参考（非 Dashboard UI） |
| `archive/greet-lab` | Client 槽位与 build 对照 |

## 9. 风险与边界

- 部分 provider 不报 cache 分项 → UI 显示 0。
- 多 step turn 需对齐 **turn/end**，避免重复计数。
- 统计 **不** 替代官方账单；仅用户本地参考。
- 平台配额条若未来要做，单独 HTTP + 短缓存，与本文 **纯文件统计** 分文件/分 Config。
