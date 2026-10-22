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
import { modelHitRates } from '../data/usage-metrics.js'
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
  /**
   * 命中率的摆法。
   *
   * - `card`：一张独立的 CACHE HIT 卡（宽版，空间富余）。
   * - `column`：并进 BY MODEL 排行做一列（竖屏 360 宽，一屏只装得下这么多）。
   *
   * 两种形态**信息一样**，只是密度不同——
   * 跟 `UsageTelemetry` 的 `flat` / `wide` 是同一个做法。
   */
  hitRateLayout?: 'card' | 'column'
}

/** 卡片的标题微标：跟 BY MODEL / BY PROVIDER 同一套。 */
function cardTitle(text: string): ReactNode {
  return (
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
      {text}
    </span>
  )
}

/** provider/model 的显示名。 */
function modelLabel(provider: UsageProviderTotal): string {
  return `${provider.provider}${provider.model.length > 0 ? ` / ${provider.model}` : ''}`
}

/** 一行排行：序号 + 名称 + 数值 + 占比 + 量级条。 */
function RankRow(props: {
  index?: string
  label: string
  value: string
  share: number
  /** 量级条的长度（0–1）。 */
  ratio: number
  /** 命中率（窄屏的紧凑形态多这一列）。 */
  hitRate?: string
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
            minWidth: 52,
            textAlign: 'right',
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
            minWidth: 32,
            textAlign: 'right',
          }}
        >
          {`${props.share}%`}
        </span>
        {props.hitRate !== undefined && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: TEXT,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              minWidth: 40,
              textAlign: 'right',
            }}
          >
            {props.hitRate}
          </span>
        )}
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
 * 排行表的列头：只标「占比」和「命中」两列。
 *
 * 数值列不用标——它摆在一眼就知道是量的位置。
 * 有了这一行，「54%」和「39.3%」两个百分数不会被人读混。
 * @param props - 翻译函数。
 * @returns 列头行。
 */
function RankHeader(props: { t: UsageTranslate }): ReactNode {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
      <span aria-hidden="true" style={{ width: 13, flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 0 }} />
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 8,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: FAINT,
          whiteSpace: 'nowrap',
          minWidth: 52,
          textAlign: 'right',
        }}
      >
        {props.t('top.colTotal')}
      </span>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 8,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: FAINT,
          whiteSpace: 'nowrap',
          minWidth: 32,
          textAlign: 'right',
        }}
      >
        {props.t('top.colShare')}
      </span>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 8,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: FAINT,
          whiteSpace: 'nowrap',
          minWidth: 40,
          textAlign: 'right',
        }}
      >
        {props.t('top.colHit')}
      </span>
    </div>
  )
}

/**
 * 一行命中率：名称 + 命中率 + 它占的份额，条上压一根全局参考线。
 *
 * 参考线是这行的重点：全局命中率是加权平均，
 * 光看「谁 29.8%、谁 40.4%」得自己心算，
 * 有一根线标着全局位置，就能直接看出谁在线的下面。
 * @param props - 名称、命中率、份额与全局命中率。
 * @returns 命中率行。
 */
function HitRateRow(props: {
  label: string
  /** 命中率（0–1）。 */
  rate: number
  /** 占窗口总量的百分比（0–100）。 */
  share: number
  /** 全局命中率（0–1）：条上那根参考线。 */
  globalRate: number
}): ReactNode {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
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
          {`${(props.rate * 100).toFixed(1)}%`}
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
          {`${props.share.toFixed(0)}%`}
        </span>
      </div>
      <div
        aria-hidden="true"
        style={{ position: 'relative', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(100, props.rate * 100))}%`,
            height: '100%',
            borderRadius: 2,
            background: ACCENT_CYAN,
          }}
        />
        {/* 全局命中率：条上的那根竖线。 */}
        <span
          style={{
            position: 'absolute',
            left: `${Math.max(0, Math.min(100, props.globalRate * 100))}%`,
            top: 0,
            width: 1,
            height: '100%',
            background: 'rgba(255,255,255,0.55)',
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
  /** 每个模型各自的缓存命中率（`byProvider` 本来就带着四桶）。 */
  const hitRates = modelHitRates(providers, total)
  /** 命中率的摆法：独立成卡（宽版）还是并进排行做一列（竖屏）。 */
  const column = (props.hitRateLayout ?? 'card') === 'column'
  /** 某个 provider/model 的命中率；找不到就是 0。 */
  const hitRateOf = (provider: string, model: string): number =>
    hitRates.find((item) => item.provider.provider === provider && item.provider.model === model)?.rate ?? 0
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

  /**
   * 命中率的结论。
   *
   * 只说**量大的那个低命中的模型**：一个只占 5% 的模型命中再低也无所谓，
   * 扛着 30% 的量却压在线下面，那个才是值得动手的。
   * 命中都差不多的时候就说「差不多」，不硬凑结论。
   */
  const weakest = hitRates.length > 0
    ? hitRates.reduce((min, item) => (item.rate < min.rate ? item : min))
    : null
  const strongest = hitRates.length > 0
    ? hitRates.reduce((max, item) => (item.rate > max.rate ? item : max))
    : null
  const hitRateInsight = hitRates.length < 2 || weakest === null || strongest === null
    ? null
    : weakest.share >= 20
      ? t('top.hitRateLow', {
        model: modelLabel(weakest.provider),
        rate: `${(weakest.rate * 100).toFixed(1)}%`,
        share: weakest.share.toFixed(0),
      })
      : t('top.hitRateEven', {
        min: `${(weakest.rate * 100).toFixed(1)}%`,
        max: `${(strongest.rate * 100).toFixed(1)}%`,
      })

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
      {cardTitle(t('top.byModel'))}
      {column && hitRateInsight !== null && (
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: 'rgba(214,222,235,0.88)' }}>
          {hitRateInsight}
        </p>
      )}
      {column && models.length > 0 && <RankHeader t={t} />}
      {models.length === 0 && (
        <span style={{ fontSize: 11.5, color: MUTED }}>{t('provider.unknown')}</span>
      )}
      {models.map((model, index) => (
        <RankRow
          key={`${model.provider.provider}/${model.provider.model}`}
          index={String(index + 1).padStart(2, '0')}
          label={modelLabel(model.provider)}
          value={formatCount(model.value)}
          share={percentOf(model.value, total)}
          ratio={total > 0 ? model.value / total : 0}
          hitRate={column
            ? `${(hitRateOf(model.provider.provider, model.provider.model) * 100).toFixed(1)}%`
            : undefined}
        />
      ))}
    </div>
  )

  /** 分模型缓存命中率：量在谁身上，命中在谁身上。 */
  const hitRateCard = (
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
      {cardTitle(t('top.hitRate'))}
      {hitRateInsight !== null && (
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: 'rgba(214,222,235,0.88)' }}>
          {hitRateInsight}
        </p>
      )}
      {hitRates.length === 0 && (
        <span style={{ fontSize: 11.5, color: MUTED }}>{t('provider.unknown')}</span>
      )}
      {hitRates.map((item) => (
        <HitRateRow
          key={`${item.provider.provider}/${item.provider.model}`}
          label={modelLabel(item.provider)}
          rate={item.rate}
          share={item.share}
          globalRate={rate}
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
      {/* 卡片并排：窄栏自动叠成一列，宽栏并成两三列。 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: SPACE.md,
          alignItems: 'start',
        }}
      >
        {modelCard}
        {column ? null : hitRateCard}
        {providerCard}
      </div>
    </div>
  )
}
