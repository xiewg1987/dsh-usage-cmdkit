/**
 * 告警：从日序列与四桶用量里**推**出来的几条提醒。
 *
 * 面板只报 token、不报钱（见 `usage-metrics.ts` 的说明），
 * 那告警也不能是「预计花费超过 $X」——这里推的是**用量的异常形状**：
 * 哪天冲到了窗口高点、哪一桶的占比开始往上爬、哪一桶的增速掉队了。
 *
 * 三条原则：
 *
 * 1. **每条告警的数字都来自真实序列**，不写死。
 *    文案里的日期、百分比、占比都是算出来的。
 * 2. **不凑数**。触发条件不满足就少一条，没有就零条——
 *    空列表比假告警诚实（面板是本机记录，给出「其实没事」是合法结论）。
 * 3. **分级要能解释**：`high` 是「明显异常」，`med` 是「值得看一眼」，
 *    `low` 是「苗头」。阈值都写在下面，改一处就够。
 */
import type { UsageBuckets, UsageDailyPoint } from '../../protocol.js'
import { formatCompact } from '../theme/usage-theme.js'

/** 告警级别。 */
export type UsageAlertLevel = 'high' | 'med' | 'low'

/** 告警的种类：决定文案与详情里那几组数字。 */
export type UsageAlertKind = 'peak' | 'uncached' | 'cacheWrite' | 'output'

/** 一条告警。 */
export interface UsageAlert {
  /** 种类：视图按它挑标题与详情。 */
  kind: UsageAlertKind
  /** 级别。 */
  level: UsageAlertLevel
  /**
   * 触发日距今天几天（0 = 今天）。
   *
   * 峰值告警说的是某一天的事，所以带天数；
   * 窗口级的那几条是**此刻**算出来的，恒为 0。
   */
  ago: number
  /** 详情里的参数（数字已经格式化好，视图只管填模板）。 */
  params: Record<string, string>
  /**
   * 量级条的长度（0–1）。
   *
   * 不是占比，是「这条告警的量级走到阈值的多少」：
   * 同一类告警之间能横向比较，不同类之间只表示「这条不小」。
   */
  ratio: number
}

/** 推导告警需要的输入。 */
export interface UsageAlertInput {
  /** 30 日的日序列（旧→新）。 */
  daily: readonly UsageDailyPoint[]
  /** 当前时间窗的四桶用量。 */
  buckets: UsageBuckets
  /** 当前时间窗的总量。 */
  total: number
}

/** 阈值集中在这里：想调松紧，改这一处就够。 */
const THRESHOLD = {
  /** 峰值比日均高过多少个百分点才报（%）。 */
  peakOver: 15,
  /** 峰值告警升到 `high` 的门槛（%）。 */
  peakHigh: 30,
  /** 未缓存输入占比达到多少才报（%）。 */
  uncachedShare: 30,
  /** 未缓存输入 7 日涨幅达到多少才报（%）。 */
  uncachedChange: 5,
  /** 未缓存输入占比升到 `high` 的门槛（%）。 */
  uncachedHigh: 45,
  /** 缓存写入占比达到多少才报（%）。 */
  cacheWriteShare: 8,
  /** 缓存写入 7 日涨幅达到多少才报（%）。 */
  cacheWriteChange: 8,
  /** 缓存写入涨幅升到 `med` 的门槛（%）。 */
  cacheWriteMed: 10,
  /** 输出增速落后总量多少个百分点才报（百分点）。 */
  outputGap: 5,
  /** 输出落后升到 `med` 的门槛（百分点）。 */
  outputMed: 15,
} as const

/** 一串数的平均值。 */
function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** 带符号的百分比：`+19.8%` / `-3.6%`。 */
function signed(percent: number): string {
  const rounded = percent.toFixed(1)
  return `${percent >= 0 ? '+' : ''}${rounded}%`
}

/**
 * 某个桶近 7 日相对前 7 日的涨幅（%）。
 * @param daily - 日序列。
 * @param key - 要算的桶；传 null 表示四桶合计。
 * @returns 涨幅百分比；数据不够时是 null。
 */
function weekChange(daily: readonly UsageDailyPoint[], key: keyof UsageBuckets | null): number | null {
  if (daily.length < 14) return null
  const sum = (from: number, to: number): number => {
    let total = 0
    for (const point of daily.slice(from, to)) {
      total += key === null
        ? point.uncachedInputTokens + point.outputTokens + point.cacheReadTokens + point.cacheWriteTokens
        : point[key]
    }
    return total
  }
  const recent = sum(daily.length - 7, daily.length)
  const previous = sum(daily.length - 14, daily.length - 7)
  if (previous <= 0) return null
  return ((recent - previous) / previous) * 100
}

/** `YYYY-MM-DD` → `MM-DD`（面板上只显示月日）。 */
function shortDay(day: string): string {
  const parts = day.split('-')
  if (parts.length < 3) return day
  return `${parts[1]}-${parts[2]}`
}

/**
 * 推导出当前窗口的告警列表。
 *
 * 顺序即严重度：先 `high` 再 `med` 最后 `low`，同级按触发顺序。
 * @param input - 日序列、四桶用量与总量。
 * @returns 告警列表（可能为空）。
 */
export function deriveAlerts(input: UsageAlertInput): UsageAlert[] {
  const { daily, buckets, total } = input
  const alerts: UsageAlert[] = []
  if (daily.length === 0 || total <= 0) return alerts

  // 峰值：哪天冲到了窗口高点。
  const totals = daily.map((point) =>
    point.uncachedInputTokens + point.outputTokens + point.cacheReadTokens + point.cacheWriteTokens,
  )
  const avg = average(totals)
  const peak = Math.max(...totals)
  const peakIndex = totals.indexOf(peak)
  const peakOver = avg > 0 ? ((peak - avg) / avg) * 100 : 0
  if (peakOver >= THRESHOLD.peakOver) {
    alerts.push({
      kind: 'peak',
      level: peakOver >= THRESHOLD.peakHigh ? 'high' : 'med',
      ago: Math.max(0, totals.length - 1 - peakIndex),
      params: {
        day: shortDay(daily[peakIndex].day),
        value: formatCompact(peak),
        pct: peakOver.toFixed(0),
      },
      ratio: Math.min(1, peakOver / 50),
    })
  }

  // 未缓存输入：占比高 + 还在涨。
  const uncachedShare = (buckets.uncachedInputTokens / total) * 100
  const uncachedChange = weekChange(daily, 'uncachedInputTokens')
  if (
    uncachedShare >= THRESHOLD.uncachedShare
    && uncachedChange !== null
    && uncachedChange >= THRESHOLD.uncachedChange
  ) {
    alerts.push({
      kind: 'uncached',
      level: uncachedShare >= THRESHOLD.uncachedHigh ? 'high' : 'med',
      ago: 0,
      params: { pct: `${uncachedShare.toFixed(0)}%`, chg: signed(uncachedChange) },
      ratio: Math.min(1, uncachedShare / 50),
    })
  }

  // 缓存写入：占比不大，但涨得快。
  const writeShare = (buckets.cacheWriteTokens / total) * 100
  const writeChange = weekChange(daily, 'cacheWriteTokens')
  if (
    writeShare >= THRESHOLD.cacheWriteShare
    && writeChange !== null
    && writeChange >= THRESHOLD.cacheWriteChange
  ) {
    alerts.push({
      kind: 'cacheWrite',
      level: writeChange >= THRESHOLD.cacheWriteMed ? 'med' : 'low',
      ago: 0,
      params: { pct: writeShare.toFixed(1), chg: signed(writeChange) },
      ratio: Math.min(1, writeChange / 30),
    })
  }

  // 输出：总量在涨，它没跟上。
  const outputChange = weekChange(daily, 'outputTokens')
  const totalChange = weekChange(daily, null)
  if (outputChange !== null && totalChange !== null) {
    const gap = totalChange - outputChange
    if (gap >= THRESHOLD.outputGap) {
      alerts.push({
        kind: 'output',
        level: gap >= THRESHOLD.outputMed ? 'med' : 'low',
        ago: 0,
        params: { chg: signed(outputChange), total: signed(totalChange) },
        ratio: Math.min(1, gap / 20),
      })
    }
  }

  const order: Record<UsageAlertLevel, number> = { high: 0, med: 1, low: 2 }
  return alerts.sort((a, b) => order[a.level] - order[b.level])
}
