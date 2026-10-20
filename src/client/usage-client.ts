/**
 * 浏览器半读 Host 用量路由的通道。
 *
 * 路由地址来自共享契约（`../protocol.js`）：客户端只认地址与响应形状，
 * 不 import Host 实现，也不读盘。
 */
import {
  USAGE_CLEAR_ROUTE,
  USAGE_SUMMARY_ROUTE,
  isUsageSummary,
  type UsageSummary,
} from '../protocol.js'

/**
 * 读一次用量汇总。
 * @param signal - 取消信号。
 * @returns 汇总；读取失败或响应形状不合法时为 undefined。
 */
export async function fetchUsageSummary(signal: AbortSignal): Promise<UsageSummary | undefined> {
  try {
    const response = await fetch(USAGE_SUMMARY_ROUTE, { signal })
    if (!response.ok) return undefined
    const value: unknown = await response.json()
    return isUsageSummary(value) ? value : undefined
  } catch {
    // 传输失败与形状不合法同义：这一轮没有可展示的数据。
    return undefined
  }
}

/**
 * 请 Host 清空统计。
 * @param signal - 取消信号。
 * @returns Host 是否确认清空。
 */
export async function clearUsageStats(signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(USAGE_CLEAR_ROUTE, { method: 'POST', signal })
    return response.ok
  } catch {
    return false
  }
}
