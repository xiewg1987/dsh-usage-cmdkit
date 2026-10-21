/**
 * 竖屏（窄栏）面板：金融竖屏那一版视觉。
 *
 * 与宽版（≥900px 的双栏 + 3D 轨道矩阵）是**两套独立构图**，不是同一套的缩放。
 * 竖屏这一版按「夜里看盘」的竖屏应用重排，节奏是**上密下疏**：
 *
 *   品牌头 → 控件行 → 主指标（大数 + 涨跌签 + 折线 + 表盘）
 *          → 两枚指标块 → 四行分类（带行内微折线）→ 一句洞察 → 状态条
 *
 * 视觉规矩（全页只允许两种彩色）：
 * - 底色近黑的午夜蓝，卡片是深灰半透明圆角，**没有霓虹描边、没有网格**；
 * - 界面色只有蓝青一种（选中态、进度环、标签）；
 * - 品类色退回到「一颗小圆点 + 一条 5px 细进度条 + 一段行内微折线」，不发光、不画柱；
 * - 数值白、标签灰，其余一律灰阶。
 *
 * 组件自己不绑 locale：`t` 由调用方传进来。
 * 这样同一份代码既挂在宿主里（locale 服务注入 `t`），
 * 也能在设计稿预览里喂一份本地字典（`design/_v5_src/`）——
 * **预览图渲染的就是这份实现本身**，不是另画一张。
 *
 * 视觉口径见 `design/v6-visual-direction.md`。
 */
import { useEffect, useRef, type ReactNode, type Ref } from 'react'
import type { UsageBuckets, UsageDailyPoint } from '../protocol.js'
import {
  BrandHeader,
  Insight,
  StatusFooter,
  WindowPills,
} from './UsageChrome.js'
import { UsageTelemetry, type TelemetryName } from './UsageTelemetry.js'
import { DeltaChip, MiniGauge, SegmentedControl, Sparkline, StatTile } from './UsageMeters.js'
import {
  ACCENT_CYAN,
  CARD,
  CARD_EDGE,
  FAINT,
  FONT_MONO,
  HAIRLINE,
  PANEL_BG,
  POSITIVE,
  RADIUS,
  SPACE,
  TEXT,
  formatCompact,
  percentOf,
} from './usage-theme.js'
import { dropIn, riseIn, useCountUp } from './usage-motion.js'
import { dailySeries, dailyTotals, windowDelta } from './usage-metrics.js'
import type { UsageTranslate } from './locales.js'

/** 竖屏面板的入场节拍（毫秒）。 */
export interface CompactTiming {
  /** 品牌头。 */
  header: number
  /** 视图 Tab。 */
  tabs: number
  /** 时间窗药丸。 */
  pills: number
  /** 主指标卡。 */
  hero: number
  /** 指标块行。 */
  stats: number
  /** 分类列表第一行。 */
  rows: number
  /** 相邻两行的间隔。 */
  rowStep: number
  /** 细进度条。 */
  bars: number
  /** 洞察卡。 */
  insight: number
  /** 底栏。 */
  footer: number
}

/** 竖屏面板的属性。 */
export interface UsageCompactProps {
  /** 面板自身的测量锚点（父组件靠它量宽高、选布局）。 */
  panelRef: Ref<HTMLElement>
  /** 翻译函数。 */
  t: UsageTranslate
  /** 四桶用量。 */
  buckets: UsageBuckets
  /** 总量。 */
  total: number
  /** 四个桶的短名（分类列表用）。 */
  names: readonly TelemetryName[]
  /** 时间窗的短标签（30D / 30 日），主指标标签用。 */
  windowShort: string
  /** 时间窗可选项。 */
  windows: readonly { value: string; label: string }[]
  /** 当前时间窗。 */
  windowValue: string
  /** 切时间窗。 */
  onWindow: (value: string) => void
  /** 缓存命中率（0–1）。 */
  rate: number
  /** 未缓存输入占总量的百分比（0–100）。 */
  uncachedShare: number
  /** 每日均摊的除数（时间窗覆盖的天数）。 */
  days: number
  /**
   * 日序列（从旧到新）。
   *
   * 折线、涨跌签、行内微折线都从这里来——没有它就只剩三块静态数字。
   */
  daily?: readonly UsageDailyPoint[]
  /** 今日总量（指标块用）。 */
  todayTotal: number
  /** 近 7 日总量（指标块用）。 */
  d7Total: number
  /** 状态提示（读取中 / 读取失败）；没有就传 null。 */
  notice?: ReactNode
  /** 底栏状态行。 */
  status: string
  /** 底栏版本号（单独一段，和状态行之间用中点隔开）。 */
  version?: string
  /** 底栏动作区。 */
  actions?: ReactNode
  /** 窗口很矮：用更紧的排版。 */
  dense: boolean
  /** 入场节拍。 */
  timing: CompactTiming
}

/**
 * 竖屏面板的属性（内部计算用）。
 * @param props - 面板数据、文案与动作。
 * @returns 竖屏面板。
 */
export function UsageCompactView(props: UsageCompactProps): ReactNode {
  const {
    panelRef,
    t,
    buckets,
    total,
    names,
    windowShort,
    windows,
    windowValue,
    onWindow,
    rate,
    uncachedShare,
    days,
    daily,
    todayTotal,
    d7Total,
    notice,
    status,
    version,
    actions,
    dense,
    timing,
  } = props

  const scroller = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const tabsRef = useRef<HTMLDivElement | null>(null)
  const pillsRef = useRef<HTMLDivElement | null>(null)
  const heroRef = useRef<HTMLDivElement | null>(null)
  const statsRef = useRef<HTMLDivElement | null>(null)
  const insightRef = useRef<HTMLDivElement | null>(null)
  const footerRef = useRef<HTMLDivElement | null>(null)

  // 入场只播一次：刷新走插值，不重播。
  const played = useRef(false)
  useEffect(() => {
    if (played.current) return
    played.current = true
    dropIn(headerRef.current, timing.header)
    dropIn(tabsRef.current, timing.tabs)
    dropIn(pillsRef.current, timing.pills)
    riseIn(heroRef.current, timing.hero, 220)
    riseIn(statsRef.current, timing.stats, 200)
    riseIn(insightRef.current, timing.insight, 200)
    riseIn(footerRef.current, timing.footer, 180)
  }, [timing])

  /** 主数字：入场从 0 滚上来。 */
  const counted = useCountUp(total, timing.hero, 520)
  const gap = dense ? SPACE.md : SPACE.lg

  // 日序列：总量折线 + 每桶自己的走势。
  const totals = dailyTotals(daily ?? [])
  const bucketSeries = dailySeries(daily ?? [], names.map((name) => name.key))

  /**
   * 涨跌签：当前窗口的日均，跟前一个等长窗口的日均比。
   *
   * 30 日窗没有 60 天可比，就退成「后 15 天 vs 前 15 天」——
   * 比不出来的时候宁可不画，也不要画一个假箭头。
   */
  const delta = windowDelta(daily ?? [], days)
  const half = Math.floor(totals.length / 2)
  const span = days >= half ? half : days
  const deltaLabel = days <= 1 ? t('delta.vsDay') : t('delta.vs', { days: String(span) })

  const hero = (
    <div
      ref={heroRef}
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
          {t('total.label')}
          {' · '}
          <span style={{ color: ACCENT_CYAN }}>{windowShort}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.sm, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: dense ? 38 : 42,
              fontWeight: 700,
              color: TEXT,
              letterSpacing: '-0.02em',
              lineHeight: 1.04,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatCompact(counted)}
          </span>
          <DeltaChip percent={delta} label={deltaLabel} />
        </div>
        {totals.length > 1 && (
          <Sparkline values={totals} width={dense ? 104 : 124} height={24} area />
        )}
      </div>
      <MiniGauge
        share={Math.round(rate * 100)}
        size={dense ? 60 : 72}
        center={`${(rate * 100).toFixed(1)}%`}
        caption={t('gauge.hitRate')}
      />
    </div>
  )

  /** 指标块行：两枚并排在一张卡里，中间一道发丝线。 */
  const stats = (
    <div
      ref={statsRef}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: SPACE.md,
        padding: '12px 13px',
        borderRadius: RADIUS.sm,
        background: CARD,
        border: `1px solid ${CARD_EDGE}`,
      }}
    >
      <StatTile
        label={t('stat.today')}
        value={formatCompact(todayTotal)}
        share={total > 0 ? percentOf(todayTotal, total) : 0}
      />
      <div aria-hidden="true" style={{ width: 1, background: HAIRLINE, flex: 'none' }} />
      <StatTile
        label={t('stat.d7')}
        value={formatCompact(d7Total)}
        share={total > 0 ? percentOf(d7Total, total) : 0}
        color={POSITIVE}
      />
    </div>
  )

  const telemetry = (
    <div
      style={{
        padding: '14px 14px',
        borderRadius: RADIUS.md,
        background: CARD,
        border: `1px solid ${CARD_EDGE}`,
      }}
    >
      <UsageTelemetry
        buckets={buckets}
        names={names}
        variant="flat"
        dense={dense}
        series={bucketSeries}
        timing={{ rows: timing.rows, rowStep: timing.rowStep, bars: timing.bars }}
      />
    </div>
  )

  // 洞察跟着数据走：未缓存输入占了大头时，不能还说它「保持低位」。
  const insight = (
    <div ref={insightRef}>
      <Insight
        title={t('insight.title')}
        bar={uncachedShare}
        barColor={uncachedShare > 40 ? ACCENT_CYAN : POSITIVE}
      >
        {uncachedShare > 40
          ? t('insight.uncachedHigh', { pct: `${uncachedShare}%` })
          : t('insight.uncachedLow', { pct: `${uncachedShare}%` })}
      </Insight>
    </div>
  )

  return (
    <section
      data-usage-dashboard=""
      ref={panelRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        height: '100%',
        maxHeight: '100%',
        background: PANEL_BG,
        color: TEXT,
        border: `1px solid ${CARD_EDGE}`,
        borderRadius: RADIUS.panel,
        padding: '16px 16px 14px',
        fontSize: 13,
        lineHeight: 1.5,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/*
        两层：外层滚动容器、内层内容。

        宿主右栏的 Tab 容器是 overflow:hidden，面板再高就够不到底栏，
        所以滚动容器得自己当；内容层包一层是为了量「内容有多高」。
      */}
      <div
        ref={scroller}
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap,
            minHeight: '100%',
          }}
        >
          <div ref={headerRef}>
            <BrandHeader
              title={t('brand.name')}
              usageLabel={t('brand.usage')}
              accent={ACCENT_CYAN}
              size="compact"
            />
          </div>

          <div aria-hidden="true" style={{ height: 1, background: HAIRLINE, flex: 'none' }} />

          {/* 控件行：视图分段 + 时间窗药丸。窄屏放不下就换行。 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: SPACE.sm,
            }}
          >
            <div ref={tabsRef}>
              <SegmentedControl
                items={[t('view.overview'), t('view.top'), t('view.alerts')]}
                active={0}
                soonHint={t('view.soon')}
                onSelect={() => undefined}
                accent={ACCENT_CYAN}
              />
            </div>
            <div ref={pillsRef} style={{ marginLeft: 'auto' }}>
              <WindowPills
                items={windows.map((item) => ({ value: item.value, label: item.label }))}
                value={windowValue}
                onSelect={onWindow}
                accent={ACCENT_CYAN}
                size="compact"
              />
            </div>
          </div>

          {notice}

          {hero}
          {stats}
          {telemetry}
          {insight}

          <div style={{ flex: 1 }} />

          {/*
            底栏常驻。

            宿主右栏只有几百像素高，面板内容比视口高时，状态条会被推到下面
            看不见。所以这块做成 sticky：内容超出时它贴在滚动区底部，
            内容放得下时它仍然落在底部。

            `marginTop: -gap` + `paddingTop: gap` 是把父级 flex 的行间距
            **搬进自己这一块**——间距还是那个间距，但这段底色是不透明的，
            列表滚上来时从它背后过，不会从缝里透出来。
          */}
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              zIndex: 1,
              background: PANEL_BG,
              marginTop: -gap,
              paddingTop: gap,
            }}
          >
            <div aria-hidden="true" style={{ height: 1, background: HAIRLINE, flex: 'none' }} />
            <div ref={footerRef}>
              <StatusFooter
                status={status}
                version={version}
                size="compact"
                dot="ok"
                actions={actions}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
