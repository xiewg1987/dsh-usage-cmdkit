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
import type { UsageBuckets, UsageDailyPoint, UsageProviderDaily, UsageProviderTotal } from '../../protocol.js'

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

/** 一个模型的命中率与它占窗口的份额。 */
export interface ModelHitRate {
  /** 该模型的用量（provider/model）。 */
  provider: UsageProviderTotal
  /** 命中率（0–1）。 */
  rate: number
  /** 四桶总和。 */
  total: number
  /** 占窗口总量的百分比（0–100）。 */
  share: number
}

/**
 * 每个模型各自算一遍缓存命中率。
 *
 * 全局命中率是**加权平均**：量大的模型说了算。
 * 但真正该关心的是「量跑在哪儿」——一个只占 5% 的模型命中再低也无所谓，
 * 一个扛着 30% 的量却命中最低，它就是最该修的那一个。
 * 所以这里按模型拆开，让面板能单独说这件事。
 * @param providers - 按 provider/model 的拆分。
 * @param windowTotal - 当前窗口的总量（四桶之和）。
 * @returns 每个模型的命中率与份额，顺序跟 `providers` 一致。
 */
export function modelHitRates(
  providers: readonly UsageProviderTotal[],
  windowTotal: number,
): ModelHitRate[] {
  return providers.map((provider) => {
    const total = provider.uncachedInputTokens
      + provider.outputTokens
      + provider.cacheReadTokens
      + provider.cacheWriteTokens
    return {
      provider,
      rate: hitRate(provider),
      total,
      share: windowTotal > 0 ? (total / windowTotal) * 100 : 0,
    }
  })
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

/** 一个模型在窗口里的份额变化。 */
export interface ModelShareShift {
  /** provider/model 的显示名。 */
  label: string
  /** 近 7 日的份额（0–100）。 */
  shareNow: number
  /** 前 7 日的份额（0–100）。 */
  shareBefore: number
  /**
   * 份额变化（百分点）。
   *
   * 正数 = 在抢份额，负数 = 在让份额。
   * 数据不够（不足 14 天）时是 null——**比不出来就不给数**。
   */
  shift: number | null
  /** 该模型 30 日的每日总量（旧→新），用来画微折线。 */
  series: number[]
}

/** 比份额时用几天的窗口。 */
const SHARE_SPAN = 7

/**
 * 每个模型各自算一遍「份额在变还是在退」。
 *
 * `byProvider` 只给 30 日合计，看不出谁在涨谁在退。
 * 这一层拿逐日序列比**近 7 日 vs 前 7 日**的份额：
 * 份额变了，才叫迁移；总量同时在涨的模型，份额变化会被稀释，
 * 那不是「它在退」，而是「大家都在涨」——两个数摆在一起才看得出来。
 *
 * 份额是**相对**的：所有模型的份额加起来是 100%，
 * 所以一个模型涨份额，别的模型必然让出份额。
 * @param dailyByProvider - 每个 provider/model 的逐日序列。
 * @returns 每个模型的份额变化与日序列；顺序跟输入一致。
 */
export function modelShareShift(dailyByProvider: readonly UsageProviderDaily[]): ModelShareShift[] {
  const totalOf = (point: UsageDailyPoint): number =>
    point.uncachedInputTokens + point.outputTokens + point.cacheReadTokens + point.cacheWriteTokens

  /** 每个模型的每日总量。 */
  const seriesOf = dailyByProvider.map((entry) => entry.daily.map(totalOf))
  /** 近 7 日与前 7 日的总量（所有模型加起来）。 */
  let recentAll = 0
  let previousAll = 0
  const length = seriesOf.reduce((max, series) => Math.max(max, series.length), 0)
  const canCompare = length >= SHARE_SPAN * 2

  for (const series of seriesOf) {
    if (canCompare) {
      for (let index = length - SHARE_SPAN; index < length; index += 1) {
        recentAll += series[index] ?? 0
      }
      for (let index = length - SHARE_SPAN * 2; index < length - SHARE_SPAN; index += 1) {
        previousAll += series[index] ?? 0
      }
    }
  }

  return dailyByProvider.map((entry, modelIndex) => {
    const series = seriesOf[modelIndex] ?? []
    let recent = 0
    let previous = 0
    if (canCompare) {
      for (let index = length - SHARE_SPAN; index < length; index += 1) recent += series[index] ?? 0
      for (let index = length - SHARE_SPAN * 2; index < length - SHARE_SPAN; index += 1) {
        previous += series[index] ?? 0
      }
    }
    const shareNow = recentAll > 0 ? (recent / recentAll) * 100 : 0
    const shareBefore = previousAll > 0 ? (previous / previousAll) * 100 : 0
    return {
      label: `${entry.provider}${entry.model.length > 0 ? ` / ${entry.model}` : ''}`,
      shareNow,
      shareBefore,
      // 两边都得有用量才比得了：前 7 日一点用量都没有时，
      // 「份额」根本无从谈起，算出来的 +100 是假数。
      shift: canCompare && recentAll > 0 && previousAll > 0 ? shareNow - shareBefore : null,
      series,
    }
  })
}
