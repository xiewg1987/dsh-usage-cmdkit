/**
 * Host 与 Client 共享的用量契约。
 *
 * 这一层只有常量与类型：Client 通过它知道路由地址与响应形状，
 * 但 **不** import Host 实现，也 **不** 直读磁盘。
 */

/** 与 Web「本轮用量」一致的四桶 token 计数。 */
export interface UsageBuckets {
  /** 未命中缓存的输入 token。 */
  uncachedInputTokens: number
  /** 输出 token。 */
  outputTokens: number
  /** 缓存读取 token。 */
  cacheReadTokens: number
  /** 缓存写入 token。 */
  cacheWriteTokens: number
}

/** 一个 provider/model 的累计用量。 */
export interface UsageProviderTotal extends UsageBuckets {
  provider: string
  model: string
}

/**
 * 一天的用量：四桶 + 本地日历日。
 *
 * 没有这一层，客户端只有三个窗口的合计，画不出趋势；
 * 有它就能画日折线、行内微型 sparkline，并算出「今日 vs 昨日」。
 */
export interface UsageDailyPoint extends UsageBuckets {
  /** 本地日历日 `YYYY-MM-DD`。 */
  day: string
}

/**
 * 一个 provider/model 的逐日序列。
 *
 * `byProvider` 只给 30 日的**合计**——看不出这个模型是在涨还是在退。
 * 这一层把每天的用量也带上，才能算出「谁在抢份额」。
 */
export interface UsageProviderDaily {
  provider: string
  model: string
  /**
   * 近 30 个日历日的每日四桶，**从旧到新**。
   *
   * 与 `UsageSummary.daily` **同长同序**（同一天下标对齐），
   * 缺记录的日子补零——与全局日序列同一套规矩。
   */
  daily: UsageDailyPoint[]
}

/** 汇总响应：三个时间窗的总量 + 按 provider 的拆分 + 日序列。 */
export interface UsageSummary {
  /** 今日（宿主本地日历日）。 */
  today: UsageBuckets
  /** 近 7 个日历日（含今日）。 */
  d7: UsageBuckets
  /** 近 30 个日历日（含今日）。 */
  d30: UsageBuckets
  /** 近 30 日按 provider/model 的拆分，按总量从大到小。 */
  byProvider: UsageProviderTotal[]
  /**
   * 近 30 个日历日的日序列，**从旧到新**。
   *
   * 没有记录的日子补零——折线要看见「那天没用量」，
   * 跳过空日会把断档画成直线，看不出真实起伏。
   */
  daily: UsageDailyPoint[]
  /**
   * 每个 provider/model 的逐日序列，按总量从大到小。
   *
   * 与 `byProvider` 一一对应（同一个模型就在同一位置），
   * 多了时间维度：模型之间「谁在涨、谁在退」只有这一层能算。
   */
  dailyByProvider: UsageProviderDaily[]
  /** 汇总生成时刻（毫秒时间戳）。 */
  generatedAt: number
}

/** 汇总路由：服务端路由键（绝对路径）。 */
export const USAGE_SUMMARY_PATH = '/api/usage.summary'

/** 清空路由：服务端路由键（绝对路径）。 */
export const USAGE_CLEAR_PATH = '/api/usage.clear'

/**
 * 浏览器相对形式（去掉前导斜杠）。
 *
 * Web 外壳的文档自带 `<base href="./">`，浏览器引用要相对文档解析，
 * 这样同一份 bundle 在源站根与任意挂载下都成立。
 */
export const USAGE_SUMMARY_ROUTE = USAGE_SUMMARY_PATH.slice(1)

/** 浏览器相对形式的清空路由。 */
export const USAGE_CLEAR_ROUTE = USAGE_CLEAR_PATH.slice(1)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isBuckets(value: unknown): value is UsageBuckets {
  if (!isRecord(value)) return false
  return isCount(value.uncachedInputTokens)
    && isCount(value.outputTokens)
    && isCount(value.cacheReadTokens)
    && isCount(value.cacheWriteTokens)
}

function isProviderTotal(value: unknown): value is UsageProviderTotal {
  return isBuckets(value)
    && typeof (value as UsageProviderTotal).provider === 'string'
    && typeof (value as UsageProviderTotal).model === 'string'
}

/** 日键的形状：`YYYY-MM-DD`。 */
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function isDailyPoint(value: unknown): value is UsageDailyPoint {
  return isBuckets(value)
    && typeof (value as UsageDailyPoint).day === 'string'
    && DAY_KEY.test((value as UsageDailyPoint).day)
}

function isProviderDaily(value: unknown): value is UsageProviderDaily {
  if (!isRecord(value)) return false
  if (typeof value.provider !== 'string') return false
  if (typeof value.model !== 'string') return false
  return Array.isArray(value.daily) && value.daily.every(isDailyPoint)
}

/**
 * 校验 Host 读回的汇总响应。
 *
 * Client 不信任路由的响应体：形状不符就当作读失败，而不是渲染半截数据。
 * @param value - 解码后的 JSON。
 * @returns 该值是否是一份完整合法的汇总。
 */
export function isUsageSummary(value: unknown): value is UsageSummary {
  if (!isRecord(value)) return false
  if (!isBuckets(value.today) || !isBuckets(value.d7) || !isBuckets(value.d30)) return false
  if (!Array.isArray(value.byProvider) || !value.byProvider.every(isProviderTotal)) return false
  if (!Array.isArray(value.daily) || !value.daily.every(isDailyPoint)) return false
  if (!Array.isArray(value.dailyByProvider) || !value.dailyByProvider.every(isProviderDaily)) return false
  return isCount(value.generatedAt)
}
