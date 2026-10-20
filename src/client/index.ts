/**
 * 浏览器半入口（Web 专用）——可读源码 / 类型说明。
 *
 * 真正给 Web 加载的是构建产物 `lib/client.js`（lazy-CJS factory）。
 * 运行：`pnpm run build:client`（把本目录打包进 factory；见 scripts/build-client.mjs）。
 *
 * 配对关系（本仓库）：
 * - Host 半：src/index.ts（采集 + 落盘 + 认证路由）
 * - 浏览器半：本目录 → package.json exports["./client"] → lib/client.js
 * - 槽位键：`sidebar.right.pane.tab` / `sidebar.right.pane.tab.title`，key 为 TAB_ID
 *
 * 数据通道：浏览器用同源 `fetch` 读 Host 在 Connection 认证通道里注册的
 * `/api/usage.summary` 与 `/api/usage.clear`（见 src/host-routes.ts）。
 * 官方 `ctx.remote.<namespace>` 通道对第三方插件是关闭的：
 * 它的客户端装配是 harness 内部包的静态清单，第三方包加不进去。
 *
 * 注意：client 半挂在「说明符恰为裸包名」的 Loader 行上。
 * patch.dev.yml 若写 name: './src/index.ts'，则不会加载本半侧；
 * 要用右栏 Dashboard 请 `dsh plugin add` 本包（cordis.patch.yml 已是裸包名）。
 */

// 仅类型：把 locale / slots / SlotMap 合并进 Context；值导入会撞上 client bundle 纯净度门禁。
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the renderer's Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { UsageDashboard } from './UsageDashboard.js'
import { UsageTitle } from './UsageTitle.js'
import { en, zh, type UsageKey } from './locales.js'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** 用量 Dashboard 的文案。 */
    usage: UsageKey
  }
}

/** 与 locales 共享的字典命名空间。 */
export const NS = 'usage'

/**
 * tab 类型的实现身份：body 与 title 都以它为 key 注册。
 *
 * 必须是全局唯一的实现身份（包名是自然取值），kind 则只是类型判别符。
 */
export const TAB_ID = 'dsh-usage-dashboard'

/** tab 类型（kind）：`ctx.sidebarRight.openTab('usage-dashboard')` 用它开页。 */
export const TAB_KIND = 'usage-dashboard'

/** 依赖的服务：slot 注册、locale 字典、右栏 tab 注册表。 */
export const inject = ['slots', 'locale', 'sidebarRight', 'sidebarRightTabs']

/**
 * 挂载右栏用量 Tab。
 * @param ctx - 浏览器根上下文。
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-usage-dashboard: dictionaries')

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: TAB_ID,
    kind: TAB_KIND,
    title: () => t('tab.title'),
    guide: [{
      id: 'default',
      order: 50,
      title: () => t('tab.title'),
      description: () => t('tab.description'),
    }],
  }), 'dsh-usage-dashboard: sidebar type')

  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab', key: TAB_ID, locale: NS,
  }, UsageDashboard))
  ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title', key: TAB_ID, locale: NS,
  }, UsageTitle))
}
