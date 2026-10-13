/**
 * UI 练习 — Host 半：仅 Volatile Config，供 Plugins 配置卡编辑。
 *
 * 规格：docs/02-ui-plugin-practice.md
 * 浏览器半：src/client/（待你从 archive/greet-lab 对照实现）
 * 联调 UI：dsh plugin add 本包 + pnpm dsh web（不要用仅源码的 --patch 指望看到卡片）
 */
import type { Context, Volatile } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import Schema from '@deepseek-ai/schemastery'

export interface Config {
  /** Plugins 卡片标题文案（示例字段） */
  panelTitle: Volatile<string>
  /** 是否在摘要里显示辅助说明 */
  showHelperBanner: Volatile<boolean>
}

export const Config = Schema.object({
  panelTitle: Schema.string().default('我的面板').volatile(),
  showHelperBanner: Schema.boolean().default(true).volatile(),
})

/** 与 cordis.patch.yml 行 id 一致，Client 槽位键为 dsh-plugin#ui-demo */
export const name = 'ui-demo'

export function apply(ctx: Context, config: Config): void {
  ctx.on('loader/volatile-update', () => {
    console.log(
      `[ui-demo] config: panelTitle=${config.panelTitle.get()} `
      + `showHelperBanner=${config.showHelperBanner.get()}`,
    )
  })
}
