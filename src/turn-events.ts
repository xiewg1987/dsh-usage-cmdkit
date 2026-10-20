/**
 * turn 事件收集器：在事件流上就地攒出一个 turn 的完整生命周期。
 *
 * 为什么不用「回读会话历史」：harness 已弃用 `session.snapshotEvents()` 等同步历史读取
 * （见 harness 的 `2026-09-09-deprecate-synchronous-session-event-reads` 决策），
 * 存储演进后完整事件序列不再保证常驻内存。这里只消费 `session/event` 推送的事件，
 * 在 `turn/start` 处开缓冲、在 `turn/end` 处交出，**不回头查历史**。
 */
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'

/** 一个 turn 的缓冲：编号 + 攒到的事件。 */
interface TurnBuffer {
  /** 当前缓冲所属的 turn 编号。 */
  turn: number
  /** `turn/start` 起、`turn/end` 止的事件。 */
  events: SessionEvent[]
}

/**
 * 事件所属的 turn 编号。
 *
 * 事件类型众多，只有 turn 边界与带 `turn` 字段的事件能定位到 turn；
 * 其余事件（如会话标记）不参与 turn 归属判定。
 * @param event - 一条会话事件。
 * @returns turn 编号；事件不携带 turn 时为 undefined。
 */
function turnOf(event: SessionEvent): number | undefined {
  if (event.type === 'turn/start' || event.type === 'turn/end') return event.data.turn
  const data = event.data as unknown as { readonly turn?: unknown }
  return typeof data.turn === 'number' ? data.turn : undefined
}

/**
 * 按会话收集 turn 事件段。
 *
 * 缓冲只覆盖一个 turn：`turn/start` 开启，`turn/end` 交出并释放。
 * 因此内存占用与 turn 长度成正比，与会话历史长度无关。
 */
export class TurnCollector {
  private readonly buffers = new Map<string, TurnBuffer>()

  /**
   * 收下一条事件。
   * @param sessionId - 事件所属会话。
   * @param event - 会话事件。
   * @returns 该 turn 的完整事件段（`turn/start`…`turn/end`）；本次不是 `turn/end` 时为 undefined。
   */
  push(sessionId: string, event: SessionEvent): SessionEvent[] | undefined {
    if (event.type === 'turn/start') {
      // 新 turn 覆盖旧缓冲：上一个 turn 没等到 turn/end 就不再补记。
      this.buffers.set(sessionId, { turn: event.data.turn, events: [event] })
      return undefined
    }

    const buffer = this.buffers.get(sessionId)
    if (buffer === undefined) return undefined

    // 不属于当前 turn 的事件不混入（防御性：跨 turn 污染会让统计失真）。
    const turn = turnOf(event)
    if (turn !== undefined && turn !== buffer.turn) return undefined

    buffer.events.push(event)
    if (event.type !== 'turn/end') return undefined

    this.buffers.delete(sessionId)
    return buffer.events
  }

  /** 当前仍在等待 `turn/end` 的会话数。 */
  get pending(): number {
    return this.buffers.size
  }
}
