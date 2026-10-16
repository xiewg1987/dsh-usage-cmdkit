/**
 * Usage Dashboard — Host 半（步骤 1：采集 turn 用量）。
 * 在 turn 结束时从会话持久日志截取事件，与 Web「本轮用量」同源 fold。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type { Session } from '@deepseek-ai/dsh-session'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import { deriveTurnTokenUsage } from '@deepseek-ai/dsh-token-meter/client'

/** 与 cordis.patch.yml 行 id 一致 */
export const name = 'usage-dashboard'

/**
 * 从会话快照中取出某一 turn 的 durable 事件段：`turn/start` … `turn/end`（含首尾）。
 * 用快照而不是手写缓冲，避免插件晚挂载漏掉 turn/start、或漏收中间事件。
 */
function eventsForTurn(session: Session, turn: number): SessionEvent[] {
  const all = session.snapshotEvents()
  let start = -1
  let end = -1
  for (let i = 0; i < all.length; i++) {
    const event = all[i]!
    if (event.type === 'turn/start' && event.data.turn === turn) start = i
    if (event.type === 'turn/end' && event.data.turn === turn) {
      end = i
      break
    }
  }
  if (start < 0 || end < 0 || end < start) return []
  return all.slice(start, end + 1)
}

export function apply(ctx: Context): void {
  ctx.on('session/event', (session: Session, event: SessionEvent) => {
    // 只在 turn 结算点处理；中间 step 的 usage 由 fold 在整段事件里合并
    if (event.type !== 'turn/end') return

    const turn = event.data.turn
    const id = session.id
    const slice = eventsForTurn(session, turn)

    if (slice.length === 0) {
      console.warn(
        `[usage-dashboard] session ${id} turn ${turn}: 快照中找不到 turn/start…turn/end`,
      )
      return
    }

    const usage = deriveTurnTokenUsage(slice)
    if (usage === undefined) {
      console.warn(
        `[usage-dashboard] session ${id} turn ${turn}: deriveTurnTokenUsage 无结果`
        + `（无模型用量、生命周期不完整或 provider usage 字段不满足 fold 条件）`,
      )
      console.warn(
        `[usage-dashboard] 事件类型序列: ${slice.map(e => e.type).join(' → ')}`,
      )
      return
    }

    console.log('[usage-dashboard] turn usage', {
      sessionId: id,
      turn,
      ...usage,
    })
  })
}
