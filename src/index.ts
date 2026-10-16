/**
 * Usage Dashboard — Host 半。
 * Phase A/B：session/event hook、usage-stats.json、remotes（见 README.md）。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'

/** 与 cordis.patch.yml 行 id 一致；Client 槽位键为 `<包名>#usage-dashboard` */
export const name = 'usage-dashboard'

export function apply(_ctx: Context): void {
  // TODO Phase A: ctx.on('session/event', …) → 累加并写 usage-stats.json
}
