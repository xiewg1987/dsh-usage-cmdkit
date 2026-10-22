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
import type { UsageSummary } from '../../protocol.js'
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
  /**
   * 有缓存数据但最近一次读取失败，或正在后台刷新。
   *
   * 与 `status === 'failed'` 且 `summary === undefined`（完全读不到）区分开。
   */
  readonly stale: boolean
  /** 最近一次成功读回汇总的时间（浏览器本地时钟）。 */
  readonly lastSuccessAt: number | undefined
  /** 当前时间窗。 */
  readonly range: UsageRange
  /** 清空进行中。 */
  readonly clearing: boolean
  /** 统计文件版本不兼容，禁止清空。 */
  readonly clearBlocked: boolean
}

/** 初始状态：还没读过数据，时间窗停在 30 日。 */
const initial: UsageState = {
  summary: undefined,
  status: 'loading',
  stale: false,
  lastSuccessAt: undefined,
  range: 'd30',
  clearing: false,
  clearBlocked: false,
}

let state: UsageState = initial
const listeners = new Set<() => void>()

/** 失败后再次自动读取的最小间隔（毫秒）。 */
const RETRY_MS = 5000
let lastFailedAt = 0

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

function clearBlockedFromSummary(summary: UsageSummary | undefined): boolean {
  return summary?.warning?.code === 'unsupported'
}

/**
 * 读一次用量汇总并写进共享状态。
 */
export async function loadUsage(): Promise<void> {
  inflight?.abort()
  const controller = new AbortController()
  inflight = controller
  const hadSummary = state.summary !== undefined
  if (!hadSummary) {
    commit({ status: 'loading', stale: false })
  } else {
    commit({ stale: true })
  }
  const value = await fetchUsageSummary(controller.signal)
  if (controller.signal.aborted) return
  if (value === undefined) {
    lastFailedAt = Date.now()
    if (hadSummary) {
      commit({ status: 'ready', stale: true })
    } else {
      commit({ summary: undefined, status: 'failed', stale: false, clearBlocked: false })
    }
    return
  }
  commit({
    summary: value,
    status: 'ready',
    stale: false,
    lastSuccessAt: Date.now(),
    clearBlocked: clearBlockedFromSummary(value),
  })
}

/**
 * 挂载时读一次；失败后在冷却过后允许重试（切 Tab 再回来会再调）。
 */
export function ensureUsageLoaded(): void {
  if (inflight !== undefined) return
  if (state.status === 'ready' && !state.stale && state.summary !== undefined) return
  if (state.status === 'failed' || state.stale) {
    if (Date.now() - lastFailedAt < RETRY_MS) return
  }
  void loadUsage()
}

/**
 * 请宿主清空统计，然后重新读一次。
 */
export async function clearUsage(): Promise<void> {
  if (state.clearing || state.clearBlocked) return
  commit({ clearing: true })
  const result = await clearUsageStats(new AbortController().signal)
  commit({ clearing: false })
  if (result === 'ok') await loadUsage()
}

/**
 * 切换时间窗。
 * @param range - 目标时间窗。
 */
export function setUsageRange(range: UsageRange): void {
  if (state.range === range) return
  commit({ range })
}
