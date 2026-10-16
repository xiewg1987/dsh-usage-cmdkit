/**
 * Usage Dashboard — Host 半。
 * 实施顺序见 docs/README.md；当前步骤 1：docs/01-collect-usage-stats.md
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'

/** 与 cordis.patch.yml 行 id 一致；Client 槽位键为 `<包名>#usage-dashboard` */
export const name = 'usage-dashboard'

export function apply(_ctx: Context): void {
  // TODO 步骤 1: session/event → deriveTurnTokenUsage → log（见 docs/01-collect-usage-stats.md）
}
