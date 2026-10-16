import type { Session } from '@deepseek-ai/dsh-session'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'

/**
 * 从会话快照截取某一 turn 的 durable 事件：`turn/start` … `turn/end`（含首尾）。
 */
export function eventsForTurn(session: Session, turn: number): SessionEvent[] {
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
