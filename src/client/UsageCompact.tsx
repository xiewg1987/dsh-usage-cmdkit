/**
 * 竖屏（窄栏）面板：金融竖屏那一版视觉。
 *
 * 与宽版（≥900px 的双栏 + 3D 轨道矩阵）是**两套独立构图**，不是同一套的缩放：
 * 竖屏这一版按「夜里看盘」的竖屏应用重排——
 *
 *   大数（总 tokens） → 小环（占比） → 指标卡（命中率） → 四行分类 → 一句洞察
 *
 * 视觉规矩（全页只允许两种彩色）：
 * - 底色近黑的午夜蓝，卡片是深灰半透明圆角，**没有霓虹描边、没有网格**；
 * - 界面色只有蓝青一种（选中态、进度环、标签）；
 * - 品类色退回到「一颗小圆点 + 一条 5px 细进度条」，不发光、不画柱；
 * - 数值白、标签灰，其余一律灰阶。
 *
 * 组件自己不绑 locale：`t` 由调用方传进来。
 * 这样同一份代码既挂在宿主里（locale 服务注入 `t`），
 * 也能在设计稿预览里喂一份本地字典（`design/_v5_src/`）——
 * **预览图渲染的就是这份实现本身**，不是另画一张。
 */
import { useEffect, useRef, type ReactNode, type Ref } from 'react'
import type { UsageBuckets } from '../protocol.js'
import {
  BrandHeader,
  Insight,
  Kpi,
  StatusFooter,
  ViewTabs,
  WindowPills,
} from './UsageChrome.js'
import { UsageTelemetry, type TelemetryName } from './UsageTelemetry.js'
import {
  ACCENT_CYAN,
  CARD,
  CARD_EDGE,
  FAINT,
  FONT_MONO,
  HAIR,
  MUTED,
  PANEL_BG,
  POSITIVE,
  RING_TRACK,
  TEXT,
  formatCompact,
  formatCount,
  percentOf,
} from './usage-theme.js'
import { dropIn, riseIn, useCountUp } from './usage-motion.js'
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
  /** 指标卡。 */
  kpi: number
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

/** 小进度环的属性。 */
export interface MiniRingProps {
  /** 占比（0–100）。 */
  share: number
  /** 直径（px）。 */
  size: number
  /** 环心的数字。 */
  center: string
  /** 环下方的说明。 */
  caption: string
}

/**
 * 小进度环：**一条**蓝青进度 + 一圈暗灰轨道。
 *
 * 旧版的大环是四段彩虹（每一桶一段），在竖屏上既占地方又吵。
 * 这里只留一条进度：环心一个数、环下一行说明，讲清「这个数是什么」就够了。
 *
 * @param props - 占比、直径、环心数字与说明。
 * @returns 小进度环。
 */
export function MiniRing(props: MiniRingProps): ReactNode {
  const { share, size, center, caption } = props
  const stroke = Math.max(4, Math.round(size * 0.078))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, share))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 'none' }}>
      <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
        <svg width={size} height={size} style={{ display: 'block', transform: 'rotate(-90deg)' }} aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={RING_TRACK}
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ACCENT_CYAN}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(circumference * clamped) / 100} ${circumference}`}
          />
        </svg>
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.round(size * 0.2),
            fontWeight: 700,
            color: TEXT,
            letterSpacing: '-0.01em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {center}
        </span>
      </div>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 8,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: FAINT,
          whiteSpace: 'nowrap',
        }}
      >
        {caption}
      </span>
    </div>
  )
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
  /** 时间窗的短标签（30D / 30 日），主指标与花费副行用。 */
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
  /** 状态提示（读取中 / 读取失败）；没有就传 null。 */
  notice?: ReactNode
  /** 底栏状态行。 */
  status: string
  /** 底栏动作区。 */
  actions?: ReactNode
  /** 窗口很矮：用更紧的排版。 */
  dense: boolean
  /** 入场节拍。 */
  timing: CompactTiming
}

/**
 * 渲染竖屏面板。
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
    notice,
    status,
    actions,
    dense,
    timing,
  } = props

  const scroller = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const tabsRef = useRef<HTMLDivElement | null>(null)
  const pillsRef = useRef<HTMLDivElement | null>(null)
  const heroRef = useRef<HTMLDivElement | null>(null)
  const kpiRef = useRef<HTMLDivElement | null>(null)
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
    riseIn(kpiRef.current, timing.kpi, 200)
    riseIn(insightRef.current, timing.insight, 200)
    riseIn(footerRef.current, timing.footer, 180)
  }, [timing])

  /** 主数字：入场从 0 滚上来。 */
  const counted = useCountUp(total, timing.hero, 520)
  const gap = dense ? 12 : 16
  const share = percentOf(buckets.uncachedInputTokens, total)

  const hero = (
    <div
      ref={heroRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        padding: '16px 16px',
        borderRadius: 12,
        background: CARD,
        border: `1px solid ${CARD_EDGE}`,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
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
        <span style={{ fontSize: 10.5, color: MUTED }}>
          {t('ring.dailyAvg', { value: formatCompact(counted / days) })}
        </span>
      </div>
      <MiniRing
        share={share}
        size={dense ? 56 : 64}
        center={`${share}%`}
        caption={t('bucket.uncachedInput.short')}
      />
    </div>
  )

  const kpi = (
    <div ref={kpiRef}>
      <div
        style={{
          padding: '12px 13px',
          borderRadius: 10,
          background: CARD,
          border: `1px solid ${CARD_EDGE}`,
          minWidth: 0,
        }}
      >
        <Kpi
          label={t('kpi.hitRate')}
          labelColor={FAINT}
          value={`${(rate * 100).toFixed(1)}%`}
          sub={t('kpi.hitSub', { count: formatCount(buckets.cacheReadTokens) })}
          subColor={POSITIVE}
        />
      </div>
    </div>
  )

  const telemetry = (
    <div
      style={{
        padding: '14px 14px',
        borderRadius: 12,
        background: CARD,
        border: `1px solid ${CARD_EDGE}`,
      }}
    >
      <UsageTelemetry
        buckets={buckets}
        names={names}
        variant="flat"
        dense={dense}
        timing={{ rows: timing.rows, rowStep: timing.rowStep, bars: timing.bars }}
      />
    </div>
  )

  // 洞察跟着数据走：未缓存输入占了大头时，不能还说它「保持低位」。
  const insight = (
    <div ref={insightRef}>
      <Insight variant="card">
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
        borderRadius: 14,
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
            />
          </div>

          <div aria-hidden="true" style={{ height: 1, background: HAIR, flex: 'none' }} />

          {/* 视图 Tab 与时间窗：窄屏放不下就换行，药丸靠右。 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div ref={tabsRef}>
              <ViewTabs
                items={[t('view.overview'), t('view.top'), t('view.alerts')]}
                active={0}
                soonHint={t('view.soon')}
                onSelect={() => undefined}
                accent={ACCENT_CYAN}
                size="compact"
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
          {kpi}
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
            <div aria-hidden="true" style={{ height: 1, background: HAIR, flex: 'none' }} />
            <div ref={footerRef}>
              <StatusFooter status={status} size="compact" actions={actions} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
