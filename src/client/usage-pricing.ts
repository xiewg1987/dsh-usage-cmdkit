/**
 * 花费估算：费率表与算式。
 *
 * **这是估算，不是账单。**
 *
 * 价格随时间变动（DeepSeek 2026-08 调过一轮价，还分峰谷时段），
 * 各家模型也不同，所以这里只给出一个**量级**参考：
 * - 费率表默认值取 DeepSeek V4.1-Flash 的公开 off-peak 价（2026-09-10 口径）
 *   ——未命中输入 $0.15 / 缓存命中 $0.003 / 输出 $0.60（每百万 token）。
 * - 缓存写入按「未命中输入」价计：DeepSeek 的缓存创建就是按输入价收费的。
 * - 面板上这个数永远带 `≈` 前缀，悬停能看到用的是哪一档费率。
 *
 * 要按自己的合同价算，改 `DEFAULT_RATES` 即可；
 * 换模型请连带改 `RATES_BY_PROVIDER`。
 */
import type { UsageBuckets } from '../protocol.js'

/** 一组费率，单位是**美元 / 百万 token**。 */
export interface Rates {
  /** 未命中缓存的输入。 */
  uncachedInput: number
  /** 输出。 */
  output: number
  /** 缓存读取（命中）。 */
  cacheRead: number
  /** 缓存写入：按未命中输入价计。 */
  cacheWrite: number
}

/** 默认费率：DeepSeek V4.1-Flash 的公开 off-peak 价（2026-09-10 口径）。 */
export const DEFAULT_RATES: Rates = {
  uncachedInput: 0.15,
  output: 0.6,
  cacheRead: 0.003,
  cacheWrite: 0.15,
}

/** 按来源标识挑费率：键是 provider 名，值是该家的费率。 */
export const RATES_BY_PROVIDER: Record<string, Rates> = {
  deepseek: DEFAULT_RATES,
  'deepseek-ai': DEFAULT_RATES,
}

/** 美元兑人民币的折算率：只用于给一个量级，不做外汇报价。 */
export const CNY_PER_USD = 7.1

/**
 * 按费率把四桶 token 折成美元。
 * @param buckets - 四桶用量。
 * @param rates - 费率表，默认用 {@link DEFAULT_RATES}。
 * @returns 估算的美元金额。
 */
export function estimateUsd(buckets: UsageBuckets, rates: Rates = DEFAULT_RATES): number {
  return (
    buckets.uncachedInputTokens * rates.uncachedInput
    + buckets.outputTokens * rates.output
    + buckets.cacheReadTokens * rates.cacheRead
    + buckets.cacheWriteTokens * rates.cacheWrite
  ) / 1_000_000
}

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

/**
 * 美元金额的显示格式。
 *
 * 小额不留两位——真实用量往往只有几分之一美元，
 * 一律 `$0.00` 会把一个有用的数变成没有信息。
 * @param value - 美元金额。
 * @returns 形如 `$0.20` / `$0.0015` 的串。
 */
export function formatUsd(value: number): string {
  if (value >= 0.01) return `$${value.toFixed(2)}`
  if (value > 0) return `$${value.toFixed(4)}`
  return '$0.00'
}

/**
 * 人民币金额的显示格式，规则与 {@link formatUsd} 一致。
 * @param value - 美元金额。
 * @param perUsd - 美元兑人民币的折算率。
 * @returns 形如 `¥1.41` / `¥0.0107` 的串。
 */
export function formatCny(value: number, perUsd: number = CNY_PER_USD): string {
  const cny = value * perUsd
  if (cny >= 0.01) return `¥${cny.toFixed(2)}`
  if (cny > 0) return `¥${cny.toFixed(4)}`
  return '¥0.00'
}

/**
 * 费率表的一行说明，给悬停提示用。
 * @param rates - 费率表。
 * @returns 形如 `未命中输入 $0.15 · 输出 $0.60 · 缓存读 $0.003 · 缓存写 $0.15（每百万 token）` 的串。
 */
export function describeRates(rates: Rates = DEFAULT_RATES): string {
  return [
    `未命中输入 $${rates.uncachedInput}`,
    `输出 $${rates.output}`,
    `缓存读 $${rates.cacheRead}`,
    `缓存写 $${rates.cacheWrite}`,
    '（每百万 token）',
  ].join(' · ')
}
