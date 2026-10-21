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
import type { UsageBuckets } from '../protocol.js'

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
