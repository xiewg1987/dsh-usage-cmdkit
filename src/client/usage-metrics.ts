/**
 * 用量指标：从四桶 token 算出面板要显示的比率。
 *
 * 这里**只做算术，不做估价**。
 *
 * 曾经有一份「花费估算」：内置一张公开费率表，把四桶 token 折成美元。
 * 它被删掉了——费率随时在变、合同价因人而异，
 * 面板上摆一个带 `≈` 的金额，看起来像账单，其实只是个量级猜测，
 * 猜错了还要背锅。**本插件只报 token，不报钱。**
 */
import type { UsageBuckets, UsageDailyPoint } from '../protocol.js'

/**
 * 缓存命中率：缓存读取占「输入总量」的比例。
 *
 * 口径是 `cacheRead / (uncachedInput + cacheRead)`——
 * 只看输入侧，输出不参与分母。
 * @param buckets - 四桶用量。
 * @returns 0–1 的比率。
 */
export function hitRate(buckets: UsageBuckets): number {
  const input = buckets.uncachedInputTokens + buckets.cacheReadTokens
  if (input <= 0) return 0
  return buckets.cacheReadTokens / input
}

/** 一串数的平均值。 */
function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/**
 * 日序列的每日总量：从旧到新。
 * @param daily - 30 日的日序列。
 * @returns 每天四桶加起来的一串数。
 */
export function dailyTotals(daily: readonly UsageDailyPoint[]): number[] {
  return daily.map((point) =>
    point.uncachedInputTokens + point.outputTokens + point.cacheReadTokens + point.cacheWriteTokens,
  )
}

/**
 * 每桶自己的日序列：从旧到新，与 `keys` 同序。
 * @param daily - 30 日的日序列。
 * @param keys - 要取的桶。
 * @returns 每个桶一条序列。
 */
export function dailySeries(
  daily: readonly UsageDailyPoint[],
  keys: readonly (keyof UsageBuckets)[],
): number[][] {
  return keys.map((key) => daily.map((point) => point[key]))
}

/**
 * 涨跌：当前窗口的日均，跟前一个等长窗口的日均比。
 *
 * 30 日窗没有 60 天可比，就退成「后 15 天 vs 前 15 天」。
 * **比不出来就返回 null**——空的标签比没有标签更让人分心，
 * 与其画一个假箭头，不如什么都不画。
 * @param daily - 30 日的日序列。
 * @param days - 当前窗口覆盖的天数。
 * @returns 变化百分比；没有可比数据时是 null。
 */
export function windowDelta(daily: readonly UsageDailyPoint[], days: number): number | null {
  const totals = dailyTotals(daily)
  const half = Math.floor(totals.length / 2)
  const span = days >= half ? half : days
  const recent = totals.slice(-span)
  const previous = totals.slice(-span * 2, -span)
  if (recent.length === 0 || previous.length === 0) return null
  const previousAvg = average(previous)
  if (previousAvg <= 0) return null
  return ((average(recent) - previousAvg) / previousAvg) * 100
}

/**
 * 涨跌签的副文案：1 天比「较昨日」，更长比「较前 N 天」。
 * @param days - 当前窗口覆盖的天数。
 * @param span - 实际比的是多少天。
 * @param labels - 文案表。
 * @returns 副文案。
 */
export function deltaLabel(days: number, span: number, labels: { day: string; span: (n: number) => string }): string {
  return days <= 1 ? labels.day : labels.span(span)
}
