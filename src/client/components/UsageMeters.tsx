/**
 * 数据件：折线、小表盘、涨跌签、指标块、分段控件。
 *
 * 这些是「读数」不是「壳」——它们自己带数据，画法统一在一处，
 * 免得同一枚环在两个地方画成两个样。
 *
 * 视觉口径见 `design/v6-visual-direction.md`：
 * 近黑底上的卡片、**一种**界面强调色、其余灰阶；
 * 数字用 tabular-nums 免得刷新时左右跳。
 */
import { useId, type ReactNode } from 'react'
import {
  ACCENT_CYAN,
  CARD_EDGE,
  FAINT,
  FONT_MONO,
  MUTED,
  NEGATIVE,
  POSITIVE,
  RING_TRACK,
  TEXT,
  rgba,
} from '../theme/usage-theme.js'
import { IconDown, IconUp } from './usage-icons.js'

/** 折线的属性。 */
export interface SparklineProps {
  /** 一串数值，从旧到新。 */
  values: readonly number[]
  /** 宽（px）。 */
  width?: number
  /** 高（px）。 */
  height?: number
  /** 线色，默认界面蓝青。 */
  color?: string
  /** 端点圆点半径；0 表示不画。 */
  dot?: number
  /** 是否画面积填充。 */
  area?: boolean
  /** 描边宽度。 */
  strokeWidth?: number
}

/**
 * 折线：把一串数画成一条线。
 *
 * 全等的时候画成中位水平线（没有起伏就别假装有起伏）；
 * 只有两个点也照样画得出来。
 * @param props - 数值与样式。
 * @returns 折线。
 */
export function Sparkline(props: SparklineProps): ReactNode {
  const {
    values,
    width = 120,
    height = 24,
    color = ACCENT_CYAN,
    dot = 2.5,
    area = false,
    strokeWidth = 1.5,
  } = props
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  if (values.length === 0) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const stepX = values.length > 1 ? width / (values.length - 1) : 0
  const points = values.map((value, index) => {
    const x = values.length > 1 ? index * stepX : width / 2
    const ratio = span === 0 ? 0.5 : (value - min) / span
    // 上下各留 2px：贴边会让线看起来被裁掉。
    const y = height - 2 - ratio * (height - 4)
    return { x, y }
  })
  const line = points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
  const areaPath = `M0,${height} L${line.replace(/ /g, ' L')} L${width},${height} Z`
  const last = points[points.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      {area && (
        <>
          <defs>
            <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${uid}-fill)`} />
        </>
      )}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {dot > 0 && <circle cx={last.x} cy={last.y} r={dot} fill={color} />}
    </svg>
  )
}

/** 小表盘的属性。 */
export interface MiniGaugeProps {
  /** 占比（0–100）。 */
  share: number
  /** 直径（px）。 */
  size?: number
  /** 环心数字。 */
  center: string
  /** 环下说明。 */
  caption: string
  /** 进度色，默认界面蓝青。 */
  color?: string
}

/**
 * 小表盘：一条进度 + 一圈暗灰轨道。
 *
 * 半径不大（56–72px），环心只放一个数，环下一行小字讲清「这是什么」。
 * @param props - 占比、直径、环心与说明。
 * @returns 小表盘。
 */
export function MiniGauge(props: MiniGaugeProps): ReactNode {
  const { share, size = 72, center, caption, color = ACCENT_CYAN } = props
  // 描边随直径缩，但收在 4–6px：再粗就不是仪表盘，是一个甜甜圈。
  const stroke = Math.max(4, Math.min(6, Math.round(size * 0.06)))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, share))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 'none' }}>
      <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
        <svg width={size} height={size} style={{ display: 'block', transform: 'rotate(-90deg)' }} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={RING_TRACK} strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
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

/** 涨跌签的属性。 */
export interface DeltaChipProps {
  /** 变化百分比（带符号由这里取绝对值）；null 表示没有可比数据。 */
  percent: number | null
  /** 后缀说明，例如「较昨日」。 */
  label?: string
  /** 正向色，默认涨跌绿。 */
  positive?: string
  /** 负向色，默认涨跌红。 */
  negative?: string
}

/**
 * 涨跌签：箭头 + 百分比。
 *
 * 没有可比数据时**不画**——空的标签比没有标签更让人分心。
 * @param props - 百分比与说明。
 * @returns 涨跌签。
 */
export function DeltaChip(props: DeltaChipProps): ReactNode {
  const { percent, label, positive = POSITIVE, negative = NEGATIVE } = props
  if (percent === null || !Number.isFinite(percent)) return null
  const up = percent >= 0
  const color = up ? positive : negative
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '2px 6px 2px 5px',
        borderRadius: 6,
        background: rgba(color, 0.12),
        fontSize: 10,
        fontWeight: 600,
        color,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {up ? <IconUp size={10} color={color} strokeWidth={2.4} /> : <IconDown size={10} color={color} strokeWidth={2.4} />}
      {`${Math.abs(percent).toFixed(1)}%`}
      {label !== undefined && (
        <span style={{ color: MUTED, fontWeight: 500, marginLeft: 1 }}>{label}</span>
      )}
    </span>
  )
}

/** 指标块的属性。 */
export interface StatTileProps {
  /** 标签。 */
  label: string
  /** 数值。 */
  value: string
  /** 副行。 */
  sub?: string
  /** 占比（0–100），画一条微条；不给就不画条。 */
  share?: number
  /** 微条颜色，默认界面蓝青。 */
  color?: string
}

/**
 * 指标块：标签 + 数值 + 一条微条。
 *
 * 两枚并排时它就是「指标 pill」——信息量小、密度高，不占一整张卡。
 * @param props - 标签、数值、副行与占比。
 * @returns 指标块。
 */
export function StatTile(props: StatTileProps): ReactNode {
  const { label, value, sub, share, color = ACCENT_CYAN } = props
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, flex: 1 }}>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: FAINT,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: TEXT,
          letterSpacing: '-0.01em',
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
      {share !== undefined && (
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.max(0, Math.min(100, share))}%`,
              height: '100%',
              borderRadius: 2,
              background: color,
            }}
          />
        </div>
      )}
      {sub !== undefined && (
        <span style={{ fontSize: 9.5, color: MUTED, whiteSpace: 'nowrap' }}>{sub}</span>
      )}
    </div>
  )
}

/** 分段控件的属性。 */
export interface SegmentedControlProps {
  /** 每个分段的文案。 */
  items: readonly string[]
  /** 当前选中的下标。 */
  active: number
  /** 切换回调。 */
  onSelect: (index: number) => void
  /** 强调色，默认界面蓝青。 */
  accent?: string
}

/**
 * 分段控件：暗底容器里的一排药丸。
 *
 * 选中项是**描边**药丸（冷青描边 + 冷青字），不是实心块——
 * 它右边还并排放着时间窗药丸，两处都用实心填充的话，选中语言会打架。
 * 描边 = 选中，这套语言跟时间窗药丸是同一套。
 * @param props - 分段、选中项与回调。
 * @returns 分段控件。
 */
export function SegmentedControl(props: SegmentedControlProps): ReactNode {
  const { items, active, onSelect } = props
  const accent = props.accent ?? ACCENT_CYAN
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 3,
        borderRadius: 10,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${CARD_EDGE}`,
      }}
    >
      {items.map((label, index) => {
        const on = index === active
        return (
          <button
            key={label}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(index)}
            style={{
              font: 'inherit',
              fontFamily: FONT_MONO,
              fontSize: 9,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '4px 9px',
              borderRadius: 7,
              border: `1px solid ${on ? accent : 'transparent'}`,
              color: on ? accent : FAINT,
              background: 'transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
