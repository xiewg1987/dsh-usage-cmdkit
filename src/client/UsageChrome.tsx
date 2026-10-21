/**
 * v4 视觉的外框件：背景底纹、品牌头、视图 Tab、时间窗药丸、双 KPI、
 * 命令入口条与底栏。
 *
 * 这些都是「壳」，不碰数据：数据仍由 `UsageDashboard` 算好后传进来。
 * 壳只负责排版与配色，配色规矩全仓库一致：
 * **唯一强调色是电光蓝，四色只出现在环段、进度条与它们的图例文字上。**
 *
 * 所有样式走内联 style——本插件的浏览器半是独立打包的产物，
 * 不走 harness 的 CSS Modules 管线。
 */
import { useId, type ReactNode } from 'react'
import {
  ACCENT,
  EDGE,
  FAINT,
  FONT_MONO,
  FONT_SANS,
  GRID,
  GRID_MAJOR,
  HAIR,
  MUTED,
  POSITIVE,
  SURFACE,
  TEXT,
  rgba,
} from './usage-theme.js'
import { IconInfo } from './usage-icons.js'

/**
 * 一条极细的分隔线。
 *
 * 上下各收 6px：它是独立的一行，两侧各让一个完整的间距（13px×2）太贵——
 * 面板要「一屏装下」，八条分隔线光间距就吃掉一百多像素。
 * 收到 7px 上下之后，节奏也贴近设计稿（那里分隔线上下也就 7–10px）。
 */
export function Divider(): ReactNode {
  return (
    <div
      style={{ height: 1, background: HAIR, flex: 'none', marginTop: -6, marginBottom: -6 }}
      aria-hidden="true"
    />
  )
}

/**
 * 背景底纹：平视网格 + 四角角标。
 *
 * 网格是**平视**的（40px 细格 + 160px 粗格），不是透视地面——
 * 平视在任何宽高比下都成立，窄栏不必为它单独降级。
 * @returns 装饰层。
 */
export function UsageBackdrop(): ReactNode {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const corner = (top: boolean, left: boolean): ReactNode => (
    <div
      style={{
        position: 'absolute',
        top: top ? 8 : undefined,
        bottom: top ? undefined : 8,
        left: left ? 8 : undefined,
        right: left ? undefined : 8,
        width: 20,
        height: 20,
        borderColor: rgba(ACCENT, 0.4),
        borderStyle: 'solid',
        borderWidth: 0,
        borderTopWidth: top ? 2 : 0,
        borderBottomWidth: top ? 0 : 2,
        borderLeftWidth: left ? 2 : 0,
        borderRightWidth: left ? 0 : 2,
        pointerEvents: 'none',
      }}
    />
  )

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
      <svg width="100%" height="100%" style={{ display: 'block' }} preserveAspectRatio="none">
        <defs>
          <pattern id={`${uid}-fine`} width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0V40H0" fill="none" stroke={GRID} strokeWidth="1" />
          </pattern>
          <pattern id={`${uid}-major`} width="160" height="160" patternUnits="userSpaceOnUse">
            <path d="M160 0V160H0" fill="none" stroke={GRID_MAJOR} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${uid}-fine)`} opacity="0.7" />
        <rect width="100%" height="100%" fill={`url(#${uid}-major)`} opacity="0.85" />
      </svg>
      {corner(true, true)}
      {corner(true, false)}
      {corner(false, true)}
      {corner(false, false)}
    </div>
  )
}

/** 品牌头的属性。 */
export interface BrandHeaderProps {
  /** 品牌名。 */
  title: string
  /** 当前面板名（Usage）。 */
  usageLabel: string
  /** 强调色，默认电光蓝；竖屏那一版传蓝青。 */
  accent?: string
  /**
   * 字号档位。
   *
   * `compact` 是竖屏（金融竖屏）那一档：右侧的面板名退成 **9px 灰字**——
   * v6 的强调色上限是 2，这一处让给选中态与进度环。
   */
  size?: 'normal' | 'compact'
}

/**
 * 品牌头：左边品牌名，右边当前面板名。
 *
 * 右边是**静态标签**：右栏里只有这一个 Tab，没有可切的对象，
 * 就不摆一个点不动的切换器。
 * @param props - 品牌头文案。
 * @returns 品牌头。
 */
export function BrandHeader(props: BrandHeaderProps): ReactNode {
  const { title, usageLabel, size = 'normal' } = props
  const accent = props.accent ?? ACCENT
  const compact = size === 'compact'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 16, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>{title}</span>
      <span
        style={{
          marginLeft: 'auto',
          fontSize: compact ? 9 : 11,
          fontWeight: 600,
          letterSpacing: compact ? '0.12em' : '0',
          textTransform: compact ? 'uppercase' : 'none',
          color: compact ? FAINT : accent,
        }}
      >
        {usageLabel}
      </span>
    </div>
  )
}

/** 视图 Tab 的属性。 */
export interface ViewTabsProps {
  /** 每个 Tab 的文案。 */
  items: readonly string[]
  /** 当前选中的下标。 */
  active: number
  /** 未实现视图的悬停说明。 */
  soonHint: string
  /** 切换回调。 */
  onSelect: (index: number) => void
  /** 强调色，默认电光蓝。 */
  accent?: string
  /** 字号档位：竖屏那一版用紧凑档，好与时间窗药丸并成一行。 */
  size?: 'normal' | 'compact'
}

/**
 * 视图 Tab 栏（总览 / 花费 / Top / 告警）。
 *
 * 只有总览有内容，其余三个画成禁用态——**不画一个点不动的假视图**。
 * @param props - Tab 文案、选中项与回调。
 * @returns Tab 栏。
 */
export function ViewTabs(props: ViewTabsProps): ReactNode {
  const { items, active, soonHint, onSelect, size = 'normal' } = props
  const accent = props.accent ?? ACCENT
  const compact = size === 'compact'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 9 : 14 }}>
      {items.map((label, index) => {
        const on = index === active
        return (
          <button
            key={label}
            type="button"
            disabled={!on}
            title={on ? undefined : soonHint}
            onClick={() => onSelect(index)}
            style={{
              font: 'inherit',
              fontFamily: FONT_MONO,
              fontSize: compact ? 9 : 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: on ? accent : FAINT,
              background: 'transparent',
              border: 'none',
              padding: '4px 0',
              cursor: on ? 'pointer' : 'not-allowed',
              position: 'relative',
            }}
          >
            {label}
            {on && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 1.5,
                  background: accent,
                }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

/** 时间窗药丸的属性。 */
export interface WindowPillsProps {
  /** 每个药丸的值。 */
  items: readonly { value: string; label: string }[]
  /** 当前选中的值。 */
  value: string
  /** 切换回调。 */
  onSelect: (value: string) => void
  /** 强调色，默认电光蓝。 */
  accent?: string
  /** 药丸尺寸：窄栏用紧凑版。 */
  size?: 'normal' | 'compact'
}

/**
 * 时间窗药丸（今日 / 7 日 / 30 日）。
 * @param props - 药丸、当前值与回调。
 * @returns 药丸组。
 */
export function WindowPills(props: WindowPillsProps): ReactNode {
  const { items, value, onSelect, size = 'normal' } = props
  const accent = props.accent ?? ACCENT
  const compact = size === 'compact'
  return (
    <div style={{ display: 'inline-flex', gap: compact ? 4 : 6 }}>
      {items.map((item) => {
        const on = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            data-usage-range={item.value}
            aria-pressed={on}
            onClick={() => onSelect(item.value)}
            style={{
              font: 'inherit',
              fontFamily: FONT_MONO,
              fontSize: compact ? 9 : 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: compact ? '4px 7px' : '5px 10px',
              borderRadius: 6,
              // 选中是**描边**药丸，不是实心块：它旁边还有分段控件，
              // 两处都用实心填充的话，选中语言会打架。
              border: `1px solid ${on ? accent : EDGE}`,
              background: on ? rgba(accent, 0.12) : 'transparent',
              color: on ? accent : MUTED,
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

/** 单枚 KPI 的属性。 */
export interface KpiProps {
  /** 标签（等宽大写、强调蓝）。 */
  label: string
  /** 主数值。 */
  value: string
  /** 副行。 */
  sub?: string
  /** 副行颜色。 */
  subColor?: string
  /** 主数值的补充说明（悬停可见）。 */
  title?: string
  /** 标签颜色，默认强调色；金融竖屏那一版用灰。 */
  labelColor?: string
}

/**
 * 单枚 KPI：标签 + 大数值 + 副行。
 * @param props - KPI 的四段内容。
 * @returns KPI。
 */
export function Kpi(props: KpiProps): ReactNode {
  const { label, value, sub, subColor = MUTED, title, labelColor = ACCENT } = props
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: labelColor,
          opacity: 0.85,
        }}
      >
        {label}
      </span>
      <span
        title={title}
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: TEXT,
          letterSpacing: '-0.01em',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
      {sub !== undefined && (
        <span style={{ fontSize: 11, color: subColor, whiteSpace: 'nowrap' }}>{sub}</span>
      )}
    </div>
  )
}

/**
 * 底栏：左侧状态点 + 状态行，右侧动作按钮。
 *
 * 状态点是一枚 6px 的绿点——底栏全是小字，没有一个「活着」的信号，
 * 面板看起来就像一张静态截图。
 * @param props - 状态文案、状态点、悬停提示、字号档位与动作区。
 * @returns 底栏。
 */
export function StatusFooter(props: {
  status: ReactNode
  actions?: ReactNode
  title?: string
  size?: 'normal' | 'compact'
  /** 状态点：ok 是绿点，off 是灰点；不给就不画。 */
  dot?: 'ok' | 'off'
  /** 版本号：单独一段，和状态行之间用中点隔开。 */
  version?: ReactNode
}): ReactNode {
  const compact = props.size === 'compact'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 12 }}>
      {props.dot !== undefined && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: props.dot === 'ok' ? POSITIVE : FAINT,
            flex: 'none',
          }}
        />
      )}
      <span
        title={props.title}
        style={{
          fontFamily: FONT_MONO,
          fontSize: compact ? 8.5 : 9,
          color: FAINT,
          letterSpacing: compact ? '0.02em' : '0.06em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {props.status}
      </span>
      {props.version !== undefined && (
        <span
          aria-hidden="true"
          style={{
            fontFamily: FONT_MONO,
            fontSize: compact ? 8.5 : 9,
            color: FAINT,
            opacity: 0.75,
            whiteSpace: 'nowrap',
            flex: 'none',
          }}
        >
          · {props.version}
        </span>
      )}
      {props.actions !== undefined && (
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flex: 'none' }}>{props.actions}</div>
      )}
    </div>
  )
}

/**
 * 底部那条极淡的发光规则线。
 * @returns 发光规则线。
 */
export function BottomRule(): ReactNode {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 1,
        flex: 'none',
        background: `linear-gradient(90deg, transparent 0%, ${rgba(ACCENT, 0.28)} 18%, ${rgba(ACCENT, 0.28)} 82%, transparent 100%)`,
      }}
    />
  )
}

/**
 * 洞察文案：一句话说明。
 *
 * 两种形态：
 * - `bar`（默认）：左侧一条强调色竖线 + 文字；
 * - `card`：扁平说明卡——深灰半透明底、极淡描边，**没有霓虹**。
 *
 * `card` 形态还可以带一个小标题与右侧的占比条，
 * 这样一句话就不是悬在卡片里的一段浮字，而是「标题 + 说明 + 读数」三层。
 *
 * @param props - 文案与形态。
 * @returns 洞察块。
 */
export function Insight(props: {
  children: ReactNode
  variant?: 'bar' | 'card'
  accent?: string
  /** 小标题（仅 card 形态）。 */
  title?: string
  /** 右侧占比条（0–100，仅 card 形态）。 */
  bar?: number
  /** 占比条颜色。 */
  barColor?: string
}): ReactNode {
  const accent = props.accent ?? ACCENT
  if (props.variant === 'card') {
    const barColor = props.barColor ?? accent
    return (
      <div
        style={{
          padding: '11px 13px',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.028)',
          border: `1px solid ${EDGE}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
        }}
      >
        {props.title !== undefined && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: FONT_MONO,
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: FAINT,
            }}
          >
            <IconInfo size={11} color={FAINT} strokeWidth={2} />
            {props.title}
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <p style={{ margin: 0, flex: 1, fontSize: 11.5, lineHeight: 1.6, color: 'rgba(214,222,235,0.88)' }}>
            {props.children}
          </p>
          {props.bar !== undefined && (
            <div
              aria-hidden="true"
              style={{
                width: 64,
                flex: 'none',
                height: 4,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.07)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, props.bar))}%`,
                  height: '100%',
                  borderRadius: 2,
                  background: barColor,
                }}
              />
            </div>
          )}
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span
        aria-hidden="true"
        style={{ width: 2, alignSelf: 'stretch', borderRadius: 1, background: accent, flex: 'none' }}
      />
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: 'rgba(158,194,255,0.92)' }}>
        {props.children}
      </p>
    </div>
  )
}

/** 按来源列表的属性。 */
export interface ProviderListProps {
  /** 每行：来源名与总量。 */
  items: readonly { key: string; label: string; value: string }[]
  /** 标题。 */
  title: string
}

/**
 * 按来源列表：哪个 provider/model 花的 token 最多。
 * @param props - 列表内容与标题。
 * @returns 来源列表。
 */
export function ProviderList(props: ProviderListProps): ReactNode {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        {props.title}
      </span>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {props.items.map((item) => (
          <li key={item.key} style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
            <span
              style={{
                fontSize: 12,
                color: MUTED,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                fontWeight: 600,
                color: TEXT,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {item.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 字体栈的再导出：别处不必再从主题里取。 */
export { FONT_SANS }
