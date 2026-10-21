/**
 * 浏览器半的共享状态：用量数据、时间窗、快捷键环境与导航入口。
 *
 * **为什么状态要提到模块级**：命令面板是**另一个右栏 Tab**，与用量面板是两个组件
 * 实例。两边必须看到同一份数据、同一个时间窗——命令面板里「切到 30 日」要真的改到
 * 用量面板上，时间窗也要在两个 Tab 之间保持。组件里的 `useState` 做不到这件事。
 *
 * 模块级单例是安全的：浏览器半整包在页面里只加载一次（`window.__ModuleLoader__.load`），
 * 两个 Tab 共用同一个模块实例，状态天然共享。
 */
import { useSyncExternalStore } from 'react'
import type { UsageSummary } from '../protocol.js'
import { clearUsageStats, fetchUsageSummary } from './usage-client.js'

/** 可切换的时间窗。 */
export type UsageRange = 'today' | 'd7' | 'd30'

/** 面板状态：读取中 / 已有数据 / 读失败。 */
export type UsageStatus = 'loading' | 'ready' | 'failed'

/**
 * 快捷键的呈现环境。
 *
 * 取自宿主的快捷键服务：平台决定主修饰键是 ⌘ 还是 Ctrl，
 * 运行时决定要不要额外加一个 Alt（浏览器里的 Ctrl+数字 是「切标签页」）。
 */
export interface KeyStyle {
  /** 设备平台。 */
  readonly platform: 'macos' | 'windows' | 'linux'
  /** 应用外壳：浏览器里的 Web，还是桌面应用。 */
  readonly runtime: 'web' | 'desktop'
}

/** 共享状态的一份快照。 */
export interface UsageState {
  /** 最近一次读回的汇总。 */
  readonly summary: UsageSummary | undefined
  /** 读取状态。 */
  readonly status: UsageStatus
  /** 当前时间窗。 */
  readonly range: UsageRange
  /** 清空进行中。 */
  readonly clearing: boolean
  /** 快捷键的呈现环境。 */
  readonly style: KeyStyle
  /** 唤出命令面板的全局键帽（来自宿主快捷键目录，按平台渲染）。 */
  readonly paletteKeys: readonly string[]
  /** 聚焦计数：+1 表示「把键盘焦点交给命令面板的输入框」。 */
  readonly focusRequest: number
}

/** 初始状态：还没读过数据，时间窗停在 30 日。 */
const initial: UsageState = {
  summary: undefined,
  status: 'loading',
  range: 'd30',
  clearing: false,
  style: { platform: 'windows', runtime: 'web' },
  paletteKeys: [],
  focusRequest: 0,
}

let state: UsageState = initial
const listeners = new Set<() => void>()

/**
 * 写一次状态并通知订阅者。
 * @param patch - 要改的字段。
 */
function commit(patch: Partial<UsageState>): void {
  state = { ...state, ...patch }
  for (const listener of [...listeners]) listener()
}

/**
 * 订阅状态变化。
 * @param listener - 变化回调。
 * @returns 退订函数。
 */
function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/**
 * 读当前快照。
 * @returns 当前状态（引用在两次提交之间保持不变）。
 */
function snapshot(): UsageState {
  return state
}

/**
 * 订阅共享状态。
 * @returns 当前状态；变化时自动重渲染。
 */
export function useUsageState(): UsageState {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

/** 正在进行的读取；新一轮读取会中止上一轮。 */
let inflight: AbortController | undefined

/** 是否已经读过至少一次。 */
let loaded = false

/**
 * 读一次用量汇总并写进共享状态。
 * @returns 读取结束后的状态。
 */
export async function loadUsage(): Promise<void> {
  inflight?.abort()
  const controller = new AbortController()
  inflight = controller
  commit({ status: 'loading' })
  const value = await fetchUsageSummary(controller.signal)
  if (controller.signal.aborted) return
  commit({ summary: value, status: value === undefined ? 'failed' : 'ready' })
}

/**
 * 首次挂载时读一次；已经读过就不再读。
 *
 * 两个 Tab 各自挂载时都会调它，但只有第一次真的发起请求——
 * 否则命令面板与用量面板会互相把对方正在读的那次中止掉。
 */
export function ensureUsageLoaded(): void {
  if (loaded) return
  loaded = true
  void loadUsage()
}

/**
 * 请宿主清空统计，然后重新读一次。
 * @returns 清空与重读都结束后的状态。
 */
export async function clearUsage(): Promise<void> {
  if (state.clearing) return
  commit({ clearing: true })
  const cleared = await clearUsageStats(new AbortController().signal)
  commit({ clearing: false })
  if (cleared) await loadUsage()
}

/**
 * 切换时间窗。
 * @param range - 目标时间窗。
 */
export function setUsageRange(range: UsageRange): void {
  if (state.range === range) return
  commit({ range })
}

/**
 * 写入快捷键的呈现环境。
 * @param style - 平台与运行时。
 */
export function setKeyStyle(style: KeyStyle): void {
  commit({ style })
}

/**
 * 写入全局命令面板键帽。
 *
 * 键帽来自宿主的快捷键目录——那是唯一知道「这台机器上这个键到底怎么显示」的地方，
 * 插件自己拼一份会和宿主的偏好设置对不上。
 * @param keys - 键帽数组。
 */
export function setPaletteKeys(keys: readonly string[]): void {
  if (keys.length === state.paletteKeys.length && keys.every((key, index) => key === state.paletteKeys[index])) return
  commit({ paletteKeys: [...keys] })
}

/**
 * 请求命令面板把键盘焦点交给它的输入框。
 */
export function requestPaletteFocus(): void {
  commit({ focusRequest: state.focusRequest + 1 })
}

/** 导航回调：由插件入口注入，组件通过它切换右栏 Tab。 */
export interface UsageNavigator {
  /** 打开用量面板。 */
  openUsage(): void
  /** 打开命令面板。 */
  openCommands(): void
}

let navigator: UsageNavigator | undefined

/**
 * 注入导航回调。
 * @param next - 导航实现。
 */
export function setUsageNavigator(next: UsageNavigator): void {
  navigator = next
}

/** 打开用量面板；没有导航能力时什么都不做。 */
export function openUsagePanel(): void {
  navigator?.openUsage()
}

/** 打开命令面板。 */
export function openCommandPanel(): void {
  navigator?.openCommands()
}
