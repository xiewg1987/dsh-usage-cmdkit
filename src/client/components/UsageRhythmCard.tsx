/**
 * 节律卡：用量在时间上的形状。
 *
 * 两种形态，**信息一样，密度不同**——
 * 竖屏（360 宽）一屏只装得下这么多，所以用 `strip` 挤进已有的卡里；
 * 宽版空间富余，用 `card` 单独成卡。
 * 这跟 `UsageTelemetry` 的 `flat` / `wide` 是同一个做法。
 *
 * 三块各说一件事：
 * - 周末 / 工作日：日均之比（周末更省还是更费）；
 * - 连续活跃：连着用了几天，另有几天完全没动；
 * - 峰谷比：峰值是中位数的几倍（另给波动系数）。
 *
 * 算不出来的块**不画**——宁可少一块，也不要摆一个「0.0×」的假数。
 */
import type { ReactNode } from 'react'
import { StatTile } from './UsageMeters.js'
import type { UsageRhythm } from '../data/usage-rhythm.js'
import type { UsageTranslate } from '../i18n/locales.js'
import {
  CARD,
  CARD_EDGE,
  FAINT,
  FONT_MONO,
  HAIRLINE,
  MUTED,
  RADIUS,
  SPACE,
  TEXT,
  formatCompact,
} from '../theme/usage-theme.js'

/** 节律卡的属性。 */
export interface UsageRhythmCardProps {
  /** 翻译函数。 */
  t: UsageTranslate
  /** 节律统计。 */
  rhythm: UsageRhythm
  /**
   * 形态。
   *
   * - `card`：一张独立的卡（宽版）。
   * - `strip`：一行紧凑数字（竖屏），挤进已有的卡里。
   */
  variant?: 'card' | 'strip'
}

/**
 * 渲染节律卡。
 * @param props - 翻译函数、节律统计与形态。
 * @returns 节律卡；算不出来的块不画。
 */
export function UsageRhythmCard(props: UsageRhythmCardProps): ReactNode {
  const { t, rhythm } = props
  const variant = props.variant ?? 'card'

  /** 三块的值：算得出来才有。 */
  const items: { id: string; label: string; short: string; value: string; sub?: string }[] = []

  if (rhythm.weekendShare !== null) {
    items.push({
      id: 'weekend',
      label: t('rhythm.weekendLabel'),
      short: t('rhythm.weekendShort'),
      value: t('rhythm.weekendValue', { pct: rhythm.weekendShare.toFixed(0) }),
      sub: t('rhythm.weekendSub', { value: formatCompact(rhythm.weekendAvg) }),
    })
  }
  items.push({
    id: 'streak',
    label: t('rhythm.streakLabel'),
    short: t('rhythm.streakShort'),
    value: t('rhythm.streakValue', { days: String(rhythm.streak) }),
    sub: t('rhythm.streakSub', { days: String(rhythm.idleDays) }),
  })
  if (rhythm.spread !== null) {
    items.push({
      id: 'spread',
      label: t('rhythm.spreadLabel'),
      short: t('rhythm.spreadShort'),
      value: t('rhythm.spreadValue', { value: rhythm.spread.toFixed(2) }),
      sub: rhythm.volatility === null
        ? undefined
        : t('rhythm.spreadSub', { pct: rhythm.volatility.toFixed(1) }),
    })
  }

  if (items.length === 0) return null

  /** 紧凑形态：一行三段，段与段之间一个中点。 */
  if (variant === 'strip') {
    return (
      <span
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 7,
          fontFamily: FONT_MONO,
          fontSize: 8.5,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: MUTED,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {items.map((item, index) => (
          <span key={item.id} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
            {index > 0 && <span aria-hidden="true" style={{ color: FAINT }}>·</span>}
            <span style={{ color: FAINT }}>{item.short}</span>
            <span style={{ color: TEXT, fontWeight: 600 }}>{item.value}</span>
          </span>
        ))}
      </span>
    )
  }

  /** 完整形态：一张卡，三枚指标块。 */
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px 13px',
        borderRadius: RADIUS.sm,
        background: CARD,
        border: `1px solid ${CARD_EDGE}`,
      }}
    >
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: FAINT,
        }}
      >
        {t('rhythm.title')}
      </span>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: SPACE.md }}>
        {items.map((item, index) => (
          <div
            key={item.id}
            style={{ display: 'flex', alignItems: 'stretch', gap: SPACE.md, flex: 1, minWidth: 0 }}
          >
            {/* 发丝线只在块**之间**：第一块前面没有分隔线。 */}
            {index > 0 && (
              <div aria-hidden="true" style={{ width: 1, background: HAIRLINE, flex: 'none' }} />
            )}
            <StatTile label={item.label} value={item.value} sub={item.sub} />
          </div>
        ))}
      </div>
    </div>
  )
}
