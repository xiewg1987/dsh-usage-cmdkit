/**
 * 告警屏：这段时间里，形状不对的地方。
 *
 * 三块：
 * 1. **概览**——几条告警、按严重度各几条（数字来自 `deriveAlerts` 的真实推导）；
 * 2. **最近**——每条告警的标题、说明与量级条；
 * 3. **每日总量**——把窗口的日折线摊开，让告警有上下文：
 *    「今天冲高」这句话，得先看见那条线才说得清。
 *
 * 严重度用**同一种蓝青的三档亮度**表示（亮 / 中 / 暗），
 * 不给告警另开三种色相——这一屏仍然是**单色**的一屏。
 *
 * 组件自己不绑 locale：`t` 由调用方传进来。
 */
import type { ReactNode } from 'react'
import type { UsageDailyPoint } from '../../protocol.js'
import { RING_KEYS } from '../components/UsageRing.js'
import { Sparkline } from '../components/UsageMeters.js'
import { UsageRhythmCard } from '../components/UsageRhythmCard.js'
import { dailyTotals, windowDelta } from '../data/usage-metrics.js'
import type { UsageRhythm } from '../data/usage-rhythm.js'
import type { UsageAlert, UsageAlertLevel } from '../data/usage-alerts.js'
import {
  ACCENT_CYAN,
  CARD,
  CARD_EDGE,
  FAINT,
  FONT_MONO,
  MUTED,
  RADIUS,
  SPACE,
  TEXT,
  formatCompact,
} from '../theme/usage-theme.js'
import type { UsageTranslate, UsageKey } from '../i18n/locales.js'

/** 告警屏的属性。 */
export interface UsageAlertsViewProps {
  /** 翻译函数。 */
  t: UsageTranslate
  /** 推导出来的告警。 */
  alerts: readonly UsageAlert[]
  /** 当前时间窗的短标签（30D / 7D）。 */
  windowShort: string
  /** 日序列（趋势卡用）。 */
  daily?: readonly UsageDailyPoint[]
  /** 当前时间窗覆盖的天数。 */
  days: number
  /**
   * 节律统计（可选）。
   *
   * 给不给都行：给了就报这一屏的「形状」——
   * 周末 / 工作日的比、连着用了几天、峰谷比。
   * 摆法由调用方定（见 `rhythmLayout`）。
   */
  rhythm?: UsageRhythm
  /**
   * 节律的摆法。
   *
   * - `strip`：一行紧凑数字，挂进「每日总量」卡里（竖屏 360 宽）。
   * - `card`：一张独立的卡（宽版）。
   */
  rhythmLayout?: 'strip' | 'card'
}

/** 严重度 → 蓝青的亮度档：亮 = 最严重。 */
const LEVEL_TONE: Record<UsageAlertLevel, string> = {
  high: ACCENT_CYAN,
  med: 'rgba(56,189,248,0.7)',
  low: 'rgba(56,189,248,0.45)',
}

/** 严重度的展示顺序。 */
const LEVELS: readonly UsageAlertLevel[] = ['high', 'med', 'low']

/** 一条告警的标题键与详情键。 */
const ALERT_KEYS: Record<UsageAlert['kind'], { title: UsageKey; detail: UsageKey }> = {
  peak: { title: 'alert.peak.title', detail: 'alert.peak.detail' },
  uncached: { title: 'alert.uncached.title', detail: 'alert.uncached.detail' },
  cacheWrite: { title: 'alert.cacheWrite.title', detail: 'alert.cacheWrite.detail' },
  output: { title: 'alert.output.title', detail: 'alert.output.detail' },
}

/** `YYYY-MM-DD` → `MM-DD`。 */
function shortDay(day: string): string {
  const parts = day.split('-')
  if (parts.length < 3) return day
  return `${parts[1]}-${parts[2]}`
}

/**
 * 渲染告警屏。
 * @param props - 告警、日序列与文案。
 * @returns 告警屏内容。
 */
export function UsageAlertsView(props: UsageAlertsViewProps): ReactNode {
  const { t, alerts, windowShort, daily, days, rhythm } = props
  const rhythmLayout = props.rhythmLayout ?? 'strip'

  const totals = dailyTotals(daily ?? [])
  const avg = totals.length === 0 ? 0 : totals.reduce((sum, value) => sum + value, 0) / totals.length
  const peak = totals.length === 0 ? 0 : Math.max(...totals)
  const peakIndex = totals.indexOf(peak)
  const peakDay = daily !== undefined && daily[peakIndex] !== undefined ? shortDay(daily[peakIndex].day) : ''
  /** 窗口内最近一次有用量的日历日（补零日不算「有记录」）。 */
  const lastDay = (() => {
    if (daily === undefined || daily.length === 0) return ''
    for (let index = daily.length - 1; index >= 0; index -= 1) {
      const point = daily[index]
      const sum = RING_KEYS.reduce((acc, key) => acc + point[key], 0)
      if (sum > 0) return shortDay(point.day)
    }
    return ''
  })()
  const delta = windowDelta(daily ?? [], days)
  const half = Math.floor(totals.length / 2)
  const span = days >= half ? half : days
  const deltaLabel = days <= 1 ? t('delta.vsDay') : t('delta.vs', { days: String(span) })

  /** 概览卡。 */
  const summary = (
    <div
      style={{
        padding: '15px 16px 14px',
        borderRadius: RADIUS.md,
        background: CARD,
        border: `1px solid ${CARD_EDGE}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
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
          {t('alerts.title')}
          {' · '}
          <span style={{ color: ACCENT_CYAN }}>{windowShort}</span>
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: FAINT,
            }}
          >
            {t('alerts.lastCheck')}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: TEXT,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {lastDay}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: TEXT,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {alerts.length}
        </span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: FAINT,
          }}
        >
          {t('alerts.open', { days: String(days) })}
        </span>
      </div>
      {/* 严重度分布：三枚药丸，点是同一色相的三档亮度。 */}
      <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'stretch' }}>
        {LEVELS.map((level) => {
          const count = alerts.filter((alert) => alert.level === level).length
          if (count === 0) return null
          return (
            <div
              key={level}
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 11px',
                borderRadius: RADIUS.sm,
                background: 'rgba(255,255,255,0.035)',
                border: `1px solid ${CARD_EDGE}`,
              }}
            >
              <span
                aria-hidden="true"
                style={{ width: 6, height: 6, borderRadius: '50%', background: LEVEL_TONE[level], flex: 'none' }}
              />
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 9,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: MUTED,
                  whiteSpace: 'nowrap',
                }}
              >
                {t(`alert.level.${level}`)}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 12,
                  fontWeight: 600,
                  color: TEXT,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )

  /** 最近告警列表。 */
  const recent = (
    <div
      style={{
        padding: '13px 14px',
        borderRadius: RADIUS.md,
        background: CARD,
        border: `1px solid ${CARD_EDGE}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 13,
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
        {t('alerts.recent')}
      </span>
      {alerts.length === 0 && (
        <span style={{ fontSize: 11.5, color: MUTED }}>{t('alerts.none')}</span>
      )}
      {alerts.map((alert) => (
        <div key={alert.kind} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: LEVEL_TONE[alert.level],
                flex: 'none',
                transform: 'translateY(-1px)',
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: TEXT,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {t(ALERT_KEYS[alert.kind].title)}
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontFamily: FONT_MONO,
                fontSize: 9,
                color: FAINT,
                whiteSpace: 'nowrap',
                flex: 'none',
              }}
            >
              {alert.ago === 0 ? t('alert.ago.today') : t('alert.ago.days', { days: String(alert.ago) })}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: MUTED }}>
            {t(ALERT_KEYS[alert.kind].detail, alert.params)}
          </p>
          <div
            aria-hidden="true"
            style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(100, alert.ratio * 100))}%`,
                height: '100%',
                borderRadius: 2,
                background: LEVEL_TONE[alert.level],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )

  /** 每日总量趋势卡：给告警一个背景。 */
  const trend = (
    <div
      style={{
        padding: '13px 14px',
        borderRadius: RADIUS.md,
        background: CARD,
        border: `1px solid ${CARD_EDGE}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
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
          {t('alerts.dailyTotal')}
          {' · '}
          <span style={{ color: ACCENT_CYAN }}>{windowShort}</span>
        </span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: MUTED,
            whiteSpace: 'nowrap',
          }}
        >
          {t('alerts.peak', { value: formatCompact(peak), day: peakDay })}
        </span>
      </div>
      {totals.length > 1 && <Sparkline values={totals} width={288} height={38} area />}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: FAINT,
            whiteSpace: 'nowrap',
          }}
        >
          {t('alerts.avgPerDay', { value: formatCompact(avg) })}
        </span>
        {delta !== null && (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: ACCENT_CYAN,
              whiteSpace: 'nowrap',
            }}
          >
            {`${delta >= 0 ? '↗' : '↘'} ${Math.abs(delta).toFixed(1)}% ${deltaLabel}`}
          </span>
        )}
      </div>
      {/*
        节律（竖屏形态）：挤在这一张卡的最后一行。
        这张卡讲的就是「用量的形状」——周末差、连着用了几天、峰谷比，
        跟折线是同一件事的两种说法。
      */}
      {rhythm !== undefined && rhythmLayout === 'strip' && (
        <UsageRhythmCard t={t} rhythm={rhythm} variant="strip" />
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      {summary}
      {recent}
      {trend}
      {rhythm !== undefined && rhythmLayout === 'card' && (
        <UsageRhythmCard t={t} rhythm={rhythm} variant="card" />
      )}
    </div>
  )
}
