/**
 * 右栏 Tab 的面板：用量 Dashboard。
 *
 * 面板有**两套独立构图**，按面板实测宽度切换：
 *
 * - 窄（不到 900px）：**金融竖屏**那一版（`UsageCompact.tsx`）——
 *   大数（总 tokens）→ 小环（未缓存占比）→ 一枚指标卡（缓存命中率）→ 四行分类 → 一句洞察。
 *   近黑午夜蓝底、深灰半透明卡片，全页只两种彩色：蓝青（界面）+ 绿（涨跌）。
 * - 宽（900px 以上）：v5 的「3D 轨道矩阵」双栏（左环右数据，全屏时的主形态）。
 *
 * 判据是量出来的宽度，不是 `useTabInfo().sidebar.fullscreen`：
 * 那个标志只说明面板盖住了整块视口，窗口窄的时候右栏反而会自动全屏，
 * 那时可用宽度更小——按标志选布局会套错构图。
 *
 * 动效见 `design/motion-spec.md` 与 `usage-motion.ts`：
 * 首次进场排一次入场编排，之后界面静止；
 * 刷新走插值，不重播。
 *
 * 样式用内联 style：本插件的浏览器半是独立打包的产物，
 * 不走 harness 的 CSS Modules 管线，内联样式能免掉一整条构建依赖。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { UsageBuckets, UsageProviderTotal } from '../protocol.js'
import { RING_KEYS, type RingLabel } from './UsageRing.js'
import { UsageRing3D } from './UsageRing3D.js'
import { UsageTelemetry, type TelemetryName } from './UsageTelemetry.js'
import { UsageCompactView } from './UsageCompact.js'
import {
  BrandHeader,
  BottomRule,
  Divider,
  Insight,
  Kpi,
  ProviderList,
  StatusFooter,
  UsageBackdrop,
  ViewTabs,
  WindowPills,
} from './UsageChrome.js'
import { TIMING, dropIn, riseIn } from './usage-motion.js'
import { IconRefresh, IconTrash } from './usage-icons.js'
import { hitRate } from './usage-metrics.js'
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
import { PLUGIN_VERSION } from './usage-version.js'
import {
  clearUsage,
  ensureUsageLoaded,
  loadUsage,
  setUsageRange,
  useUsageState,
  type UsageRange,
} from './usage-state.js'
/** Props 由 slot 绑定与 locale 绑定组成，不要手工窄化。 */
export type UsageDashboardProps =
  PropsRuntime<'sidebar.right.pane.tab'>
  & PropsLocale<'dsh.usage'>

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
const RANGE_DAYS: Record<UsageRange, number> = { today: 1, d7: 7, d30: 30 }

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
const TIGHT_HEIGHT = 720

/** 紧凑密度下的间距。 */
const GAP_TIGHT = 10

/** 宽版里各块之间的间距。 */
const WIDE_GAP_EXTRA = 18

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
  // 数据、时间窗、清空状态都住在共享 store 里：面板被宿主重挂时数据留在原地。
  const { summary, status, range, clearing } = useUsageState()
  const [surface, setSurface] = useState<Surface>({ width: 0, height: 0, wide: false })
  /** 滚动容器：内容超高时它自己滚。 */
  const scroller = useRef<HTMLDivElement | null>(null)
  /** 内容层：高度跟着内容走，用它来量「超了多少」。 */
  const content = useRef<HTMLDivElement | null>(null)
  /** 环被压小的量（px）：由一屏装不装得下决定。 */
  const [squeeze, setSqueeze] = useState(0)

  /**
   * 面板的测量锚点。
   *
   * 用回调 ref 而不是对象 ref：两套构图的根节点是**不同的元素**，
   * 换布局时 React 会先给旧节点回传 null、再给新节点回传节点。
   * 回调 ref 正好能在换节点时重新量、重新挂观察器——
   * 对象 ref 只会把 `current` 指向新节点，旧的观察器还盯着已经脱离文档的节点。
   */
  const observerRef = useRef<ResizeObserver | null>(null)
  const panelRef = useCallback((node: HTMLElement | null): void => {
    observerRef.current?.disconnect()
    observerRef.current = null
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
    observerRef.current = observer
  }, [])

  useEffect(() => { ensureUsageLoaded() }, [])

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

  /** 今日与近 7 日的总量：竖屏那两枚指标块用。 */
  const todayTotal = useMemo<number>(
    () => (summary === undefined ? 0 : RING_KEYS.reduce((sum, key) => sum + summary.today[key], 0)),
    [summary],
  )
  const d7Total = useMemo<number>(
    () => (summary === undefined ? 0 : RING_KEYS.reduce((sum, key) => sum + summary.d7[key], 0)),
    [summary],
  )

  /** 四个桶的全名：宽版遥测列表用这一份，写得完整、读得懂。 */
  const names = useMemo<readonly TelemetryName[]>(
    () => [
      { key: 'uncachedInputTokens', label: t('bucket.uncachedInput') },
      { key: 'outputTokens', label: t('bucket.output') },
      { key: 'cacheReadTokens', label: t('bucket.cacheRead') },
      { key: 'cacheWriteTokens', label: t('bucket.cacheWrite') },
    ],
    [t],
  )

  /**
   * 四个桶的短名：竖屏那一版用。
   *
   * 竖屏一行要放下「圆点 + 名字 + 绝对数 + 百分比」，
   * 全名（例如「输入（未命中缓存）」）会把行撑破，短名刚好。
   */
  const shortNames = useMemo<readonly TelemetryName[]>(
    () => [
      { key: 'uncachedInputTokens', label: t('bucket.uncachedInput.short') },
      { key: 'outputTokens', label: t('bucket.output.short') },
      { key: 'cacheReadTokens', label: t('bucket.cacheRead.short') },
      { key: 'cacheWriteTokens', label: t('bucket.cacheWrite.short') },
    ],
    [t],
  )

  const windowLabel = range === 'today' ? t('window.today') : range === 'd7' ? t('window.d7') : t('window.d30')
  const windowShort = range === 'today'
    ? t('window.today.short')
    : range === 'd7'
      ? t('window.d7.short')
      : t('window.d30.short')
  const uncachedShare = percentOf(shown.uncachedInputTokens, total)
  const rate = hitRate(shown)

  const wide = surface.wide
  /** 窗口矮：切紧凑密度（行距、字号、环径下限一起收紧）。 */
  const tight = surface.height > 0 && surface.height < TIGHT_HEIGHT
  /** 宽版里各块之间的间距：紧凑密度下更紧。 */
  const gap = tight ? GAP_TIGHT : WIDE_GAP_EXTRA
  /** 环能缩到的下限。 */
  const ringFloor = tight ? RING_FLOOR_TIGHT : RING_FLOOR_WIDE
  /** 宽版左列的宽度：环与双 KPI 住在这一列里。 */
  const wideLeft = Math.round(
    Math.max(WIDE_LEFT_MIN, Math.min(WIDE_LEFT_MAX, surface.width * 0.32)),
  )
  /** 宽版左列的环基准直径。 */
  const baseRing = Math.round(
    Math.max(220, Math.min(300, Math.max(WIDE_LEFT_MIN, Math.min(WIDE_LEFT_MAX, surface.width * 0.32)) - 100)),
  )
  /** 环的最终直径：基准值再减去「一屏装不下」要压掉的量。 */
  const ringSize = Math.max(ringFloor, baseRing - squeeze)
  const timing = TIMING.wide

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

  // 入场编排的挂点：品牌头、视图 Tab、时间窗、KPI、洞察、底栏。
  const headerRef = useRef<HTMLDivElement | null>(null)
  const tabsRef = useRef<HTMLDivElement | null>(null)
  const pillsRef = useRef<HTMLDivElement | null>(null)
  const kpiRef = useRef<HTMLDivElement | null>(null)
  const insightRef = useRef<HTMLDivElement | null>(null)
  const footerRef = useRef<HTMLDivElement | null>(null)

  // 入场只播一次：之后的刷新走插值，不重播。
  const played = useRef(false)
  useEffect(() => {
    if (!wide || played.current) return
    played.current = true
    dropIn(headerRef.current, timing.header)
    dropIn(tabsRef.current, timing.tabs)
    dropIn(pillsRef.current, timing.pills)
    riseIn(kpiRef.current, timing.kpi)
    riseIn(insightRef.current, timing.insight)
    riseIn(footerRef.current, timing.footer)
  }, [timing, wide])

  /**
   * 底栏那两个动作按钮。
   *
   * 竖屏那一版用紧凑档：状态行（仓库名 · 同步 · 本机 · 版本号）必须整行放得下，
   * 动作按钮再宽一点就会把版本号挤成省略号。
   *
   * 按钮带图标（刷新 ↻ / 清空 🗑，都是 Lucide 路径），但**不省掉文字**：
   * 「清空」是不可撤销的操作，光靠一个垃圾桶图标认不出会点到什么。
   */
  const ghostButton = {
    font: 'inherit',
    fontFamily: FONT_MONO,
    fontSize: wide ? 9 : 8.5,
    letterSpacing: '0.08em',
    padding: wide ? '4px 8px' : '3px 6px',
    borderRadius: 5,
    border: `1px solid ${EDGE}`,
    background: 'transparent',
    color: MUTED,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  } as const

  const actions = (
    <>
      <button type="button" data-usage-refresh="" style={ghostButton} onClick={() => void loadUsage()}>
        <IconRefresh size={11} color={MUTED} strokeWidth={2} />
        {t('action.refresh')}
      </button>
      <button
        type="button"
        data-usage-clear=""
        style={ghostButton}
        disabled={clearing}
        onClick={() => void clearUsage()}
      >
        <IconTrash size={11} color={MUTED} strokeWidth={2} />
        {clearing ? t('action.clearing') : t('action.clear')}
      </button>
    </>
  )

  /** 底栏状态行：仓库名 · 同步状态 · 本机状态。 */
  const footerStatus = `${t('footer.repo')} · ${t('footer.synced')} · ${t('footer.local')}`

  /** 底栏版本号：单独一段。 */
  const footerVersion = `v${PLUGIN_VERSION}`

  /**
   * 窄栏：金融竖屏那一版。
   *
   * 3D 轨道矩阵是宽版的构图——在 360px 宽的竖屏上它既占地方又吵，
   * 所以窄栏换成扁平版：大数 + 小环 + 指标卡 + 分类列表。
   */
  if (!wide) {
    const notice = status === 'loading'
      ? <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{t('state.loading')}</p>
      : status === 'failed'
        ? <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{t('state.failed')}</p>
        : null
    return (
      <UsageCompactView
        panelRef={panelRef}
        t={t}
        buckets={shown}
        total={total}
        names={shortNames}
        windowShort={windowShort}
        windows={[
          // 窄栏用短档位（1D / 7D / 30D）：360 宽下长短两套标签放不进一行，
          // 折成两行会把下面所有区块往下推 28px。
          { value: 'today', label: t('window.today.short') },
          { value: 'd7', label: t('window.d7.short') },
          { value: 'd30', label: t('window.d30.short') },
        ]}
        windowValue={range}
        onWindow={(value) => setUsageRange(value as UsageRange)}
        rate={rate}
        uncachedShare={uncachedShare}
        days={RANGE_DAYS[range]}
        daily={summary?.daily}
        todayTotal={todayTotal}
        d7Total={d7Total}
        notice={notice}
        // 窄栏底栏不重复包名：品牌头已经写着「DSH CmdKit」，
        // 这里再写一遍「dsh-usage-cmdkit」只会把版本号挤掉。
        status={`${t('footer.synced')} · ${t('footer.local')}`}
        version={footerVersion}
        actions={actions}
        dense={tight}
        timing={TIMING.compact}
      />
    )
  }

  const telemetry = (
    <UsageTelemetry
      buckets={shown}
      names={names}
      variant="hero"
      dense={tight}
      timing={{ rows: timing.rows, rowStep: timing.rowStep, bars: timing.bars }}
    />
  )

  // 环外标签：v4 只画百分比，不画桶名——名字由下面的四行遥测承担。
  const ringLabels: readonly RingLabel[] = RING_KEYS.map((key) => ({
    key,
    text: `${percentOf(shown[key], total)}%`,
  }))

  const kpi = (
    <div ref={kpiRef}>
      <Kpi
        label={t('kpi.hitRate')}
        value={`${(rate * 100).toFixed(1)}%`}
        sub={t('kpi.hitSub', { count: formatCount(shown.cacheReadTokens) })}
        subColor={ACCENT}
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
    <UsageRing3D
      buckets={shown}
      total={total}
      format={formatCompact}
      caption={t('total.label')}
      captionAccent={windowLabel}
      sub={(counted) => t('ring.dailyAvg', { value: formatCompact(counted / RANGE_DAYS[range]) })}
      size={ringSize}
      variant="wide"
      labels={ringLabels}
      timing={{ track: timing.track, arc: timing.arc, arcStep: timing.arcStep, number: timing.number }}
    />
  )

  const tabs = (
    <div ref={tabsRef}>
      <ViewTabs
        items={[t('view.overview'), t('view.top'), t('view.alerts')]}
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
        onSelect={(value) => setUsageRange(value as UsageRange)}
      />
    </div>
  )

  const footer = (
    <div ref={footerRef}>
      <StatusFooter
        status={footerStatus}
        version={footerVersion}
        title={summary === undefined ? undefined : clockOf(summary.generatedAt)}
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
        background: SURFACE,
        color: TEXT,
        border: `1px solid ${EDGE}`,
        borderRadius: 14,
        padding: '22px 30px 24px',
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
          />
        </div>
        <Divider />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 28,
            flexWrap: 'wrap',
          }}
        >
          {tabs}
          {pills}
        </div>

        {status === 'loading' && <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{t('state.loading')}</p>}
        {status === 'failed' && <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{t('state.failed')}</p>}

        {status === 'ready' && buckets !== undefined && (
          /* 宽版：左环右数据。 */
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
              {kpi}
              {insight}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              {telemetry}
              {providerList}
            </div>
          </div>
        )}

        <div style={{ flex: 1 }} />
        <Divider />
        {footer}
        <BottomRule />
        </div>
      </div>
    </section>
  )
}
