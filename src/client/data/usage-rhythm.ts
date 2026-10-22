/**
 * 节律统计：用量在**时间上的形状**。
 *
 * 面板别处报的是「用了多少」——总量、命中率、四桶占比；
 * 这一层报的是「怎么用的」：
 *
 * - 工作日还是周末更费（周末 / 工作日的日均比）；
 * - 连着用了几天、有几天完全没动；
 * - 起伏有多大（峰谷比、变异系数）。
 *
 * 三条原则跟告警一样：
 *
 * 1. 数字全部来自 30 日序列，**不猜、不凑数**。
 * 2. **算不出来就返回 null**，视图不画那一块——
 *    序列太短、周末样本一个都没有的时候，宁可空着。
 * 3. 不做「建议」：这一层只描述形状，建议留给告警屏。
 */
import type { UsageDailyPoint } from '../../protocol.js'
import { dailyTotals } from './usage-metrics.js'

/** 节律统计。 */
export interface UsageRhythm {
  /** 周末日均 ÷ 工作日日均（百分数，如 62 表示周末是工作日的 62%）。 */
  weekendShare: number | null
  /** 周末日均。 */
  weekendAvg: number
  /** 工作日日均。 */
  weekdayAvg: number
  /** 连续活跃天数（从序列末尾往回数）。 */
  streak: number
  /** 完全没用量的天数。 */
  idleDays: number
  /** 峰谷比：峰值 ÷ 中位数。 */
  spread: number | null
  /** 变异系数（%）：标准差 ÷ 均值。 */
  volatility: number | null
}

/** 一串数的平均值。 */
function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/**
 * 日键是本地日历日，星期几也按**本地**算。
 *
 * `new Date('2026-10-21T00:00:00')` 按本地时区解析，
 * 跟统计文件里日键的生成口径（`usage-store` 的 `dayKeyFromMs`）一致。
 * @param day - `YYYY-MM-DD`。
 * @returns 星期几（0 = 周日）。
 */
function weekdayOf(day: string): number {
  const parsed = new Date(`${day}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? -1 : parsed.getDay()
}

/**
 * 从日序列推出节律统计。
 * @param daily - 30 日的日序列（旧→新）。
 * @returns 节律统计；算不出来的项是 null。
 */
export function deriveRhythm(daily: readonly UsageDailyPoint[]): UsageRhythm {
  const totals = dailyTotals(daily)

  // 工作日 / 周末：按本地日历日分桶。
  const weekdayValues: number[] = []
  const weekendValues: number[] = []
  for (let index = 0; index < daily.length; index += 1) {
    const weekday = weekdayOf(daily[index].day)
    if (weekday < 0) continue
    const value = totals[index] ?? 0
    if (weekday === 0 || weekday === 6) weekendValues.push(value)
    else weekdayValues.push(value)
  }

  const weekdayAvg = average(weekdayValues)
  const weekendAvg = average(weekendValues)
  // 两边都得有样本，否则这个比值没有意义。
  const weekendShare = weekdayValues.length > 0 && weekendValues.length > 0 && weekdayAvg > 0
    ? (weekendAvg / weekdayAvg) * 100
    : null

  // 连续活跃：从末尾往回数，碰到一天没用就停。
  let streak = 0
  for (let index = totals.length - 1; index >= 0; index -= 1) {
    if (totals[index] > 0) streak += 1
    else break
  }
  const idleDays = totals.filter((value) => value === 0).length

  // 峰谷比用中位数，不用平均数：
  // 平均数会被峰值自己拉高，拿它当分母算出来的「峰谷比」会偏小。
  const sorted = [...totals].sort((a, b) => a - b)
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0
  const peak = sorted.length > 0 ? sorted[sorted.length - 1] : 0
  const spread = median > 0 ? peak / median : null

  // 变异系数：把「起伏」换算成可比的百分数。
  const mean = average(totals)
  const deviation = totals.length > 0
    ? Math.sqrt(average(totals.map((value) => (value - mean) ** 2)))
    : 0
  const volatility = mean > 0 ? (deviation / mean) * 100 : null

  return {
    weekendShare,
    weekendAvg,
    weekdayAvg,
    streak,
    idleDays,
    spread,
    volatility,
  }
}
