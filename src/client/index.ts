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
 *
 * 全局标识的取名规则（详见 docs/03-remotes-and-client.md）：
 * - `TAB_ID` 是**实现身份**，取包名，全球唯一。
 * - `TAB_KIND` 是**类型判别符**，按 harness 惯例取短名（`guide` / `files` / `terminal`），
 *   **不要改名**：右栏已打开的 Tab 会把 kind 持久化下来，改名会让它们一律变成
 *   「这类内容还没有可用的查看方式」。
 * - `NS` 是 locale 字典命名空间，全局唯一，而且 `LocaleNamespaceMap` 是
 *   TypeScript 层面的**全局声明合并点**——撞名会让**对方的包**编译失败，
 *   所以带 `dsh.` 段前缀，不占用通用裸词。
 */

// 仅类型：把 locale / slots / SlotMap / shortcuts 合并进 Context；值导入会撞上 client bundle 纯净度门禁。
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the renderer's Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
// Type-only: pulls the shortcuts service's Context merge (ctx.shortcuts) 与命令 id 的品牌类型。
import type { ShortcutCatalogEntry, ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'
import type {} from '@deepseek-ai/dsh-client-shortcuts/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { UsageDashboard } from './UsageDashboard.js'
import { UsageCommands } from './UsageCommands.js'
import { UsageCommandsTitle } from './UsageCommandsTitle.js'
import { UsageTitle } from './UsageTitle.js'
import { en, zh, type UsageKey } from './locales.js'
import {
  requestPaletteFocus,
  setKeyStyle,
  setPaletteKeys,
  setUsageNavigator,
} from './usage-state.js'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** 用量 Dashboard 与命令面板的文案。 */
    'dsh.usage': UsageKey
  }
}

/**
 * 与 locales 共享的字典命名空间。
 *
 * 命名空间是**所有插件共享**的声明合并点（`LocaleNamespaceMap`），
 * 裸词 `usage` 这类通用名迟早会撞上别人——撞了会让对方的包编译失败，
 * 所以这里带 `dsh.` 段前缀。
 */
export const NS = 'dsh.usage'

/**
 * tab 类型的实现身份：body 与 title 都以它为 key 注册。
 *
 * 必须是全局唯一的实现身份；这里取包名，全球唯一且一眼可溯源。
 */
export const TAB_ID = 'dsh-usage-cmdkit'

/**
 * tab 类型（kind）：`ctx.sidebarRight.openTab('usage-dashboard')` 用它开页。
 *
 * kind 是「类型判别符」而非实现身份，harness 侧一律取短名
 * （`guide` / `files` / `terminal` / `plan`），本值沿用同一惯例。
 *
 * **不要改名**：右栏每个已打开的 Tab 都把 kind 记在会话的持久化状态里，
 * 改了名，旧 Tab 会找不到在册的类型，一律显示「这类内容还没有可用的查看方式」。
 */
export const TAB_KIND = 'usage-dashboard'

/** 命令面板那一面的实现身份。 */
export const TAB_ID_COMMANDS = 'dsh-usage-cmdkit-commands'

/** 命令面板那一面的类型判别符。 */
export const TAB_KIND_COMMANDS = 'usage-commands'

/**
 * 全局命令面板快捷键的命令 id。
 *
 * 走**宿主快捷键目录**（`ctx.shortcuts.register`），不自己监听 window：
 * 宿主已经把 ⌘K 派给了「搜索会话」，插件再抢同一个键，两个面板会同时响应。
 * 这一枚另取一个没被占用的键，并且能被用户在自己的快捷键设置里改掉。
 */
export const PALETTE_COMMAND_ID = 'dsh.usage.palette' as ShortcutCommandId

/** 依赖的服务：slot 注册、locale 字典、右栏 tab 注册表、快捷键目录。 */
export const inject = ['slots', 'locale', 'sidebarRight', 'sidebarRightTabs', 'shortcuts']

/**
 * 挂载右栏用量 Tab 与命令面板 Tab。
 * @param ctx - 浏览器根上下文。
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-usage-cmdkit: dictionaries')

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
  }), 'dsh-usage-cmdkit: sidebar type')

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: TAB_ID_COMMANDS,
    kind: TAB_KIND_COMMANDS,
    title: () => t('tab.commands'),
    guide: [{
      id: 'default',
      order: 51,
      title: () => t('tab.commands'),
      description: () => t('tab.commands.description'),
    }],
  }), 'dsh-usage-cmdkit: commands sidebar type')

  // 两个 Tab 共用一个 slot 名，按 key 分开登记：
  // keyed slot 的 key 就是各自的实现身份（TAB_ID）。
  ctx.slots.inject('sidebar.right.pane.tab', () => {
    const disposeUsage = ctx.slots.register({
      name: 'sidebar.right.pane.tab', key: TAB_ID, locale: NS,
    }, UsageDashboard)
    const disposeCommands = ctx.slots.register({
      name: 'sidebar.right.pane.tab', key: TAB_ID_COMMANDS, locale: NS,
    }, UsageCommands)
    return () => { disposeUsage(); disposeCommands() }
  })
  ctx.slots.inject('sidebar.right.pane.tab.title', () => {
    const disposeUsage = ctx.slots.register({
      name: 'sidebar.right.pane.tab.title', key: TAB_ID, locale: NS,
    }, UsageTitle)
    const disposeCommands = ctx.slots.register({
      name: 'sidebar.right.pane.tab.title', key: TAB_ID_COMMANDS, locale: NS,
    }, UsageCommandsTitle)
    return () => { disposeUsage(); disposeCommands() }
  })

  // 快捷键的呈现环境：平台决定 ⌘ 还是 Ctrl，运行时决定要不要多一个 Alt。
  setKeyStyle({ platform: ctx.shortcuts.platform, runtime: ctx.shortcuts.runtime })

  /**
   * 打开右栏的某个 Tab。
   *
   * 右栏没有挂载会话时 `openTab` 会抛错——那是宿主的状态，不是异常，
   * 所以这里吞掉，调用方自己决定要不要提示。
   * @param kind - Tab 的类型判别符。
   */
  const open = (kind: string): void => {
    try {
      ctx.sidebarRight.openTab(kind)
    } catch {
      // 没有挂载的会话：右栏此刻开不了页。
    }
  }

  setUsageNavigator({
    openUsage: () => { open(TAB_KIND) },
    openCommands: () => { open(TAB_KIND_COMMANDS); requestPaletteFocus() },
  })

  ctx.effect(() => ctx.shortcuts.register({
    id: PALETTE_COMMAND_ID,
    label: () => t('cmd.palette'),
    aliases: ['command palette', 'usage commands', '命令面板'],
    defaults: {
      'desktop:macos': { code: 'KeyJ', modifiers: ['primary'] },
      'desktop:windows': { code: 'KeyJ', modifiers: ['primary'] },
      'desktop:linux': { code: 'KeyJ', modifiers: ['primary'] },
      // 浏览器里用主修饰键 + Alt：Ctrl+数字 是「切标签页」，会跟浏览器打架。
      'web:macos': { code: 'KeyJ', modifiers: ['primary', 'alt'] },
      'web:windows': { code: 'KeyJ', modifiers: ['primary', 'alt'] },
    },
    regions: ['page', 'editable'],
    modals: [],
    resolve: () => {
      if (ctx.sidebarRight.mounted.getSnapshot() === undefined) {
        return { status: 'blocked', reason: t('cmd.noSession') }
      }
      return { status: 'handled', run: () => { open(TAB_KIND_COMMANDS); requestPaletteFocus() } }
    },
  }), 'dsh-usage-cmdkit: palette shortcut')

  // 键帽从宿主目录读：那是唯一知道「这台机器上这枚键怎么显示」的地方，
  // 也包含用户自己在设置里改过的绑定。
  ctx.effect(() => {
    const sync = (): void => {
      const row = ctx.shortcuts.catalog.getSnapshot()
        .find((entry: ShortcutCatalogEntry) => entry.id === PALETTE_COMMAND_ID)
      setPaletteKeys(row?.keys ?? [])
    }
    sync()
    return ctx.shortcuts.catalog.subscribe(sync)
  }, 'dsh-usage-cmdkit: palette keycaps')
}
