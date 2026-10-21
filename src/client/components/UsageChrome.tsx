/**
 * v6 视觉的外框件：品牌头、时间窗药丸、洞察卡、按来源列表与底栏。
 *
 * 这些都是「壳」，不碰数据：数据仍由 `UsageDashboard` 算好后传进来。
 * 配色规矩全仓库一致：
 * **唯一强调色是蓝青，品类色只出现在圆点、细条与它们的图例位置上。**
 *
 * 之前这里还有一批 v4 的旧件（网格底纹 `UsageBackdrop`、下划线 `ViewTabs`、
 * 单枚 `Kpi`、发光 `BottomRule`、`Divider`）。宽版改成 v6 语言之后它们全都没人用了，
 * 连带把底纹里那套「满屏网格 + 四角角标」一起退休——
 * v6 视觉方向 §6 明确把这两样列进「不要做的」。
 *
 * 所有样式走内联 style——本插件的浏览器半是独立打包的产物，
 * 不走 harness 的 CSS Modules 管线。
 */
import type { ReactNode } from 'react'
import {
  ACCENT_CYAN,
  CARD_EDGE,
  EDGE,
  FAINT,
  FONT_MONO,
  FONT_SANS,
  MUTED,
  POSITIVE,
  TEXT,
  rgba,
} from '../theme/usage-theme.js'
import { IconInfo } from './usage-icons.js'

/** 品牌头的属性。 */
export interface BrandHeaderProps {
  /** 品牌名。 */
  title: string
  /** 当前面板名（Usage）。 */
  usageLabel: string
  /** 强调色，默认蓝青；v6 全页只允许一种界面色。 */
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
  const accent = props.accent ?? ACCENT_CYAN
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
  const accent = props.accent ?? ACCENT_CYAN
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
 * 洞察卡：一句说明，带小标题与右侧占比条。
 *
 * 三层结构——小标题（ⓘ INSIGHT）+ 说明正文 + 右侧读数条，
 * 这样一句话就不是悬在卡片里的一段浮字。
 * 深灰半透明底、极淡描边，**没有霓虹**。
 *
 * @param props - 文案、小标题与占比条。
 * @returns 洞察卡。
 */
export function Insight(props: {
  children: ReactNode
  accent?: string
  /** 小标题。 */
  title?: string
  /** 右侧占比条（0–100）。 */
  bar?: number
  /** 占比条颜色。 */
  barColor?: string
}): ReactNode {
  const barColor = props.barColor ?? props.accent ?? ACCENT_CYAN
  return (
    <div
      style={{
        padding: '11px 13px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.028)',
        border: `1px solid ${CARD_EDGE}`,
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
                color: '#cbd5e4',
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
