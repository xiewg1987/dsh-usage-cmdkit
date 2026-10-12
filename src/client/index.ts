/**
 * 浏览器半入口（Web 专用）——可读源码 / 类型说明。
 *
 * 真正给 Web 加载的是构建产物 `lib/client.js`（lazy-CJS factory）。
 * 运行：`pnpm run build:client`（把本目录打包进 factory；见 scripts/build-client.mjs）。
 *
 * 配对关系（本仓库）：
 * - Host 半：src/hello-plugin.ts（Config + greet 工具）
 * - 浏览器半：本目录 → package.json exports["./client"] → lib/client.js
 * - 槽位键：`dsh-plugin#greet` = `<包名>#<cordis.patch.yml 里的 row id>`
 * - 表单命名空间：row id `greet`（Plugins 页用 formFor(rowId) 取 configForms）
 *
 * 官方内置页走 plugins.item + configForms.whileServed；
 * 第三方组合包行应走 plugins.row.config（见 ui-plugin-manager README）。
 *
 * package.json 里 dsh.client.platform: "web" 表示只给 Web 客户端加载。
 *
 * 注意：client 半挂在「说明符恰为裸包名」的 Loader 行上。
 * patch.dev.yml 若写 name: './src/hello-plugin.ts'，则不会加载本半侧；
 * 要用 Web 卡片请 `dsh plugin add` 本包（cordis.patch.yml 已是 name: dsh-plugin）。
 */

// 仅类型：把 locale / slots / SlotMap 合并进 Context；值导入会撞上 client bundle 纯净度门禁。
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { GreetConfigCard } from './GreetConfigCard.tsx'
import { en, zh, type GreetToolLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** greet 工具配置卡片文案。 */
    greetTool: GreetToolLocaleKey
  }
}

/** 与 locales / slot 注册共用的字典命名空间。 */
export const NS = 'greetTool'

/**
 * slot 键：必须等于 `<package.json name>#<patch 行 id>`。
 * cordis.patch.yml 里 id: greet → dsh-plugin#greet。
 */
export const ROW_CONFIG_KEY = 'dsh-plugin#greet'

/** cordis fiber 注入：slots 注册 UI，locale 注册文案。 */
export const inject = ['slots', 'locale']

/**
 * 挂载 Web 配置卡片。
 * ctx 经上面的 type-only 导入合并后才有 `.locale` / `.slots`。
 * 组件签名用 PropsRuntime，不要手工窄化 props（否则会选错 register 重载）。
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-plugin: dictionaries')

  ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
    name: 'plugins.row.config',
    key: ROW_CONFIG_KEY,
    locale: NS,
  }, GreetConfigCard))
}
