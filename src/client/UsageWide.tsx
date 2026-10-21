/**
 * 宽版（≥900px）面板：3D 轨道矩阵 + v6 的卡片与标签语言。
 *
 * 与竖屏（`UsageCompact.tsx`）是**同一套视觉语言的两块画布**，不是两代设计：
 * 读法一致（主指标 → 指标块 → 分类 → 洞察），
 * 差别只在版面的宽窄与主视觉（平面表盘 vs 3D 环）。
 *
 * 沿用竖屏的那几件：
 * - 控件行：`SegmentedControl`（暗底分段容器）+ 描边药丸时间窗；
 * - 主指标卡：深灰半透明卡，涨跌签 + 30 日折线（宽版的大数在 3D 环心里）；
 * - 指标块行：两枚横排的 `StatTile`，中间一道发丝线；
 * - 分类列表：行内微折线 + 行间发丝线 + 灰阶百分比；
 * - 洞察卡：小标题 + 正文 + 右侧占比条；
 * - 底栏：绿点 + 版本号 + 带图标的 ghost 按钮，常驻。
 *
 * 3D 环**保留**（v6 视觉方向 §7 步骤 5：宽版仍是 3D 轨道矩阵），
 * 只是它旁边的卡片与标签换了语言。
 *
 * 组件自己不绑 locale：`t` 由调用方传进来。
 * 视觉口径见 `design/v6-visual-direction.md`。
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import type { UsageBuckets, UsageDailyPoint, UsageProviderTotal } from '../protocol.js'
import {
  BrandHeader,
  Insight,
  ProviderList,
  StatusFooter,
  WindowPills,
} from './UsageChrome.js'
import { UsageRing3D } from './UsageRing3D.js'
import { RING_KEYS, type RingLabel } from './UsageRing.js'
import { UsageTelemetry, type TelemetryName } from './UsageTelemetry.js'
import { DeltaChip, SegmentedControl, Sparkline, StatTile } from './UsageMeters.js'
import { dailySeries, dailyTotals, windowDelta } from './usage-metrics.js'
import { dropIn, riseIn } from './usage-motion.js'
import {
  ACCENT_CYAN,
  CARD,
  CARD_EDGE,
  HAIRLINE,
  PANEL_BG,
  POSITIVE,
  RADIUS,
  SPACE,
  TEXT,
  formatCompact,
  formatCount,
  percentOf,
} from './usage-theme.js'
import type { UsageTranslate } from './locales.js'

/** 宽版面板的入场节拍（毫秒）。 */
export interface WideTiming {
  /** 品牌头。 */
  header: number
  /** 视图分段。 */
  tabs: number
  /** 时间窗药丸。 */
  pills: number
  /** 主指标卡。 */
  hero: number
  /** 指标块行。 */
  kpi: number
  /** 分类列表第一行。 */
  rows: number
  /** 相邻两行的间隔。 */
  rowStep: number
  /** 细进度条。 */
  bars: number
  /** 底环。 */
  track: number
  /** 第一段色弧。 */
  arc: number
  /** 相邻色弧之间的间隔。 */
  arcStep: number
  /** 环心数字。 */
  number: number
  /** 洞察卡。 */
  insight: number
  /** 底栏。 */
  footer: number
}

/** 宽版面板的属性。 */
export interface UsageWideProps {
  /** 面板自身的测量锚点（父组件靠它量宽高、选布局）。 */
  panelRef: Ref<HTMLElement>
  /** 翻译函数。 */
  t: UsageTranslate
  /** 四桶用量。 */
  buckets: UsageBuckets
  /** 总量。 */
  total: number
  /** 四个桶的全名（分类列表用）。 */
  names: readonly TelemetryName[]
  /** 时间窗的长标签（环心用）。 */
  windowLabel: string
  /** 时间窗可选项。 */
  windows: readonly { value: string; label: string }[]
  /** 当前时间窗。 */
  windowValue: string
  /** 切时间窗。 */
  onWindow: (value: string) => void
  /** 未缓存输入占总量的百分比（0–100）。 */
  uncachedShare: number
  /** 当前窗口覆盖的天数。 */
  days: number
  /** 日序列（从旧到新）：折线、涨跌签、行内微折线都从这里来。 */
  daily?: readonly UsageDailyPoint[]
  /** 今日总量（指标块用）。 */
  todayTotal: number
  /** 近 7 日总量（指标块用）。 */
  d7Total: number
  /** 按来源的拆分。 */
  providers: readonly UsageProviderTotal[]
  /** 状态提示（读取中 / 读取失败）；没有就传 null。 */
  notice?: ReactNode
  /** 底栏状态行。 */
  status: string
  /** 底栏版本号。 */
  version?: string
  /** 底栏动作区。 */
  actions?: ReactNode
  /** 窗口很矮：用更紧的排版。 */
  dense: boolean
  /** 左列宽度（px）：主指标卡与洞察卡住在这一列里。 */
  leftWidth: number
  /** 环能缩到的下限（px）。 */
  ringFloor: number
  /** 入场节拍。 */
  timing: WideTiming
}

/**
 * 宽版面板。
 * @param props - 面板数据、文案与动作。
 * @returns 宽版面板。
 */
export function UsageWideView(props: UsageWideProps): ReactNode {
  const {
    panelRef,
    t,
    buckets,
    total,
    names,
    windowLabel,
    windows,
    windowValue,
    onWindow,
    uncachedShare,
    days,
    daily,
    todayTotal,
    d7Total,
    providers,
    notice,
    status,
    version,
    actions,
    dense,
    leftWidth,
    ringFloor,
    timing,
  } = props

  const scroller = useRef<HTMLDivElement | null>(null)
  const content = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const tabsRef = useRef<HTMLDivElement | null>(null)
  const pillsRef = useRef<HTMLDivElement | null>(null)
  const heroRef = useRef<HTMLDivElement | null>(null)
  const statsRef = useRef<HTMLDivElement | null>(null)
  const insightRef = useRef<HTMLDivElement | null>(null)
  const footerRef = useRef<HTMLDivElement | null>(null)

  /** 宽版里各块之间的间距：紧凑密度下更紧。 */
  const gap = dense ? SPACE.md : SPACE.xl
  /**
   * 环的基准直径：左列宽度减去「环外标签与内边距」那一份。
   *
   * 环住在左列里，列宽的 100px 要留给环外标签戳出去的那一圈。
   */
  const ringBase = Math.round(Math.max(220, Math.min(300, leftWidth - 100)))

  /**
   * 一屏装下：超出的高度由环来吸收。
   *
   * 面板是右栏，宿主给的高度随窗口变——1080p 的浏览器大约 950，
   * 笔记本 750 上下，窄窗全屏时更少。固定高度的设计稿定不了这件事，
   * 只能运行时量：内容比一屏高多少，就把环压小多少，压到下限为止。
   *
   * 只压不放：压过头了下一次量到有余量再放回去，容易来回抖。
   */
  const [squeeze, setSqueeze] = useState(0)
  useLayoutEffect(() => {
    setSqueeze(0)
  }, [ringBase])

  useLayoutEffect(() => {
    const box = scroller.current
    const body = content.current
    if (box === null || body === undefined || body === null) return
    const fit = (): void => {
      const overflow = box.scrollHeight - box.clientHeight
      if (overflow <= 0) return
      setSqueeze((previous) => {
        const next = previous + Math.ceil(overflow)
        const max = Math.max(0, ringBase - ringFloor)
        return next > max ? max : next
      })
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    // 盯着内容层：它的高度变了就重新量（文字换行、数据变化、环被压小都会触发）。
    const observer = new ResizeObserver(fit)
    observer.observe(body)
    return () => observer.disconnect()
  }, [dense, ringBase, ringFloor, windowValue, daily, notice])

  const ringSize = Math.max(ringFloor, ringBase - squeeze)

  // 入场只播一次：之后的刷新走插值，不重播。
  const played = useRef(false)
  useEffect(() => {
    if (played.current) return
    played.current = true
    dropIn(headerRef.current, timing.header)
    dropIn(tabsRef.current, timing.tabs)
    dropIn(pillsRef.current, timing.pills)
    riseIn(heroRef.current, timing.hero, 220)
    riseIn(statsRef.current, timing.kpi)
    riseIn(insightRef.current, timing.insight)
    riseIn(footerRef.current, timing.footer)
  }, [timing])

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
  const deltaText = days <= 1 ? t('delta.vsDay') : t('delta.vs', { days: String(span) })

  // 环外标签：只画百分比，不画桶名——名字由下面的四行遥测承担。
  const ringLabels: readonly RingLabel[] = RING_KEYS.map((key) => ({
    key,
    text: `${percentOf(buckets[key], total)}%`,
  }))

  const ring = (
    <UsageRing3D
      buckets={buckets}
      total={total}
      format={formatCompact}
      caption={t('total.label')}
      captionAccent={windowLabel}
      accent={ACCENT_CYAN}
      sub={(counted) => t('ring.dailyAvg', { value: formatCompact(counted / days) })}
      size={ringSize}
      variant="wide"
      labels={ringLabels}
      timing={{ track: timing.track, arc: timing.arc, arcStep: timing.arcStep, number: timing.number }}
    />
  )

  /**
   * 主指标卡：3D 环 + 涨跌签 + 30 日折线。
   *
   * 与竖屏的 hero 卡是同一套语言——一张深灰半透明卡，
   * 里面是大数（宽版的在 3D 环心里）、涨跌签与折线。
   */
  const hero = (
    <div
      ref={heroRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: SPACE.md,
        padding: '16px 16px 14px',
        borderRadius: RADIUS.md,
        background: CARD,
        border: `1px solid ${CARD_EDGE}`,
      }}
    >
      {/* 上下留出环外标签的位置：标签是绝对定位，会戳出环的方框。 */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>{ring}</div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        <DeltaChip percent={delta} label={deltaText} />
        {totals.length > 1 && (
          <Sparkline values={totals} width={Math.max(120, leftWidth - 34)} height={26} area />
        )}
      </div>
    </div>
  )

  /** 指标块行：两枚并排在一张卡里，中间一道发丝线。与竖屏同款。 */
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

  /** 分类列表：行内微折线 + 行间发丝线，与竖屏同一套列表语言。 */
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
        variant="wide"
        dense={dense}
        series={bucketSeries}
        timing={{ rows: timing.rows, rowStep: timing.rowStep, bars: timing.bars }}
      />
    </div>
  )

  /** 按来源：宽版多出来的一个维度，仍用 v6 的卡片与标签语言。 */
  const providerCard = (
    <div
      style={{
        padding: '13px 14px',
        borderRadius: RADIUS.md,
        background: CARD,
        border: `1px solid ${CARD_EDGE}`,
      }}
    >
      <ProviderList
        title={t('provider.title')}
        items={providers.map((provider) => ({
          key: `${provider.provider}/${provider.model}`,
          label: provider.provider === 'unknown'
            ? t('provider.unknown')
            : `${provider.provider}${provider.model.length > 0 ? ` / ${provider.model}` : ''}`,
          value: formatCount(RING_KEYS.reduce((sum, key) => sum + provider[key], 0)),
        }))}
      />
    </div>
  )

  const insight = (
    <div ref={insightRef}>
      <Insight
        title={t('insight.title')}
        bar={uncachedShare}
        barColor={uncachedShare > 40 ? ACCENT_CYAN : POSITIVE}
      >
        {/* 话跟着数据走：未缓存输入占了大头时，不能还说它「保持低位」。 */}
        {uncachedShare > 40
          ? t('insight.uncachedHigh', { pct: `${uncachedShare}%` })
          : t('insight.uncachedLow', { pct: `${uncachedShare}%` })}
      </Insight>
    </div>
  )

  const tabs = (
    <div ref={tabsRef}>
      <SegmentedControl
        items={[t('view.overview'), t('view.top'), t('view.alerts')]}
        active={0}
        soonHint={t('view.soon')}
        onSelect={() => undefined}
        accent={ACCENT_CYAN}
      />
    </div>
  )

  const pills = (
    <div ref={pillsRef}>
      <WindowPills
        items={windows.map((item) => ({ value: item.value, label: item.label }))}
        value={windowValue}
        onSelect={onWindow}
        accent={ACCENT_CYAN}
      />
    </div>
  )

  const footer = (
    <div ref={footerRef}>
      <StatusFooter
        status={status}
        version={version}
        dot="ok"
        actions={actions}
      />
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
        padding: '22px 30px 24px',
        fontSize: 13,
        lineHeight: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/*
        两层：外层是滚动容器，内层是内容。

        宿主右栏的 Tab 容器是 overflow:hidden，面板再高就再也够不到底栏了，
        所以滚动容器得由自己来当。
        内层单独包一层，是为了量它的实际高度——那才是「内容有多高」。
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
          ref={content}
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

          {/* 控件行：视图分段 + 时间窗药丸，与竖屏同一套控件。 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 28,
              flexWrap: 'wrap',
            }}
          >
            {tabs}
            {pills}
          </div>

          {notice}

          {/* 宽版：左主指标，右指标块 → 分类 → 来源。 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `${leftWidth}px minmax(0, 1fr)`,
              gap: 48,
              alignItems: 'start',
              width: '100%',
              maxWidth: 1120,
              margin: '0 auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.xl,
                alignItems: 'stretch',
              }}
            >
              {hero}
              {insight}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xl, minWidth: 0 }}>
              {stats}
              {telemetry}
              {providerCard}
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/*
            底栏常驻：内容比视口高时，状态条仍贴在可视区底部。

            `marginTop: -gap` + `paddingTop: gap` 是把父级 flex 的行间距
            **搬进自己这一块**——间距还是那个间距，但这段底色是不透明的。
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
            {footer}
          </div>
        </div>
      </div>
    </section>
  )
}
