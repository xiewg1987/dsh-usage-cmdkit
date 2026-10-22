/**
 * 右栏 Tab 的面板：用量 Dashboard。
 *
 * 面板有**两套独立构图**，按面板实测宽度切换：
 *
 * - 窄（不到 900px）：**v6 竖屏**那一版（`UsageCompact.tsx`）——
 *   大数（总 tokens）→ 涨跌签 + 折线 + 命中率表盘 → 两枚指标块
 *   → 四行分类（带行内微折线）→ 洞察卡 → 状态条。
 * - 宽（900px 以上）：**v6 宽版**（`UsageWide.tsx`）——
 *   主视觉换成大号扁平环，卡片与标签语言跟竖屏**完全统一**：
 *   同样的分段控件、描边药丸、
 *   两枚指标块、带行内微折线的分类列表、三层洞察卡、绿点底栏。
 *
 * 两套构图是**同一套视觉语言的两块画布**，不是两代设计：
 * 读法一致（先主指标，再指标块，再分类，最后洞察），
 * 差别只在版面的宽窄与主视觉（小表盘 vs 大环）。
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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { UsageBuckets, UsageProviderDaily, UsageProviderTotal } from '../../protocol.js'
import { RING_KEYS } from '../components/UsageRing.js'
import { UsageCompactView } from './UsageCompact.js'
import { UsageWideView } from './UsageWide.js'
import { UsageTopView } from './UsageTopView.js'
import { UsageAlertsView } from './UsageAlertsView.js'
import type { UsageView } from '../components/UsageHeader.js'
import { deriveAlerts } from '../data/usage-alerts.js'
import type { TelemetryName } from '../components/UsageTelemetry.js'
import { IconRefresh, IconTrash } from '../components/usage-icons.js'
import { hitRate } from '../data/usage-metrics.js'
import { TIMING } from '../motion/usage-motion.js'
import { ghostButtonStyle } from '../theme/usage-buttons.js'
import { MUTED } from '../theme/usage-theme.js'
import { PLUGIN_VERSION } from '../usage-version.js'
import {
  clearUsage,
  ensureUsageLoaded,
  loadUsage,
  setUsageRange,
  useUsageState,
  type UsageRange,
} from '../data/usage-state.js'
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

/** 宽版左列的宽度区间。 */
const WIDE_LEFT_MIN = 300
const WIDE_LEFT_MAX = 400

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

/**
 * 进入宽版布局的宽度门槛。
 *
 * 宽版是「左主指标右数据」的双栏：环要连同外侧百分比标签一起放得下，
 * 右列还得容下指标块与四行遥测，900px 是这套构图不打架的下限。
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
 * 渲染用量面板。
 * @param props - slot 绑定的 tab 身份与 locale 文案。
 * @returns 面板内容。
 */
export function UsageDashboard({ t }: UsageDashboardProps): ReactNode {
  // 数据、时间窗、清空状态都住在共享 store 里：面板被宿主重挂时数据留在原地。
  const { summary, status, range, clearing } = useUsageState()
  const [surface, setSurface] = useState<Surface>({ width: 0, height: 0, wide: false })
  /**
   * 当前视图：总览 / Top / 告警。
   *
   * 放在面板这一层而不是各自视图里：竖屏与宽版共用同一个视图状态，
   * 面板在两种构图之间换（宽度跨过 900px）时，用户看的还是同一屏。
   */
  const [view, setView] = useState<UsageView>('overview')

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

  /** 每个 provider/model 的逐日序列：Top 屏的「模型走向」用。 */
  const dailyByProvider = useMemo<readonly UsageProviderDaily[]>(
    () => summary?.dailyByProvider ?? [],
    [summary],
  )

  const shown = buckets ?? EMPTY_BUCKETS
  const total = useMemo<number>(
    () => RING_KEYS.reduce((sum, key) => sum + shown[key], 0),
    [shown],
  )

  /** 今日与近 7 日的总量：那两枚指标块用。 */
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
  const uncachedShare = Math.round((shown.uncachedInputTokens / (total > 0 ? total : 1)) * 100)
  const rate = hitRate(shown)

  const wide = surface.wide
  /** 窗口矮：切紧凑密度（行距、字号、环径下限一起收紧）。 */
  const tight = surface.height > 0 && surface.height < TIGHT_HEIGHT
  /** 环能缩到的下限。 */
  const ringFloor = tight ? RING_FLOOR_TIGHT : RING_FLOOR_WIDE
  /** 宽版左列的宽度：主指标卡与洞察卡住在这一列里。 */
  const leftWidth = Math.round(
    Math.max(WIDE_LEFT_MIN, Math.min(WIDE_LEFT_MAX, surface.width * 0.32)),
  )

  /**
   * 底栏那两个动作按钮。
   *
   * 按钮带图标（刷新 ↻ / 清空 🗑，都是 Lucide 路径），但**不省掉文字**：
   * 「清空」是不可撤销的操作，光靠一个垃圾桶图标认不出会点到什么。
   */
  const ghostButton = ghostButtonStyle(wide)

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

  /** 读取中 / 读取失败的提示。 */
  const notice = status === 'loading'
    ? <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{t('state.loading')}</p>
    : status === 'failed'
      ? <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{t('state.failed')}</p>
      : null

  /**
   * 窄栏：v6 竖屏那一版。
   *
   * 大号环形是宽版的构图——在 360px 宽的竖屏上它既占地方又吵，
   * 所以窄栏换成扁平版：大数 + 涨跌签 + 折线 + 表盘 + 指标块 + 分类列表。
   */
  if (!wide) {
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
        providers={providers}
        dailyByProvider={dailyByProvider}
        view={view}
        onView={setView}
        loading={status === 'loading'}
        notice={notice}
        // 窄栏底栏不重复包名：品牌头已经写着「DSH Meters」，
        // 这里再写一遍「dsh-usage-meters」只会把版本号挤掉。
        status={`${t('footer.synced')} · ${t('footer.local')}`}
        version={footerVersion}
        actions={actions}
        dense={tight}
        timing={TIMING.compact}
      />
    )
  }

  /**
   * 宽栏：v6 宽版。
   *
   * 大号扁平环保留（宽版的主视觉），
   * 但**卡片与标签语言跟竖屏完全统一**：同样的分段控件、描边药丸、
   * 两枚指标块、带行内微折线的分类列表、三层洞察卡、绿点底栏。
   * 读法也一致：主指标 → 指标块 → 分类 → 洞察。
   */
  return (
    <UsageWideView
      panelRef={panelRef}
      t={t}
      buckets={shown}
      total={total}
      names={names}
      windowLabel={windowLabel}
      windows={[
        { value: 'today', label: t('window.today') },
        { value: 'd7', label: t('window.d7') },
        { value: 'd30', label: t('window.d30') },
      ]}
      windowValue={range}
      onWindow={(value) => setUsageRange(value as UsageRange)}
      uncachedShare={uncachedShare}
      days={RANGE_DAYS[range]}
      daily={summary?.daily}
      todayTotal={todayTotal}
      d7Total={d7Total}
      providers={providers}
      dailyByProvider={dailyByProvider}
      view={view}
      onView={setView}
      windowShort={windowShort}
      notice={notice}
      status={footerStatus}
      version={footerVersion}
      actions={actions}
      dense={tight}
      leftWidth={leftWidth}
      ringFloor={ringFloor}
      timing={TIMING.wide}
    />
  )
}
