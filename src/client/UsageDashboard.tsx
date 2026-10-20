/**
 * 右栏 Tab 的面板：用量 Dashboard。
 *
 * 视觉是「深空遥测台」：近黑底、唯一强调色（电光蓝）、
 * 四色只出现在环段与进度条上，所有文字中性。
 * 数据仍然来自本机记录的四桶 token，窗口可选今日 / 7 日 / 30 日。
 *
 * 两种形态由面板**实测宽度**决定：
 * - 窄（不到 1200px）：环在上、四行遥测在下的堆叠版。
 * - 宽（1200px 以上）：hero 版，左列表右主环，和 Figma 的那张图同一套构图。
 *
 * 判据是量出来的宽度，不是 `useTabInfo().sidebar.fullscreen`：
 * 那个标志只说明面板盖住了整块视口，窗口窄的时候右栏反而会自动全屏，
 * 那时可用宽度更小——按标志选布局会套错构图。
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
  ACCENT,
  BUCKET_GLASS,
  EDGE,
  FAINT,
  FONT_MONO,
  FONT_SANS,
  MUTED,
  SURFACE,
  TEXT,
  formatCompact,
  formatCount,
  percentOf,
  rgba,
} from './usage-theme.js'
import type { UsageKey } from './locales.js'
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
  /** 是否走 hero 布局。 */
  hero: boolean
}

/** 每个时间窗覆盖的日历日数：日均与窗口标签都用它。 */
const RANGE_DAYS: Record<Range, number> = { today: 1, d7: 7, d30: 30 }

/** 窄栏形态的环尺寸上下限。 */
const COMPACT_RING_MIN = 200
const COMPACT_RING_MAX = 330

/** hero 形态的环尺寸。 */
const HERO_RING = 420

/**
 * 进入 hero 布局的宽度门槛。
 *
 * hero 版是左列表 + 右主环：右列要放下 420 的环加两侧各 150 的图例余量，
 * 左列还得放得下一行读数，1200px 是这套构图不打架的下限。
 */
const HERO_MIN_WIDTH = 1200

/** 已经在 hero 版时的宽度下限：留一点迟滞，免得宽度在门槛上反复横跳。 */
const HERO_STAY_WIDTH = 1160

/**
 * 状态带：一条发光线加一行等宽微标。
 * @param props - 左中右三段文案。
 * @returns 状态带。
 */
function StatusBand({ left, center, right }: { left: string; center: string; right: string }): ReactNode {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          height: 1,
          background: `linear-gradient(90deg, transparent 0%, ${rgba(ACCENT, 0.3)} 12%, ${rgba(ACCENT, 0.3)} 88%, transparent 100%)`,
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          fontFamily: FONT_MONO,
          fontSize: 9,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: rgba(ACCENT, 0.55),
        }}
      >
        <span>{left}</span>
        <span>{center}</span>
        <span style={{ textAlign: 'right' }}>{right}</span>
      </div>
    </div>
  )
}

/**
 * 把时间窗切成两栏等分。
 * @param timestamp - 毫秒时间戳。
 * @returns HH:MM:SS。
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
  const [surface, setSurface] = useState<Surface>({ width: 0, hero: false })
  const lifetime = useRef<AbortController | undefined>(undefined)
  const panel = useRef<HTMLElement | null>(null)

  /**
   * 布局按面板**实测宽度**决定，不看 `sidebar.fullscreen`。
   *
   * 那个标志只说明「面板盖住了整块视口」：窗口窄的时候右栏会自动全屏，
   * 那时可用宽度反而更小。真正决定构图的是量出来的宽度。
   */
  const hero = surface.hero

  useLayoutEffect(() => {
    const node = panel.current
    if (node === null) return
    const measure = (): void => {
      const width = node.clientWidth
      setSurface((previous) => {
        const hero = previous.hero ? width >= HERO_STAY_WIDTH : width >= HERO_MIN_WIDTH
        if (previous.width === width && previous.hero === hero) return previous
        return { width, hero }
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

  const total = useMemo<number>(() => {
    if (buckets === undefined) return 0
    return RING_KEYS.reduce((sum, key) => sum + buckets[key], 0)
  }, [buckets])

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

  /** 四个桶的短名：环外图例用这一份，短到能贴住弧段。 */
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
  const dailyAverage = total / RANGE_DAYS[range]
  const uncachedShare = percentOf(buckets?.uncachedInputTokens ?? 0, total)
  /** 窄栏里的环随面板宽度缩放：宽一点就大一点，但封顶。 */
  const compactRing = Math.round(Math.max(COMPACT_RING_MIN, Math.min(COMPACT_RING_MAX, surface.width - 190)))

  const ghostButton = {
    font: 'inherit',
    fontSize: 10,
    letterSpacing: '0.06em',
    padding: '3px 8px',
    borderRadius: 6,
    border: `1px solid ${EDGE}`,
    background: 'transparent',
    color: MUTED,
    cursor: 'pointer',
  } as const

  const rangeButton = (active: boolean) => ({
    font: 'inherit',
    fontSize: 11,
    letterSpacing: '0.04em',
    padding: '4px 10px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    background: active ? rgba(ACCENT, 0.16) : 'transparent',
    color: active ? ACCENT : MUTED,
    fontWeight: active ? 600 : 400,
  })

  const rangeSwitch = (
    <div
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 2,
        borderRadius: 9,
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid ${EDGE}`,
      }}
    >
      {([['today', t('range.today')], ['d7', t('range.d7')], ['d30', t('range.d30')]] as const).map(([key, label]) => (
        <button
          key={key}
          type="button"
          data-usage-range={key}
          aria-pressed={range === key}
          style={rangeButton(range === key)}
          onClick={() => setRange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )

  const actions = (
    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
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
    </div>
  )

  const telemetry = (
    <UsageTelemetry
      buckets={buckets ?? { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }}
      names={names}
      variant={hero ? 'hero' : 'compact'}
    />
  )

  const ringLabels: readonly RingLabel[] = shortNames.map((name) => ({
    key: name.key,
    text: `${name.label} · ${percentOf(buckets?.[name.key] ?? 0, total)}%`,
  }))

  const providerBlock = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3
        style={{
          margin: 0,
          fontFamily: FONT_MONO,
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: FAINT,
        }}
      >
        {t('provider.title')}
      </h3>
      {providers.length === 0
        ? <p style={{ margin: 0, fontSize: 12, color: FAINT }}>{t('provider.empty')}</p>
        : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {providers.map((provider) => (
              <li
                key={`${provider.provider}/${provider.model}`}
                style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: MUTED,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {provider.provider === 'unknown' ? t('provider.unknown') : provider.provider}
                  {provider.model.length > 0 && ` / ${provider.model}`}
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
                  {formatCount(RING_KEYS.reduce((sum, key) => sum + provider[key], 0))}
                </span>
              </li>
            ))}
          </ul>
        )}
    </div>
  )

  const insight = (
    <p style={{ margin: 0, fontSize: hero ? 13 : 12, lineHeight: 1.55, color: ACCENT }}>
      {t('insight.uncached', { pct: `${uncachedShare}%` })}
    </p>
  )

  const footer = (
    <div
      style={{
        fontFamily: FONT_SANS,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: FAINT,
      }}
    >
      {t('footer.build')}
    </div>
  )

  const ring = (
    <UsageRing
      buckets={buckets ?? { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }}
      headline={formatCompact(total)}
      caption={t('total.label')}
      captionAccent={windowLabel}
      sub={t('ring.dailyAvg', { value: formatCompact(dailyAverage) })}
      size={hero ? HERO_RING : compactRing}
      variant={hero ? 'hero' : 'compact'}
      labels={hero ? ringLabels : undefined}
    />
  )

  return (
    <section
      data-usage-dashboard=""
      ref={panel}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: SURFACE,
        color: TEXT,
        border: `1px solid ${EDGE}`,
        borderRadius: 14,
        padding: hero ? '22px 30px 24px' : '16px 18px 18px',
        fontFamily: FONT_SANS,
        fontSize: 13,
        lineHeight: 1.5,
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      {hero && <HeroChrome />}

      <StatusBand
        left={t('hud.telemetry')}
        center={t('hud.locked')}
        right={t('hud.webLocal')}
      />

      {status === 'loading' && <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{t('state.loading')}</p>}
      {status === 'failed' && <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{t('state.failed')}</p>}

      {status === 'ready' && buckets !== undefined && (
        <>
          {hero
            ? (
              /* 全屏：左栏标题+遥测，右栏主环，和设计稿同一套构图。 */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 40,
                  alignItems: 'center',
                  flex: 1,
                }}
              >
                {/* 左栏限宽 620：给环外标签留出通道，两边不会挤在一起。 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0, maxWidth: 620 }}>
                  <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 72, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 0.94, color: '#7a8497' }}>
                        USAGE
                      </span>
                      <span style={{ fontSize: 72, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 0.94, color: TEXT }}>
                        DASHBOARD.
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{t('panel.subtitle')}</p>
                  </header>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {rangeSwitch}
                    {actions}
                  </div>

                  {telemetry}
                  {providerBlock}
                  {insight}
                </div>
                {/* 两侧各留 150：环外标签会溢出环自身的盒子。 */}
                <div style={{ padding: '0 150px 0 150px' }}>{ring}</div>
              </div>
            )
            : (
              /* 侧栏：环在上、遥测在下，窄栏优先保证读数。 */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {rangeSwitch}
                  {actions}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>{ring}</div>
                {telemetry}
                {insight}
                {providerBlock}
              </div>
            )}

          {footer}
        </>
      )}

      <StatusBand
        left={t('hud.phase', { window: windowLabel })}
        center={t('hud.buckets', { count: names.length })}
        right={summary === undefined ? '' : t('hud.sync', { time: clockOf(summary.generatedAt) })}
      />
    </section>
  )
}

/**
 * hero 形态专属的框件：四角薄角标、极淡透视地面网格、左右分区的发光分隔线。
 * @returns 背景装饰层。
 */
function HeroChrome(): ReactNode {
  const corner = (position: 'top' | 'bottom', side: 'left' | 'right') => ({
    position: 'absolute' as const,
    [position]: 10,
    [side]: 10,
    width: 22,
    height: 22,
    borderColor: rgba(ACCENT, 0.45),
    borderStyle: 'solid' as const,
    borderWidth: 0,
    borderTopWidth: position === 'top' ? 2 : 0,
    borderBottomWidth: position === 'bottom' ? 2 : 0,
    borderLeftWidth: side === 'left' ? 2 : 0,
    borderRightWidth: side === 'right' ? 2 : 0,
    pointerEvents: 'none' as const,
  })

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
      <div style={corner('top', 'left')} />
      <div style={corner('top', 'right')} />
      <div style={corner('bottom', 'left')} />
      <div style={corner('bottom', 'right')} />
      {/* 极淡透视地面网格：只有 3% 灰白，不抢任何数字。 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -120,
          width: '220%',
          height: '52%',
          transform: 'translateX(-50%) perspective(760px) rotateX(63deg)',
          transformOrigin: 'bottom center',
          backgroundImage: `repeating-linear-gradient(to right, rgba(255,255,255,0.03) 0 1px, transparent 1px 120px), repeating-linear-gradient(to bottom, rgba(255,255,255,0.03) 0 1px, transparent 1px 120px)`,
        }}
      />
      {/* 左右分区的发光分隔线。 */}
      <div
        style={{
          position: 'absolute',
          left: '58%',
          top: '14%',
          bottom: '14%',
          width: 1,
          background: `linear-gradient(180deg, transparent 0%, ${rgba(ACCENT, 0.3)} 18%, ${rgba(ACCENT, 0.3)} 82%, transparent 100%)`,
          boxShadow: `0 0 12px ${rgba(ACCENT, 0.25)}`,
        }}
      />
    </div>
  )
}
