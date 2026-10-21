/**
 * 四行遥测列表：每个 token 桶一行。
 *
 * 名字与数量一律中性色，品类色只留给条形——
 * 和设计稿的分工一致：颜色只标注数据，不参与排版。
 *
 * 动效：入场时四行依次上浮淡入（错峰 45–50ms），
 * 进度条同时从 0 宽填到目标占比；刷新时条宽平滑插值，不重播。
 */
import { useEffect, useRef, type ReactNode } from 'react'
import type { UsageBuckets } from '../../protocol.js'
import { BUCKET_GLASS, MUTED, TEXT, formatCount, percentOf } from '../theme/usage-theme.js'
import { Sparkline } from './UsageMeters.js'
import { EASE_LINEAR, EASE_OUT, riseIn } from '../motion/usage-motion.js'
import { RING_KEYS } from './UsageRing.js'

/** 列表的两种排版密度：窄栏里的小字、宽面板时的大字。 */
export type TelemetryVariant = 'compact' | 'hero' | 'flat' | 'wide'

/** 每一桶要展示的全名（与环外标签同源）。 */
export interface TelemetryName {
  /** 桶的键。 */
  key: keyof UsageBuckets
  /** 展示文本。 */
  label: string
}

/** 列表需要的入场节拍。 */
export interface TelemetryTiming {
  /** 第一行起跑的时刻（毫秒）。 */
  rows: number
  /** 相邻两行的间隔（毫秒）。 */
  rowStep: number
  /** 进度条起跑的时刻（毫秒）。 */
  bars: number
}

/** 遥测列表的属性。 */
export interface UsageTelemetryProps {
  /** 四桶用量。 */
  buckets: UsageBuckets
  /** 每桶的全名。 */
  names: readonly TelemetryName[]
  /** 排版密度，默认侧栏的紧凑版。 */
  variant?: TelemetryVariant
  /** 窗口矮时用更紧的排版（行距与字号一起收），好让一屏装得下。 */
  dense?: boolean
  /** 入场节拍。 */
  timing: TelemetryTiming
  /**
   * 每桶的日序列（与 `names` 同序）。
   *
   * 给了就在行尾画一段微型折线——只有总量看不出波动，
   * 一条 30 日的小折线能立刻说明「这桶是最近才涨起来的」。
   */
  series?: readonly (readonly number[])[]
}

/**
 * 两种密度下的字号与间距，外加「窗口很矮」时更紧的一档。
 *
 * 面板要一屏装下：窗口矮的时候，四行遥测是唯一还占着整块高度的东西，
 * 行距与字号各收一点，四行就能省出二十多像素。
 *
 * `flat` 是竖屏（金融竖屏）那一版：字更小、行距更紧，
 * 进度条改成实心细条，品类色不再发光。
 *
 * `wide` 是宽面板那一版：**沿用 flat 的全部视觉语言**（行内微折线、
 * 行间发丝线、灰阶百分比、实心细条），只是字号大一号——
 * 卡片与标签语言跟竖屏统一，宽版只是「同一套东西放大」。
 */
const DENSITY = {
  compact: { font: 12, gap: 14, labelGap: 7 },
  hero: { font: 15, gap: 16, labelGap: 8 },
  compactDense: { font: 11, gap: 10, labelGap: 5 },
  heroDense: { font: 13, gap: 12, labelGap: 6 },
  flat: { font: 11, gap: 13, labelGap: 7 },
  flatDense: { font: 10, gap: 10, labelGap: 5 },
  wide: { font: 13, gap: 15, labelGap: 8 },
  wideDense: { font: 12, gap: 12, labelGap: 6 },
} as const

/**
 * 渲染四行遥测列表。
 * @param props - 桶用量、每桶全名、排版密度与入场节拍。
 * @returns 列表。
 */
export function UsageTelemetry(props: UsageTelemetryProps): ReactNode {
  const { buckets, names, variant = 'compact', dense = false, timing, series } = props
  const total = RING_KEYS.reduce((sum, key) => sum + buckets[key], 0)
  /**
   * v6 的列表语言：行内微折线、行间发丝线、灰阶百分比、实心细条。
   *
   * `flat`（竖屏）与 `wide`（宽面板）共用它，只差字号——
   * 卡片与标签语言统一，宽版不该是另一套排版。
   */
  const flat = variant === 'flat' || variant === 'wide'
  const d = dense
    ? (variant === 'hero'
        ? DENSITY.heroDense
        : variant === 'wide'
          ? DENSITY.wideDense
          : flat
            ? DENSITY.flatDense
            : DENSITY.compactDense)
    : DENSITY[variant]

  const rowRefs = useRef<(HTMLLIElement | null)[]>([])
  const barRefs = useRef<(HTMLDivElement | null)[]>([])
  const entered = useRef(false)

  useEffect(() => {
    if (entered.current) return
    entered.current = true
    names.forEach((name, index) => {
      const delay = timing.rows + index * timing.rowStep
      riseIn(rowRefs.current[index], delay, 180)
      // 进度条：与行错峰并行，从 0 宽填到目标占比。
      const bar = barRefs.current[index]
      if (bar === null || bar === undefined) return
      const share = percentOf(buckets[name.key], total)
      bar.animate(
        [{ width: '0%' }, { width: `${share}%` }],
        { duration: 300, delay: timing.bars + index * timing.rowStep, easing: EASE_LINEAR, fill: 'backwards' },
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        // 竖屏那一版：行距由「行内那道发丝线」承担，所以列表本身不再留 gap。
        // 每行 16(行名) + 7 + 5(细条) + 16(发丝线带) = 44，正好对上 v6 的行高刻度。
        gap: flat ? 0 : d.gap,
      }}
    >
      {names.map((name, index) => {
        const value = buckets[name.key]
        const glass = BUCKET_GLASS[index]
        const share = percentOf(value, total)
        return (
          <li
            key={name.key}
            ref={(node) => { rowRefs.current[index] = node }}
            style={{ display: 'flex', flexDirection: 'column', gap: d.labelGap }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                {/* 品类色的小圆点：桶的图例标记，和条形是同一套颜色。 */}
                <span
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: glass.base,
                    // 竖屏那一版不发光：颜色只标注数据，不参与装饰。
                    boxShadow: flat ? 'none' : `0 0 6px ${glass.base}99`,
                    flex: 'none',
                  }}
                />
                <span
                  style={{
                    fontSize: d.font,
                    fontWeight: 500,
                    letterSpacing: flat ? '0.08em' : '0.02em',
                    textTransform: 'uppercase',
                    color: flat ? '#cbd5e4' : TEXT,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {name.label}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: flat ? 10 : 16, flex: 'none' }}>
                {/* 行内微型折线：这桶自己 30 日的走势，用它自己的颜色。 */}
                {flat && series !== undefined && series[index] !== undefined && (
                  <Sparkline
                    values={series[index]}
                    width={44}
                    height={12}
                    color={glass.base}
                    dot={0}
                    strokeWidth={1.2}
                  />
                )}
                <span
                  style={{
                    fontSize: flat ? d.font + 1 : d.font,
                    fontWeight: 600,
                    color: TEXT,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatCount(value)}
                </span>
                {/* 百分比是这条桶的图例文字：竖屏那一版走灰阶，颜色留给圆点与细条。 */}
                <span
                  style={{
                    fontSize: flat ? d.font : d.font,
                    fontWeight: 600,
                    color: flat ? MUTED : glass.base,
                    fontVariantNumeric: 'tabular-nums',
                    textAlign: 'right',
                    minWidth: 34,
                  }}
                >
                  {share}%
                </span>
              </span>
            </div>
            {/* 条长 = 占总 token 的比例，与环上百分比一致。 */}
            <div
              style={{
                position: 'relative',
                height: flat ? 5 : 4,
                borderRadius: flat ? 3 : 2,
                background: 'rgba(255,255,255,0.07)',
                overflow: 'hidden',
              }}
            >
              <div
                ref={(node) => { barRefs.current[index] = node }}
                style={{
                  position: 'absolute',
                  inset: '0 auto 0 0',
                  width: `${share}%`,
                  borderRadius: flat ? 3 : 2,
                  background: flat
                    ? glass.base
                    : `linear-gradient(180deg, ${glass.hi} 0%, ${glass.base} 100%)`,
                  boxShadow: flat ? 'none' : `0 0 8px ${glass.base}66`,
                  transition: `width 380ms ${EASE_OUT}`,
                }}
              />
            </div>
            {/*
              行间发丝线：最后一行不画。
              它不是装饰——是把行与行分开的那道线，和「四行遥测」的数据感是一回事。
            */}
            {flat && index < names.length - 1 && (
              <div
                aria-hidden="true"
                style={{ height: 16, display: 'flex', alignItems: 'center' }}
              >
                <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.06)' }} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
