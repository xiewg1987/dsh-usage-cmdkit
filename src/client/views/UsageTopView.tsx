/**
 * Top 屏：谁把 token 花了。
 *
 * 总览屏回答「用得怎么样」，这一屏回答「花在哪」：
 * 头部一个模型占多少（TOP SHARE 环）、每个模型的量、
 * 以及按来源汇总后的账——三张卡，**同一套卡片语言**，跟总览屏读起来是一家人。
 *
 * 数字全部来自真实的 provider/model 拆分（`UsageSummary.byProvider`），
 * 环上的百分比是**头部模型占窗口总量**的份额——
 * 它跟下面第一行的百分比重复不了：行里写的是这个模型的量，环里写的是它的权重。
 *
 * 组件自己不绑 locale：`t` 由调用方传进来。
 */
import type { ReactNode } from 'react'
import type { UsageDailyPoint, UsageProviderTotal } from '../../protocol.js'
import { MiniGauge } from '../components/UsageMeters.js'
import { RING_KEYS } from '../components/UsageRing.js'
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
  formatCount,
  percentOf,
} from '../theme/usage-theme.js'
import type { UsageTranslate } from '../i18n/locales.js'

/** Top 屏的属性。 */
export interface UsageTopViewProps {
  /** 翻译函数。 */
  t: UsageTranslate
  /** 当前时间窗的总量。 */
  total: number
  /** 按 provider/model 的拆分。 */
  providers: readonly UsageProviderTotal[]
  /** 缓存命中率（0–1）。 */
  rate: number
  /** 日序列（峰值日用）。 */
  daily?: readonly UsageDailyPoint[]
  /** 当前时间窗的短标签（30D / 7D）。 */
  windowShort: string
  /** 窗口很矮：用更紧的排版。 */
  dense: boolean
}

/** 一行排行：序号 + 名称 + 数值 + 占比 + 量级条。 */
function RankRow(props: {
  index?: string
  label: string
  value: string
  share: number
  /** 量级条的长度（0–1）。 */
  ratio: number
}): ReactNode {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
        {props.index !== undefined && (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              color: FAINT,
              fontVariantNumeric: 'tabular-nums',
              flex: 'none',
            }}
          >
            {props.index}
          </span>
        )}
        <span
          style={{
            fontSize: 11.5,
            color: '#cbd5e4',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {props.label}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11.5,
            fontWeight: 600,
            color: TEXT,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {props.value}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: MUTED,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            minWidth: 30,
            textAlign: 'right',
          }}
        >
          {`${props.share}%`}
        </span>
      </div>
      <div
        aria-hidden="true"
        style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(100, props.ratio * 100))}%`,
            height: '100%',
            borderRadius: 2,
            background: ACCENT_CYAN,
          }}
        />
      </div>
    </div>
  )
}

/**
 * 渲染 Top 屏。
 * @param props - 数据与文案。
 * @returns Top 屏内容。
 */
export function UsageTopView(props: UsageTopViewProps): ReactNode {
  const { t, total, providers, rate, daily, windowShort } = props

  /** 每个 provider/model 的总量。 */
  const models = providers.map((provider) => ({
    provider,
    value: RING_KEYS.reduce((sum, key) => sum + provider[key], 0),
  }))
  /** 按 provider 汇总（同一 provider 的多个 model 合并）。 */
  const byProvider = new Map<string, number>()
  for (const model of models) {
    const name = model.provider.provider
    byProvider.set(name, (byProvider.get(name) ?? 0) + model.value)
  }
  /** 头部模型占窗口总量的份额：环里那个数。 */
  const topShare = models.length === 0 ? 0 : percentOf(models[0].value, total)
  /** 单模型均量：总量摊到每个模型上。 */
  const perModel = models.length === 0 ? 0 : total / models.length
  /** 峰值日：窗口里日总量最高的那天。 */
  const peakDay = (daily ?? []).reduce((max, point) => {
    const sum = RING_KEYS.reduce((acc, key) => acc + point[key], 0)
    return Math.max(max, sum)
  }, 0)

  const hero = (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: SPACE.md,
        padding: '16px 16px 14px',
        borderRadius: RADIUS.md,
        background: CARD,
        border: `1px solid ${CARD_EDGE}`,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
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
          {t('top.consumers')}
          {' · '}
          <span style={{ color: ACCENT_CYAN }}>{windowShort}</span>
        </span>
        <span
          style={{
            fontSize: 38,
            fontWeight: 700,
            color: TEXT,
            letterSpacing: '-0.02em',
            lineHeight: 1.04,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatCompact(total)}
        </span>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 9,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: FAINT,
          }}
        >
          {t('top.models', { models: String(models.length), providers: String(byProvider.size) })}
        </span>
      </div>
      <MiniGauge
        share={topShare}
        size={104}
        center={`${(total > 0 ? (models[0]?.value ?? 0) / total * 100 : 0).toFixed(1)}%`}
        caption={t('top.share')}
      />
    </div>
  )

  /** 三枚指标块：各占一张小卡。 */
  const metrics = (
    <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'stretch' }}>
      {[
        { label: t('top.perModel'), value: formatCompact(perModel) },
        { label: t('top.peakDay'), value: formatCompact(peakDay) },
        { label: t('gauge.hitRate'), value: `${(rate * 100).toFixed(1)}%` },
      ].map((metric) => (
        <div
          key={metric.label}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '11px 12px',
            borderRadius: RADIUS.sm,
            background: CARD,
            border: `1px solid ${CARD_EDGE}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
          }}
        >
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 8.5,
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: FAINT,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {metric.label}
          </span>
          <span
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: TEXT,
              letterSpacing: '-0.01em',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {metric.value}
          </span>
        </div>
      ))}
    </div>
  )

  /** 按模型排行。 */
  const modelCard = (
    <div
      style={{
        padding: '13px 14px',
        borderRadius: RADIUS.md,
        background: CARD,
        border: `1px solid ${CARD_EDGE}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
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
        {t('top.byModel')}
      </span>
      {models.length === 0 && (
        <span style={{ fontSize: 11.5, color: MUTED }}>{t('provider.unknown')}</span>
      )}
      {models.map((model, index) => (
        <RankRow
          key={`${model.provider.provider}/${model.provider.model}`}
          index={String(index + 1).padStart(2, '0')}
          label={`${model.provider.provider}${model.provider.model.length > 0 ? ` / ${model.provider.model}` : ''}`}
          value={formatCount(model.value)}
          share={percentOf(model.value, total)}
          ratio={total > 0 ? model.value / total : 0}
        />
      ))}
    </div>
  )

  /** 按来源汇总。 */
  const providerCard = (
    <div
      style={{
        padding: '13px 14px',
        borderRadius: RADIUS.md,
        background: CARD,
        border: `1px solid ${CARD_EDGE}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
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
        {t('top.byProvider')}
      </span>
      {[...byProvider.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => (
          <RankRow
            key={name}
            label={name === 'unknown' ? t('provider.unknown') : name}
            value={formatCount(value)}
            share={percentOf(value, total)}
            ratio={total > 0 ? value / total : 0}
          />
        ))}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      {hero}
      {metrics}
      {/* 两张卡并排：窄栏自动叠成一列，宽栏并成两列。 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: SPACE.md,
          alignItems: 'start',
        }}
      >
        {modelCard}
        {providerCard}
      </div>
    </div>
  )
}
