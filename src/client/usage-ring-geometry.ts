/**
 * 环的共用几何：分段与环外标签的挑选。
 *
 * 环与分类列表共用这一份计算：分段顺序、起止角、缺口，
 * 以及「哪个标签该露出来」的规则必须完全一致——
 * 两处各画一遍就会对不上。
 *
 * 角度约定：十二点方向是 -π/2，顺时针铺开（与 SVG 环的 dashoffset 一致）。
 */
import type { UsageBuckets } from '../protocol.js'

/** 四个桶的固定顺序：与环上分段、条形、环外标签同序。 */
export const RING_KEYS = [
  'uncachedInputTokens',
  'outputTokens',
  'cacheReadTokens',
  'cacheWriteTokens',
] as const

/** 一段弧。 */
export interface RingSegment {
  /** 桶的键。 */
  key: string
  /** 桶在固定顺序里的下标。 */
  index: number
  /** 桶的计数。 */
  value: number
  /** 桶占总量的比例（0–1）。 */
  share: number
  /** 起始角（弧度）。 */
  from: number
  /** 结束角（弧度）。 */
  to: number
}

/** 环外标签的输入。 */
export interface RingLabel {
  /** 桶的键。 */
  key: string
  /** 展示文本。 */
  text: string
}

/** 环外标签的落位结果。 */
export interface RingLabelPlacement {
  /** 对应的分段下标。 */
  index: number
  /** 展示文本。 */
  text: string
  /** 弧段中点的角度（弧度）。 */
  mid: number
  /** 弧段占比。 */
  share: number
}

/**
 * 环外标签的最小占比。
 *
 * 比这更小的桶在环上几乎看不见，标出来只会和邻居叠在一起——
 * 叠在一起的标签比没有标签更难读。
 */
export const MIN_LABEL_SHARE = 0.005

/**
 * 环外标签之间的最小角距（弧度）。
 *
 * 某一桶独大时，其余几桶的弧段会挤在一小段上，标签跟着挤成一团。
 * 角距太近就只留占比大的那个，另一个让位。
 */
export const MIN_LABEL_GAP = 0.28

/**
 * 把四桶用量摊成四段弧。
 * @param buckets - 四桶用量。
 * @returns 与 {@link RING_KEYS} 同序的四段弧。
 */
export function ringSegments(buckets: UsageBuckets): RingSegment[] {
  const sum = RING_KEYS.reduce((acc, key) => acc + buckets[key], 0)
  let cursor = -Math.PI / 2
  return RING_KEYS.map((key, index) => {
    const value = buckets[key]
    const share = sum > 0 ? value / sum : 0
    const from = cursor
    const to = cursor + share * Math.PI * 2
    cursor = to
    return { key, index, value, share, from, to }
  })
}

/**
 * 挑出该露出来的环外标签。
 *
 * 规则有两条：占比太小的不标；角距太近的只留占比大的那个。
 * @param segments - 分段结果。
 * @param labels - 与分段同序的标签。
 * @returns 该露出来的标签及其落位。
 */
export function placeRingLabels(
  segments: readonly RingSegment[],
  labels: readonly RingLabel[],
): RingLabelPlacement[] {
  return labels.reduce<RingLabelPlacement[]>((kept, label, index) => {
    const segment = segments[index]
    if (segment === undefined) return kept
    const candidate: RingLabelPlacement = {
      index,
      text: label.text,
      mid: (segment.from + segment.to) / 2,
      share: segment.share,
    }
    if (candidate.share < MIN_LABEL_SHARE) return kept
    const clash = kept.find((other) => {
      const raw = Math.abs(other.mid - candidate.mid)
      const gap = Math.min(raw, Math.PI * 2 - raw)
      return gap < MIN_LABEL_GAP
    })
    if (clash === undefined) {
      kept.push(candidate)
      return kept
    }
    // 撞上了就留占比大的那条。
    if (candidate.share > clash.share) {
      kept[kept.indexOf(clash)] = candidate
    }
    return kept
  }, [])
}
