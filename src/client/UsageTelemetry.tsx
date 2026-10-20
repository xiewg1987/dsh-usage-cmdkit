/**
 * 四行遥测列表：每个 token 桶一行。
 *
 * 名字与数量一律中性色，品类色只留给条形——
 * 和 hero 图的分工一致：颜色只标注数据，不参与排版。
 */
import type { ReactNode } from 'react'
import type { UsageBuckets } from '../protocol.js'
import { BUCKET_GLASS, MUTED, TEXT, formatCount, percentOf } from './usage-theme.js'
import { RING_KEYS } from './UsageRing.js'

/** 列表的两种排版密度：窄栏里的小字、宽面板时的大字。 */
export type TelemetryVariant = 'compact' | 'hero'

/** 每一桶要展示的全名（与环外标签同源）。 */
export interface TelemetryName {
  /** 桶的键。 */
  key: keyof UsageBuckets
  /** 展示文本。 */
  label: string
}

/** 遥测列表的属性。 */
export interface UsageTelemetryProps {
  /** 四桶用量。 */
  buckets: UsageBuckets
  /** 每桶的全名。 */
  names: readonly TelemetryName[]
  /** 排版密度，默认侧栏的紧凑版。 */
  variant?: TelemetryVariant
}

/** 两种密度下的字号与间距。 */
const DENSITY = {
  compact: { font: 12, gap: 14, labelGap: 7 },
  hero: { font: 15, gap: 16, labelGap: 8 },
} as const

/**
 * 渲染四行遥测列表。
 * @param props - 桶用量、每桶全名与排版密度。
 * @returns 列表。
 */
export function UsageTelemetry({ buckets, names, variant = 'compact' }: UsageTelemetryProps): ReactNode {
  const total = RING_KEYS.reduce((sum, key) => sum + buckets[key], 0)
  const d = DENSITY[variant]
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: d.gap }}>
      {names.map((name, index) => {
        const value = buckets[name.key]
        const glass = BUCKET_GLASS[index]
        const share = percentOf(value, total)
        return (
          <li key={name.key} style={{ display: 'flex', flexDirection: 'column', gap: d.labelGap }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: d.font,
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                  color: TEXT,
                  whiteSpace: 'nowrap',
                }}
              >
                {name.label}
              </span>
              <span
                style={{
                  fontSize: d.font,
                  fontWeight: 600,
                  color: TEXT,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatCount(value)}
                <span style={{ fontWeight: 400, color: MUTED }}> · {share}%</span>
              </span>
            </div>
            {/* 条长 = 占总 token 的比例，与环上百分比一致。 */}
            <div
              style={{
                position: 'relative',
                height: 4,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.07)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '0 auto 0 0',
                  width: `${share}%`,
                  borderRadius: 2,
                  background: `linear-gradient(180deg, ${glass.hi} 0%, ${glass.base} 100%)`,
                  boxShadow: `0 0 8px ${glass.base}66`,
                }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
