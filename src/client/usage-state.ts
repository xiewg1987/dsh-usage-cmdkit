/**
 * 浏览器半的共享状态：用量数据、时间窗与清空状态。
 *
 * **为什么状态住在模块级**：右栏的 Tab 会被宿主随时卸载/重挂——
 * 用户切到别的 Tab 再切回来，面板会重新挂载一次。
 * 状态放在模块级单例里，数据就留在原地：
 * 切回来时不用再读一遍，也就不会闪一下「正在读取」。
 *
 * 模块级单例是安全的：浏览器半整包在页面里只加载一次（`window.__ModuleLoader__.load`），
 * 同一份模块实例贯穿整个页面。
 */
import { useSyncExternalStore } from 'react'
import type { UsageSummary } from '../protocol.js'
import { clearUsageStats, fetchUsageSummary } from './usage-client.js'

/** 可切换的时间窗。 */
export type UsageRange = 'today' | 'd7' | 'd30'

/** 面板状态：读取中 / 已有数据 / 读失败。 */
export type UsageStatus = 'loading' | 'ready' | 'failed'

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
}

/** 初始状态：还没读过数据，时间窗停在 30 日。 */
const initial: UsageState = {
  summary: undefined,
  status: 'loading',
  range: 'd30',
  clearing: false,
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
 * 面板被重挂（切 Tab 切回来）时再调它一次，但只有第一次真的发起请求。
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
