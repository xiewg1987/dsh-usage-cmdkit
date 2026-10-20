/**
 * 右栏 Tab 的面板：用量 Dashboard。
 *
 * 视觉是 v4 设计稿那一套「深空遥测台」：近黑底、平视网格底纹、
 * 唯一强调色（电光蓝）、四色只出现在环段与进度条上，所有文字中性。
 * 数据仍然来自本机记录的四桶 token，窗口可选今日 / 7 日 / 30 日。
 *
 * 两种形态由面板**实测宽度**决定：
 * - 窄（不到 900px）：右栏窄态的堆叠版——环在上、双 KPI 与四行在下。
 * - 宽（900px 以上）：左环右数据的双栏版（全屏时的主形态）。
 *
 * 判据是量出来的宽度，不是 `useTabInfo().sidebar.fullscreen`：
 * 那个标志只说明面板盖住了整块视口，窗口窄的时候右栏反而会自动全屏，
 * 那时可用宽度更小——按标志选布局会套错构图。
 *
 * 动效见 `design/motion-spec.md` 与 `usage-motion.ts`：
 * 首次进场排一次入场编排，之后界面静止，只留环外柔光极慢呼吸；
 * 刷新走插值，不重播。
 *
 * 样式用内联 style：本插件的浏览器半是独立打包的产物，
 * 不走 harness 的 CSS Modules 管线，内联样式能免掉一整条构建依赖。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { UsageBuckets, UsageProviderTotal, UsageSummary } from '../protocol.js'
import { UsageRing, RING_KEYS, type RingLabel } from './UsageRing.js'
import { UsageTelemetry, type TelemetryName } from './UsageTelemetry.js'
import {
  BrandHeader,
  BottomRule,
  CommandEntry,
  Divider,
  Insight,
  KpiPair,
  ProviderList,
  StatusFooter,
  UsageBackdrop,
  ViewTabs,
  WindowPills,
} from './UsageChrome.js'
import { TIMING, dropIn, riseIn } from './usage-motion.js'
import { DEFAULT_RATES, describeRates, estimateUsd, formatCny, formatUsd, hitRate } from './usage-pricing.js'
import {
  ACCENT,
  EDGE,
  FONT_MONO,
  MUTED,
  SURFACE,
  TEXT,
  formatCompact,
  formatCount,
  percentOf,
} from './usage-theme.js'
import { clearUsageStats, fetchUsageSummary } from './usage-client.js'
/** Props 由 slot 绑定与 locale 绑定组成，不要手工窄化。 */
export type UsageDashboardProps =
  PropsRuntime<'sidebar.right.pane.tab'>
  & PropsLocale<'dsh.usage'>

/** 可切换的时间窗。 */
type Range = 'today' | 'd7' | 'd30'

/** 面板状态：读取中 / 已有数据 / 读失败。 */
type Status = 'loading' | 'ready' | 'failed'

/** 面板实测的可用宽度，以及据此选出的布局形态。 */
interface Surface {
  /** 面板自身的宽度（px）。 */
  width: number
  /** 面板自身的可用高度（px）：一屏能装多少。 */
  height: number
  /** 是否走双栏的宽版布局。 */
  wide: boolean
}

/** 每个时间窗覆盖的日历日数：日均与窗口标签都用它。 */
const RANGE_DAYS: Record<Range, number> = { today: 1, d7: 7, d30: 30 }

/** 窄栏形态的环尺寸上下限。 */
const COMPACT_RING_MIN = 170
const COMPACT_RING_MAX = 300

/**
 * 窄栏里环占面板宽度的比例。
 *
 * 宿主右栏永远是全高的，所以窄栏的参照是 v4 的窄长版（360×800）：
 * 环是主角，但只占三分之二左右——留给下面的双 KPI 与四行遥测。
 */
const COMPACT_RING_RATIO = 0.62

/** 宽版左列（环 + 双 KPI）的宽度区间。 */
const WIDE_LEFT_MIN = 300
const WIDE_LEFT_MAX = 400

/**
 * 宽版整体网格的最大宽度。
 *
 * 面板被拉到 1200px 以上时，数据列再宽就只是把「名字」和「数字」拉得更开，
 * 读起来反而更散。超出的部分留白居中，构图不变形。
 */
const WIDE_GRID_MAX = 1120

/** 宽版两列之间的间距。 */
const WIDE_GAP = 48

/**
 * 环能缩到的下限。
 *
 * 再小就不是环了——四段弧挤在一起、环心的数字也要缩到读不出来。
 * 到了这个下限还装不下，就只能滚动（内容比一屏多时这是物理事实）。
 */
const RING_FLOOR_COMPACT = 150
const RING_FLOOR_WIDE = 190

/** 窗口更矮时，环的下限再放低一点。 */
const RING_FLOOR_TIGHT = 118

/**
 * 低于这个高度就切「紧凑密度」。
 *
 * 宿主右栏的高度随窗口变：1080p 的浏览器大约 900 多，笔记本 768 的屏
 * 只有 600 上下。矮到这个份上，行距、字号、环径下限一起收紧，
 * 才谈得上一屏装下。
 */
const TIGHT_HEIGHT = 820

/** 紧凑版里各块之间的间距。 */
const GAP_COMPACT = 13

/** 紧凑密度下的间距。 */
const GAP_TIGHT = 10

/** 宽版里各块之间的间距。 */
const GAP_WIDE = 18

/**
 * 进入宽版布局的宽度门槛。
 *
 * 宽版是「左环右数据」的双栏：环要连同外侧百分比标签一起放得下，
 * 右列还得容下双 KPI 与四行遥测，900px 是这套构图不打架的下限。
 */
const WIDE_MIN_WIDTH = 900

/**
 * 已经在宽版时的宽度下限：留一点迟滞，免得宽度在门槛上反复横跳。
 */
const WIDE_STAY_WIDTH = 860

/** 空桶：读不到数据时用它占位，形状不变、只有数字是零。 */
const EMPTY_BUCKETS: UsageBuckets = {
  uncachedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
}

/**
 * 把时间戳切成 HH:MM:SS。
 * @param timestamp - 毫秒时间戳。
 * @returns 时分秒。
 */
function clockOf(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * 渲染用量面板。
 * @param props - slot 绑定的 tab 身份与 locale 文案。
 * @returns 面板内容。
 */
export function UsageDashboard({ t }: UsageDashboardProps): ReactNode {
  const [summary, setSummary] = useState<UsageSummary | undefined>(undefined)
  const [status, setStatus] = useState<Status>('loading')
  const [range, setRange] = useState<Range>('d30')
  const [clearing, setClearing] = useState(false)
  const [surface, setSurface] = useState<Surface>({ width: 0, height: 0, wide: false })
  const lifetime = useRef<AbortController | undefined>(undefined)
  const panel = useRef<HTMLElement | null>(null)
  /** 滚动容器：内容超高时它自己滚。 */
  const scroller = useRef<HTMLDivElement | null>(null)
  /** 内容层：高度跟着内容走，用它来量「超了多少」。 */
  const content = useRef<HTMLDivElement | null>(null)
  /** 环被压小的量（px）：由一屏装不装得下决定。 */
  const [squeeze, setSqueeze] = useState(0)

  /**
   * 布局按面板**实测宽度**决定，不看 `sidebar.fullscreen`。
   *
   * 那个标志只说明「面板盖住了整块视口」：窗口窄的时候右栏会自动全屏，
   * 那时可用宽度反而更小。真正决定构图的是量出来的宽度。
   */
  const wide = surface.wide
  const timing = wide ? TIMING.wide : TIMING.compact
  /** 窗口矮：切紧凑密度（行距、字号、环径下限一起收紧）。 */
  const tight = surface.height > 0 && surface.height < TIGHT_HEIGHT
  /** 各块之间的间距：紧凑密度下更紧。 */
  const gap = tight ? GAP_TIGHT : wide ? GAP_WIDE : GAP_COMPACT
  /** 环能缩到的下限。 */
  const ringFloor = tight ? RING_FLOOR_TIGHT : wide ? RING_FLOOR_WIDE : RING_FLOOR_COMPACT

  useLayoutEffect(() => {
    const node = panel.current
    if (node === null) return
    const measure = (): void => {
      const width = node.clientWidth
      const height = node.clientHeight
      setSurface((previous) => {
        const wide = previous.wide ? width >= WIDE_STAY_WIDTH : width >= WIDE_MIN_WIDTH
        if (previous.width === width && previous.height === height && previous.wide === wide) return previous
        return { width, height, wide }
      })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const load = useCallback(async () => {
    const controller = lifetime.current
    if (controller === undefined) return
    const value = await fetchUsageSummary(controller.signal)
    if (controller.signal.aborted) return
    setSummary(value)
    setStatus(value === undefined ? 'failed' : 'ready')
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    setStatus('loading')
    void load()
    return () => {
      controller.abort()
      lifetime.current = undefined
    }
  }, [load])

  const onClear = useCallback(async () => {
    const controller = lifetime.current
    if (controller === undefined || clearing) return
    setClearing(true)
    const cleared = await clearUsageStats(controller.signal)
    if (!controller.signal.aborted) {
      setClearing(false)
      if (cleared) await load()
    }
  }, [clearing, load])

  const buckets = useMemo<UsageBuckets | undefined>(() => {
    if (summary === undefined) return undefined
    if (range === 'today') return summary.today
    if (range === 'd7') return summary.d7
    return summary.d30
  }, [summary, range])

  const providers = useMemo<readonly UsageProviderTotal[]>(
    () => summary?.byProvider ?? [],
    [summary],
  )

  const shown = buckets ?? EMPTY_BUCKETS
  const total = useMemo<number>(
    () => RING_KEYS.reduce((sum, key) => sum + shown[key], 0),
    [shown],
  )

  /** 四个桶的全名：遥测列表用这一份，写得完整、读得懂。 */
  const names = useMemo<readonly TelemetryName[]>(
    () => [
      { key: 'uncachedInputTokens', label: t('bucket.uncachedInput') },
      { key: 'outputTokens', label: t('bucket.output') },
      { key: 'cacheReadTokens', label: t('bucket.cacheRead') },
      { key: 'cacheWriteTokens', label: t('bucket.cacheWrite') },
    ],
    [t],
  )

  const windowLabel = range === 'today' ? t('window.today') : range === 'd7' ? t('window.d7') : t('window.d30')
  const uncachedShare = percentOf(shown.uncachedInputTokens, total)
  /** 窄栏里的环随面板宽度缩放：宽一点就大一点，但封顶。 */
  const baseRing = wide
    ? Math.round(Math.max(220, Math.min(300, Math.max(WIDE_LEFT_MIN, Math.min(WIDE_LEFT_MAX, surface.width * 0.32)) - 100)))
    : Math.round(
      Math.max(COMPACT_RING_MIN, Math.min(COMPACT_RING_MAX, surface.width * COMPACT_RING_RATIO)),
    )
  /** 宽版左列的宽度：环与双 KPI 住在这一列里。 */
  const wideLeft = Math.round(
    Math.max(WIDE_LEFT_MIN, Math.min(WIDE_LEFT_MAX, surface.width * 0.32)),
  )
  /** 环的最终直径：基准值再减去「一屏装不下」要压掉的量。 */
  const ringSize = Math.max(ringFloor, baseRing - squeeze)

  /**
   * 一屏装下：超出的高度由环来吸收。
   *
   * 面板是右栏，宿主给的高度随窗口变——1080p 的浏览器大约 950，
   * 笔记本 750 上下，窄窗全屏时更少。固定高度的设计稿定不了这件事，
   * 只能运行时量：内容比一屏高多少，就把环压小多少，压到下限为止。
   *
   * 只压不放：压过头了下一次量到有余量再放回去，容易来回抖。
   * 宽度变了（换布局 / 拖窗口）时把压减值清零，重新按新宽度算基准。
   */
  useLayoutEffect(() => {
    setSqueeze(0)
  }, [baseRing])

  useLayoutEffect(() => {
    const box = scroller.current
    const body = content.current
    if (box === null || body === undefined || body === null) return
    const fit = (): void => {
      const overflow = box.scrollHeight - box.clientHeight
      if (overflow <= 0) return
      setSqueeze((previous) => {
        const next = previous + Math.ceil(overflow)
        const max = Math.max(0, baseRing - ringFloor)
        return next > max ? max : next
      })
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    // 盯着内容层：它的高度变了就重新量（文字换行、数据变化、环被压小都会触发）。
    const observer = new ResizeObserver(fit)
    observer.observe(body)
    return () => observer.disconnect()
  }, [wide, tight, baseRing, ringFloor, range, status, summary])

  // 入场编排的挂点：品牌头、视图 Tab、时间窗、双 KPI、洞察、命令入口、底栏。
  const headerRef = useRef<HTMLDivElement | null>(null)
  const tabsRef = useRef<HTMLDivElement | null>(null)
  const pillsRef = useRef<HTMLDivElement | null>(null)
  const kpiRef = useRef<HTMLDivElement | null>(null)
  const insightRef = useRef<HTMLDivElement | null>(null)
  const entryRef = useRef<HTMLDivElement | null>(null)
  const footerRef = useRef<HTMLDivElement | null>(null)

  // 入场只播一次：之后的刷新走插值，不重播。
  const played = useRef(false)
  useEffect(() => {
    if (played.current) return
    played.current = true
    dropIn(headerRef.current, timing.header)
    dropIn(tabsRef.current, timing.tabs)
    dropIn(pillsRef.current, timing.pills)
    riseIn(kpiRef.current, timing.kpi)
    riseIn(insightRef.current, timing.insight)
    riseIn(entryRef.current, timing.entry)
    riseIn(footerRef.current, timing.footer)
  }, [timing])

  const ghostButton = {
    font: 'inherit',
    fontFamily: FONT_MONO,
    fontSize: 9,
    letterSpacing: '0.08em',
    padding: '4px 8px',
    borderRadius: 5,
    border: `1px solid ${EDGE}`,
    background: 'transparent',
    color: MUTED,
    cursor: 'pointer',
  } as const

  const actions = (
    <>
      <button type="button" data-usage-refresh="" style={ghostButton} onClick={() => void load()}>
        {t('action.refresh')}
      </button>
      <button
        type="button"
        data-usage-clear=""
        style={ghostButton}
        disabled={clearing}
        onClick={() => void onClear()}
      >
        {clearing ? t('action.clearing') : t('action.clear')}
      </button>
    </>
  )

  const telemetry = (
    <UsageTelemetry
      buckets={shown}
      names={names}
      variant={wide ? 'hero' : 'compact'}
      dense={tight}
      timing={{ rows: timing.rows, rowStep: timing.rowStep, bars: timing.bars }}
    />
  )

  // 环外标签：v4 只画百分比，不画桶名——名字由下面的四行遥测承担。
  const ringLabels: readonly RingLabel[] = RING_KEYS.map((key) => ({
    key,
    text: `${percentOf(shown[key], total)}%`,
  }))

  const rate = hitRate(shown)
  const cost = estimateUsd(shown)
  const kpiPair = (
    <div ref={kpiRef}>
      <KpiPair
        left={{
          label: t('kpi.hitRate'),
          value: `${(rate * 100).toFixed(1)}%`,
          sub: t('kpi.hitSub', { count: formatCount(shown.cacheReadTokens) }),
          subColor: ACCENT,
        }}
        right={{
          label: t('kpi.cost'),
          value: `≈ ${formatUsd(cost)}`,
          sub: t('kpi.costSub', { window: windowLabel, cny: formatCny(cost) }),
          title: t('kpi.rates', { rates: describeRates(DEFAULT_RATES) }),
        }}
      />
    </div>
  )

  const providerList = (
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
  )

  const insight = (
    <div ref={insightRef}>
      <Insight>
        {/* 话跟着数据走：未缓存输入占了大头时，不能还说它「保持低位」。 */}
        {uncachedShare > 40
          ? t('insight.uncachedHigh', { pct: `${uncachedShare}%` })
          : t('insight.uncachedLow', { pct: `${uncachedShare}%` })}
      </Insight>
    </div>
  )

  const ring = (
    <UsageRing
      buckets={shown}
      total={total}
      format={formatCompact}
      caption={t('total.label')}
      captionAccent={windowLabel}
      sub={(counted) => t('ring.dailyAvg', { value: formatCompact(counted / RANGE_DAYS[range]) })}
      size={ringSize}
      variant={wide ? 'wide' : 'compact'}
      labels={ringLabels}
      timing={{ track: timing.track, arc: timing.arc, arcStep: timing.arcStep, number: timing.number }}
    />
  )

  const tabs = (
    <div ref={tabsRef}>
      <ViewTabs
        items={[t('view.overview'), t('view.cost'), t('view.top'), t('view.alerts')]}
        active={0}
        soonHint={t('view.soon')}
        onSelect={() => undefined}
      />
    </div>
  )

  const pills = (
    <div ref={pillsRef}>
      <WindowPills
        items={[
          { value: 'today', label: t('window.today') },
          { value: 'd7', label: t('window.d7') },
          { value: 'd30', label: t('window.d30') },
        ]}
        value={range}
        onSelect={(value) => setRange(value as Range)}
      />
    </div>
  )

  const commandEntry = (
    <div ref={entryRef}>
      <CommandEntry
        badge={t('entry.badge')}
        label={t('entry.commands')}
        hint={t('entry.hint')}
        unavailableHint={t('entry.soon')}
        ready={false}
      />
    </div>
  )

  const footer = (
    <div ref={footerRef}>
      <StatusFooter
        status={`${t('footer.repo')} · ${t('footer.synced')} · ${t('footer.local')}${
          summary === undefined ? '' : ` · ${clockOf(summary.generatedAt)}`
        }`}
        actions={actions}
      />
    </div>
  )

  return (
    <section
      data-usage-dashboard=""
      ref={panel}
      style={{
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        height: '100%',
        maxHeight: '100%',
        background: SURFACE,
        color: TEXT,
        border: `1px solid ${EDGE}`,
        borderRadius: 14,
        padding: tight ? '10px 12px 10px' : wide ? '22px 30px 24px' : '14px 16px 14px',
        fontSize: 13,
        lineHeight: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <UsageBackdrop />

      {/*
        两层：外层是滚动容器，内层是内容。

        宿主右栏的 Tab 容器是 overflow:hidden，面板再高就再也够不到底栏了，
        所以滚动容器得由自己来当；背景网格留在 section 上，不跟着内容滚。
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
            commandsLabel={t('brand.commands')}
            commandsReady={false}
            commandsHint={t('brand.commandsSoon')}
          />
        </div>
        <Divider />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            // 窄栏把时间窗推到右侧；宽面板上两端对齐会把两者拉得太散，改成成组靠左。
            justifyContent: wide ? 'flex-start' : 'space-between',
            gap: wide ? 28 : 12,
            flexWrap: 'wrap',
          }}
        >
          {tabs}
          {pills}
        </div>

        {status === 'loading' && <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{t('state.loading')}</p>}
        {status === 'failed' && <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{t('state.failed')}</p>}

        {status === 'ready' && buckets !== undefined && (
          wide
            ? (
              /* 宽版：左环右数据。命令面板那一面还没实现，右列留给用量本身。 */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `${wideLeft}px minmax(0, 1fr)`,
                  gap: WIDE_GAP,
                  alignItems: 'start',
                  width: '100%',
                  maxWidth: WIDE_GRID_MAX,
                  margin: '0 auto',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 24,
                    alignItems: 'stretch',
                  }}
                >
                  {/* 上下留出环外标签的位置：标签是绝对定位，会戳出环的方框。 */}
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '18px 0' }}>{ring}</div>
                  {kpiPair}
                  {insight}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
                  {telemetry}
                  {providerList}
                </div>
              </div>
            )
            : (
              /* 窄栏：环在上、双 KPI 与四行在下，读数优先。 */
              <div style={{ display: 'flex', flexDirection: 'column', gap }}>
                {/* 上下留出环外标签的位置：标签是绝对定位，会戳出环的方框。 */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '18px 36px' }}>{ring}</div>
                <Divider />
                {kpiPair}
                <Divider />
                {telemetry}
                <Divider />
                {insight}
                {providerList}
              </div>
            )
        )}

        <div style={{ flex: 1 }} />
        <Divider />
        {commandEntry}
        <Divider />
        {footer}
        <BottomRule />
        </div>
      </div>
    </section>
  )
}
