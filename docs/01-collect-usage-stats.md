# 步骤 1：获取统计数据

目标：**在 Host 里拿到每次对话 turn 结束时的 token 用量**，字段与 DSH Web **「本轮用量」** 一致。  
本步 **不写文件、不做 Dashboard、不注册 Tool**，也 **不** 为统计多调一次模型。

## 1.1 数据从哪来

用量不是去查开放平台 API，而是 harness 在模型响应里已经解析好的 **`TokenUsage`**，并写进持久会话日志。插件只 **订阅** 这些事实：

| 通道 | 用途 |
|------|------|
| **`ctx.on('session/event', (session, event) => …)`** | 持久事件：turn/step 边界、`assistant/message`、`assistant/attempt`、工具活动等 |
| `agent/assistant-stream` | 实时流帧；**统计 turn 总量时不必先接这条**（ settlement 已在 `session/event`） |

与内置 Chat 对齐的做法：在 **`turn/end`** 时，对该 turn 从 **`turn/start` 到 `turn/end`** 的 durable 事件做一次 fold，调用 harness 提供的：

```ts
import { deriveTurnTokenUsage } from '@deepseek-ai/dsh-token-meter/client'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
```

Web Client 的「本轮用量」同样走这条路径（`ui-chat` 在 turn 尾部对 `context.matches` 调 `deriveTurnTokenUsage`）。**插件 Host 应复用同一函数**，避免自己按 step 相加导致重试/重复计数。

`deriveTurnTokenUsage` 成功时返回 **`TurnTokenUsage`**（与 UI 展示同族）：

| 字段 | 含义 |
|------|------|
| `uncachedInputTokens` | 未缓存输入（对应 UI「未缓存输入」） |
| `outputTokens` | 输出 |
| `cacheReadTokens` / `cacheWriteTokens` | 缓存读/写（部分 provider 无则整轮可能无该字段） |
| `totalTokens` | 该 turn 各 attempt 合计 |
| `routes` | 可选：本 turn 计费用的 `{ provider, model }[]` |

若生命周期不完整、计数不安全或总量矛盾，函数返回 **`undefined`** — 本步应 **打 log 并跳过**，不要硬写 0 冒充成功。

### 底层 `TokenUsage`（单 attempt）

适配器在 `assistant/message` 的 `data.usage`，或 stream 里 `type: 'usage'` chunk 上携带的原始结构（见 `@deepseek-ai/dsh-llm`）：

- `inputTokens` → 投影为 **`uncachedInputTokens`**
- `outputTokens`、`cacheReadTokens`、`cacheWriteTokens` 等同名映射

## 1.2 推荐算法（按 turn 缓冲）

在 `apply(ctx)` 里维护 **每个 session** 的当前 turn 缓冲（Map：`sessionId → { turn, events[] }`）：

1. **`turn/start`**：新开缓冲，`turn = event.data.turn`，`events = [event]`。
2. **turn 内任意 durable 事件**（含 `step/*`、`assistant/*`、`llm/retry*`、`tool/*` 等）：若 `event.data.turn === 当前 turn`（或有 turn 坐标的事件），**append** 到缓冲。  
   - 不要监听 live-only 类型；Host 侧只有 `session/event`。
3. **`turn/end`** 且 `event.data.turn === 当前 turn`：  
   - append `turn/end`  
   - `const usage = deriveTurnTokenUsage(events)`  
   - 若 `usage` 有值：这是 **本步唯一要消费的统计结果**（log / 暂存内存）  
   - 清空该 session 缓冲  

**不要**在每条 `assistant/message` 上直接把 `usage` 加进「今日总量」—— 一个 turn 多 step、多 attempt、retry 时容易 **重复或漏计**。以 **turn 边界 + deriveTurnTokenUsage** 为准。

可选：仅统计「用户主会话」时，在 handler 里过滤 session（例如只处理某 agent 的 `agent.session`）；MVP 可先 **所有 session 都打 log**，便于对照。

## 1.3 依赖（dev）

在 `package.json` 的 `devDependencies` 增加与 harness 的 link（路径随你本机仓库）：

```json
"@deepseek-ai/dsh-token-meter": "link:../deepseek-harness/packages/llm/token-meter",
"@deepseek-ai/dsh-session": "link:../deepseek-harness/packages/core/session"
```

类型：`SessionEvent` 来自 `@deepseek-ai/dsh-session/types`。  
运行期 **不必** 把整个 `dsh-token-meter` 插件挂进 composition：`deriveTurnTokenUsage` 是纯函数；Web 运行时本身已加载 token-meter。

## 1.4 参考实现骨架（仅步骤 1）

放在 `src/index.ts`（或拆到 `src/usage/collect-turn-usage.ts`）。下述为说明用伪代码，提交前需按 TypeScript 严格类型补全：

```ts
import type { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import { deriveTurnTokenUsage } from '@deepseek-ai/dsh-token-meter/client'

interface TurnBuffer {
  turn: number
  events: SessionEvent[]
}

function turnOf(event: SessionEvent): number | undefined {
  if (event.type === 'turn/start' || event.type === 'turn/end') return event.data.turn
  if ('turn' in event.data && typeof event.data.turn === 'number') return event.data.turn
  return undefined
}

export function apply(ctx: Context): void {
  const buffers = new Map<string, TurnBuffer>()

  ctx.on('session/event', (session: Session, event: SessionEvent) => {
    const id = session.id

    if (event.type === 'turn/start') {
      buffers.set(id, { turn: event.data.turn, events: [event] })
      return
    }

    const buf = buffers.get(id)
    if (buf === undefined) return

    const t = turnOf(event)
    if (t !== undefined && t !== buf.turn) return

    buf.events.push(event)

    if (event.type !== 'turn/end') return

    const usage = deriveTurnTokenUsage(buf.events)
    buffers.delete(id)

    if (usage === undefined) {
      console.warn(`[usage-dashboard] turn ${event.data.turn} session ${id}: no usage`)
      return
    }

    console.log('[usage-dashboard] turn usage', {
      sessionId: id,
      turn: event.data.turn,
      ...usage,
    })
  })
}
```

步骤 1 验收：**只要求 log 出现且与 UI「本轮用量」同一数量级/同一四桶**（有 cache 的模型要对齐 cache 行）。

## 1.5 联调与对照

**Host only（patch，适合本步）**

```powershell
cd D:\ScriptProject\deepseek-harness
pnpm dsh web --patch ../dsh-usage-dashboard/patch.dev.yml
```

在 Web 里发一条会触发模型回复的消息 → 等 turn 结束 → 看 **harness 终端** 是否打印 `[usage-dashboard] turn usage`。

对照方式：

1. 聊天里点该轮 **「本轮用量」** 弹层。  
2. 比较 `uncachedInputTokens`、`outputTokens`、`cacheReadTokens`、`cacheWriteTokens` 与 log。  

若 log 为 `no usage` 而 UI 有数：抓该 turn 的事件类型序列（是否缺 `turn/start`/`turn/end`、是否 subagent 会话），再查 harness `packages/llm/token-meter/tests/turn-usage.spec.ts` 里的边界用例。

## 1.6 本步刻意不做

| 不做 | 原因 |
|------|------|
| 写 `usage-stats.json` | 属 [步骤 2](./02-persist-stats.md) |
| remotes / Client | 属 [步骤 3](./03-remotes-and-client.md) |
| 注册 LLM Tool | 会额外消耗 token，与产品目标冲突 |
| 用 `ctx.tokenMeter.measure()` 代替 turn 结算 | 那是上下文 **压力估算**，不是「本轮 provider 账单式」用量；Dashboard 要与 **本轮用量** 一致 |

## 1.7 完成标准（Checklist）

- [ ] `session/event` 监听在 patch 联调下随聊天触发  
- [ ] 每个完成的 turn 至多一条有效统计（无 step 级重复累加）  
- [ ] log 与 Web「本轮用量」四桶一致（或明确记录 `undefined` 的 turn）  
- [ ] 多轮对话：turn 1、turn 2 各打一条，互不覆盖  

通过后进入 **[步骤 2：持久化](./02-persist-stats.md)**。
