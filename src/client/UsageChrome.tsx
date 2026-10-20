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
  SURFACE,
  TEXT,
  rgba,
} from './usage-theme.js'

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
  /** 主视图名（Usage）。 */
  usageLabel: string
  /** 另一面（Commands）的名字。 */
  commandsLabel: string
  /** 另一面是否已实现：没有就画成禁用态。 */
  commandsReady: boolean
  /** 禁用态的悬停说明。 */
  commandsHint: string
}

/**
 * 品牌头：左边品牌名，右边 Usage | Commands 切换器。
 * @param props - 品牌头文案与切换器状态。
 * @returns 品牌头。
 */
export function BrandHeader(props: BrandHeaderProps): ReactNode {
  const { title, usageLabel, commandsLabel, commandsReady, commandsHint } = props
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 16, fontWeight: 700, color: TEXT, letterSpacing: '-0.01em' }}>{title}</span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: ACCENT }}>{usageLabel}</span>
        <span style={{ fontSize: 11, color: FAINT }}>|</span>
        {commandsReady
          ? (
            <span style={{ fontSize: 11, fontWeight: 500, color: MUTED }}>{commandsLabel}</span>
          )
          : (
            <span
              title={commandsHint}
              aria-disabled="true"
              style={{ fontSize: 11, fontWeight: 500, color: FAINT, cursor: 'not-allowed' }}
            >
              {commandsLabel}
            </span>
          )}
      </div>
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
}

/**
 * 视图 Tab 栏（总览 / 花费 / Top / 告警）。
 *
 * 只有总览有内容，其余三个画成禁用态——**不画一个点不动的假视图**。
 * @param props - Tab 文案、选中项与回调。
 * @returns Tab 栏。
 */
export function ViewTabs(props: ViewTabsProps): ReactNode {
  const { items, active, soonHint, onSelect } = props
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: on ? ACCENT : FAINT,
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
                  background: ACCENT,
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
}

/**
 * 时间窗药丸（今日 / 7 日 / 30 日）。
 * @param props - 药丸、当前值与回调。
 * @returns 药丸组。
 */
export function WindowPills(props: WindowPillsProps): ReactNode {
  const { items, value, onSelect } = props
  return (
    <div style={{ display: 'inline-flex', gap: 6 }}>
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
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '5px 10px',
              borderRadius: 6,
              border: `1px solid ${on ? ACCENT : EDGE}`,
              background: on ? ACCENT : 'transparent',
              color: on ? SURFACE : MUTED,
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
}

/**
 * 单枚 KPI：标签 + 大数值 + 副行。
 * @param props - KPI 的四段内容。
 * @returns KPI。
 */
export function Kpi(props: KpiProps): ReactNode {
  const { label, value, sub, subColor = MUTED, title } = props
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: ACCENT,
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
 * 双 KPI：命中率与花费估算，中间一条竖线隔开。
 * @param props - 左右两枚 KPI。
 * @returns KPI 对。
 */
export function KpiPair(props: { left: KpiProps; right: KpiProps }): ReactNode {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Kpi {...props.left} />
      <div style={{ borderLeft: `1px solid ${HAIR}`, paddingLeft: 16 }}>
        <Kpi {...props.right} />
      </div>
    </div>
  )
}

/** 命令入口条的属性。 */
export interface CommandEntryProps {
  /** 快捷键提示（右下角）。 */
  hint: string
  /** 文案。 */
  label: string
  /** 快捷键徽标（左侧）。 */
  badge: string
  /** 不可用时的悬停说明。 */
  unavailableHint: string
  /** 是否已实现。 */
  ready: boolean
}

/**
 * 命令面板入口条。
 *
 * 命令面板这一面还没实现，所以这条是**禁用态**：
 * 形态留着（v4 构图的一部分），但点不动，也不假装能点。
 * @param props - 入口条的文案与状态。
 * @returns 入口条。
 */
export function CommandEntry(props: CommandEntryProps): ReactNode {
  const { hint, label, badge, unavailableHint, ready } = props
  return (
    <div
      title={ready ? undefined : unavailableHint}
      aria-disabled={!ready}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        border: `1px solid ${EDGE}`,
        background: 'rgba(255,255,255,0.02)',
        opacity: ready ? 1 : 0.55,
        cursor: ready ? 'pointer' : 'not-allowed',
      }}
    >
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          padding: '3px 6px',
          borderRadius: 4,
          border: `1px solid ${rgba(ACCENT, 0.35)}`,
          color: ACCENT,
        }}
      >
        {badge}
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{label}</span>
      <span
        style={{
          marginLeft: 'auto',
          fontFamily: FONT_MONO,
          fontSize: 10,
          color: FAINT,
          letterSpacing: '0.06em',
        }}
      >
        {hint}
      </span>
    </div>
  )
}

/**
 * 底栏：左侧等宽状态行，右侧动作按钮。
 * @param props - 状态文案与动作区。
 * @returns 底栏。
 */
export function StatusFooter(props: { status: ReactNode; actions?: ReactNode }): ReactNode {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          color: FAINT,
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {props.status}
      </span>
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
 * 洞察文案：左侧一条强调色竖线 + 一句话。
 * @param props - 文案。
 * @returns 洞察块。
 */
export function Insight(props: { children: ReactNode }): ReactNode {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span
        aria-hidden="true"
        style={{ width: 2, alignSelf: 'stretch', borderRadius: 1, background: ACCENT, flex: 'none' }}
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
