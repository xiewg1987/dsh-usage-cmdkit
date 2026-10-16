/**
 * Usage Dashboard — Host 半。
 * 步骤 1：turn/end + deriveTurnTokenUsage；步骤 2：merge 写入 usage-stats.json。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type { Session } from '@deepseek-ai/dsh-session'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import { deriveTurnTokenUsage } from '@deepseek-ai/dsh-token-meter/client'
import { eventsForTurn } from './turn-events.js'
import { persistTurnUsage } from './usage-store.js'

/** 与 cordis.patch.yml 行 id 一致 */
export const name = 'usage-dashboard'

export function apply(ctx: Context): void {
  ctx.on('session/event', (session: Session, event: SessionEvent) => {
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

    // 步骤 2：按 turn 结束时刻的本地日写入 profile 下 JSON
    void persistTurnUsage(usage, event.time).then(({ path, dayKey, file }) => {
      const day = file.days[dayKey]?.total
      console.log('[usage-dashboard] 已写入', path, {
        dayKey,
        dayTotal: day,
      })
    }).catch((error: unknown) => {
      console.error('[usage-dashboard] 写入 usage-stats.json 失败', error)
    })
  })
}
