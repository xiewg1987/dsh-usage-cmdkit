/**
 * Client 学习用 — Host 半（最小）。
 *
 * 仅提供 Volatile Config，供浏览器半配置卡读写。
 * 规格：docs/02-client-learning.md
 */
import type { Context, Volatile } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import Schema from '@deepseek-ai/schemastery'

export interface Config {
  panelTitle: Volatile<string>
  showHelperBanner: Volatile<boolean>
}

export const Config = Schema.object({
  panelTitle: Schema.string().default('我的面板').volatile(),
  showHelperBanner: Schema.boolean().default(true).volatile(),
})

/** patch 行 id；Client 槽位键 dsh-plugin#ui-demo */
export const name = 'ui-demo'

export function apply(ctx: Context, config: Config): void {
  ctx.on('loader/volatile-update', () => {
    console.log(
      `[ui-demo] config: panelTitle=${config.panelTitle.get()} `
      + `showHelperBanner=${config.showHelperBanner.get()}`,
    )
  })
}
