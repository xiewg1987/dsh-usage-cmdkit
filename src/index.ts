/**
 * Usage Dashboard — Host 半。
 *
 * 步骤 1：turn/end + deriveTurnTokenUsage；
 * 步骤 2：merge 写入 usage-stats.json；
 * 步骤 3：把聚合结果通过 Connection 的认证路由暴露给浏览器半。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type { Session } from '@deepseek-ai/dsh-session'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import { deriveTurnTokenUsage } from '@deepseek-ai/dsh-token-meter/client'
import { registerUsageRoutes } from './host-routes.js'
import { TurnCollector } from './turn-events.js'
import { persistTurnUsage } from './usage-store.js'

/**
 * Cordis 插件名：日志与 fiber 诊断用的显示名。
 *
 * 与 cordis.patch.yml 的行 id 取同一个值（都是包名），
 * 这样从日志反查插件、或者从 profile 里按 id 找行，都是同一个词。
 */
export const name = 'dsh-usage-dashboard'

/**
 * Host 半没有必需的服务。
 *
 * 用量采集在所有形态下都该发生（包括没有 Web 外壳的形态），
 * 所以这里不把 Connection 列为插件级依赖。
 */
export const inject: string[] = []

export function apply(ctx: Context): void {
  // 路由要挂在 Connection 的认证通道里。Connection 不存在时（例如没有 Web 外壳的形态）
  // 就没有路由，但采集与落盘照常进行。
  ctx.inject(['connection'], (child) => {
    registerUsageRoutes(child)
  })

  // 每个会话一个 turn 缓冲：在事件流上攒，不回读会话历史。
  const collector = new TurnCollector()

  ctx.on('session/event', (session: Session, event: SessionEvent) => {
    const slice = collector.push(session.id, event)
    if (event.type !== 'turn/end') return

    const id = session.id
    const turn = event.data.turn

    if (slice === undefined) {
      console.warn(
        `[dsh-usage-dashboard] session ${id} turn ${turn}: 未收集到 turn/start…turn/end`
        + '（插件加载晚于该 turn 起点，或该 turn 已在加载前结束）',
      )
      return
    }

    const usage = deriveTurnTokenUsage(slice)
    if (usage === undefined) {
      console.warn(
        `[dsh-usage-dashboard] session ${id} turn ${turn}: deriveTurnTokenUsage 无结果`
        + '（无模型用量、生命周期不完整或 provider usage 字段不满足 fold 条件）',
      )
      console.warn(
        `[dsh-usage-dashboard] 事件类型序列: ${slice.map(e => e.type).join(' → ')}`,
      )
      return
    }

    console.log('[dsh-usage-dashboard] turn usage', {
      sessionId: id,
      turn,
      ...usage,
    })

    // 步骤 2：按 turn 结束时刻的本地日写入 profile 下 JSON
    void persistTurnUsage(usage, event.time).then(({ path, dayKey, file }) => {
      const day = file.days[dayKey]?.total
      console.log('[dsh-usage-dashboard] 已写入', path, {
        dayKey,
        dayTotal: day,
      })
    }).catch((error: unknown) => {
      console.error('[dsh-usage-dashboard] 写入 usage-stats.json 失败', error)
    })
  })
}
