/**
 * 用量主环：四个 token 桶各占一段的粗软进度弧，环心是总览数字。
 *
 * 一条极淡底环 + 四段有间隙的弧，弧自带顶光玻璃渐变。宽版（≥900px）的主视觉。
 *
 * **弧上不发光**：v6 §6 明确不要「霓虹多色大环」。
 * 四色是环段的合法用色（见 `usage-theme.ts` 的令牌说明：四色只出现在环段、圆点、细条），
 * 但一圈彩色辉光会把整个面板推回霓虹那一版——所以只留色，不留光。
 *
 * 几何全部按像素写进 viewBox（viewBox 与像素 1:1），
 * 字号不随缩放失真——这是把设计稿落成产品面板的关键。
 *
 * 动效（见 `design/motion-spec.md`）：
 * - 入场时底环先亮，四段色弧按蓝→绿→紫→橙依次描边生长，环心数字同时递增。
 * - 入场结束后完全静止：没有呼吸，也没有呼吸灯。
 * - 刷新时色弧角度平滑插值，**不重播**入场。
 */
import { useEffect, useId, useRef, type ReactNode } from 'react'
import type { UsageBuckets } from '../../protocol.js'
import { ACCENT, BUCKET_GLASS, FONT_SANS, MUTED, TEXT } from '../theme/usage-theme.js'
import { EASE_LINEAR, EASE_OUT, useCountUp } from '../motion/usage-motion.js'
import { RING_KEYS, placeRingLabels, ringSegments, type RingLabel } from '../data/usage-ring-geometry.js'

/** 四个桶的固定顺序：与环上分段、条形、环外标签同序。 */
export { RING_KEYS }

/**
 * 读数排版的比例：几何按画布比例给，字号按像素给。
 *
 * 三行文字的基线间距照设计稿的比例定，
 * 所以大数字压在环心线上、两行副文案落在它下方。
 *
 * 字号是**环径的比例**而不是固定像素：
 * 环径随一屏高度变小时，文字与环的关系保持一致。
 */
const READOUT = {
  headline: 0.13,
  caption: 0.03,
  sub: 0.03,
  headlineGap: 0.005,
  lineGap: 0.08,
  subGap: 0.052,
} as const

/** 弧线路径半径占画布的比例（描边居中，所以外缘落在 50%）。 */
const RADIUS_RATIO = 0.465

/** 弧粗占画布的比例。 */
const STROKE_RATIO = 0.07

/**
 * 环外标签：每个桶一个百分比。
 *
 * 类型与挑选规则都在 `usage-ring-geometry.ts`：环与分类列表共用同一份顺序，
 * 两边看到的桶序才不会对不上。
 */
export type { RingLabel }

/** 环需要的入场节拍。 */
export interface RingTiming {
  /** 底环出现的时刻（毫秒）。 */
  track: number
  /** 第一段色弧起跑的时刻（毫秒）。 */
  arc: number
  /** 相邻色弧之间的间隔（毫秒）。 */
  arcStep: number
  /** 环心数字起跑的时刻（毫秒）。 */
  number: number
}

/** 主环的属性。 */
export interface UsageRingProps {
  /** 四桶用量。 */
  buckets: UsageBuckets
  /** 环心大字的终值：数值本身，滚动到它。 */
  total: number
  /** 把数值格式成显示串。 */
  format: (value: number) => string
  /** 环心第一行的中性部分（如「令牌」）。 */
  caption: string
  /** 环心第一行的强调部分（如「30 日」）：没有时只显示 caption。 */
  captionAccent?: string
  /** 环心强调部分的颜色，默认电光蓝；v6 那一版传蓝青。 */
  accent?: string
  /** 环心第二行副文案：拿当前计数值决定内容。 */
  sub: (counted: number) => ReactNode
  /** 渲染尺寸（正方形，px）。 */
  size: number
  /** 环外标签：百分比。 */
  labels?: readonly RingLabel[]
  /** 入场节拍。 */
  timing: RingTiming
}

/**
 * 渲染用量主环。
 * @param props - 桶用量、环心文案、尺寸、环外标签与入场节拍。
 * @returns 环与环外标签。
 */
export function UsageRing(props: UsageRingProps): ReactNode {
  const { buckets, total, format, caption, captionAccent, sub, size, labels, timing } = props
  const accent = props.accent ?? ACCENT
  // useId 带冒号，做 URL 片段引用要清掉。
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const v = READOUT
  const center = size / 2
  const radius = size * RADIUS_RATIO
  const stroke = size * STROKE_RATIO
  const outer = radius + stroke / 2
  const circumference = 2 * Math.PI * radius

  // 四段弧：从十二点方向顺时针铺开（与分类列表共用同一份几何）。
  const segments = ringSegments(buckets)

  /**
   * 弧段起点的周长偏移（px）。
   *
   * 画弧是从十二点方向顺时针铺开的，偏移量要跟着起点角度走。
   */
  const arcOffset = (from: number, pathRadius: number): number => (from + Math.PI / 2) * pathRadius

  // 环外标签先挑一遍：太小的不标，角距太近的只留占比大的那个。
  const visibleLabels = placeRingLabels(segments, labels ?? [])

  // 入场用的 ref：色弧（本体 + 镜面高光各一组）、底环。
  const arcRefs = useRef<(SVGCircleElement | null)[]>([])
  const specRefs = useRef<(SVGCircleElement | null)[]>([])
  const trackRef = useRef<SVGCircleElement | null>(null)

  // 入场只播一次：之后刷新走 CSS transition 的插值，不重播。
  const entered = useRef(false)
  useEffect(() => {
    if (entered.current) return
    entered.current = true

    trackRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 140,
      delay: timing.track,
      easing: EASE_OUT,
      fill: 'backwards',
    })

    segments.forEach((segment, index) => {
      const delay = timing.arc + index * timing.arcStep
      // 后面的弧越短：越晚起跑、越快收，四段合起来是一条连贯的环在画。
      const duration = Math.max(180, 360 - index * 40)
      const options: KeyframeAnimationOptions = {
        duration,
        delay,
        easing: EASE_LINEAR,
        fill: 'backwards',
      }
      for (const list of [arcRefs.current, specRefs.current]) {
        const circle = list[index]
        if (circle === null || circle === undefined) continue
        circle.animate(
          [
            { strokeDasharray: '0 1' },
            { strokeDasharray: `${segment.share} 1` },
          ],
          options,
        )
      }
    })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const counted = useCountUp(total, timing.number, 440)

  return (
    <div style={{ position: 'relative', width: size, height: size, overflow: 'visible' }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        overflow="visible"
        role="img"
        aria-label={format(total)}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          {BUCKET_GLASS.map((glass, index) => (
            <linearGradient key={index} id={`${uid}-g${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={glass.hi} />
              <stop offset="0.55" stopColor={glass.base} />
              <stop offset="1" stopColor={glass.lo} />
            </linearGradient>
          ))}
          <linearGradient id={`${uid}-spec`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity={0.3} />
            <stop offset="0.38" stopColor="#ffffff" stopOpacity={0.03} />
            <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* 底环：缺口也留有轨道，进度才读得出来。 */}
        <circle
          ref={trackRef}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.06}
          strokeWidth={stroke}
        />
        {/* 四段弧：玻璃渐变，不发光。
            pathLength 把周长归一成 1，弧长与偏移就与环径无关——
            环径随一屏高度变小时，弧不会错位。 */}
        {segments.map((segment) => {
          const offset = arcOffset(segment.from, radius)
          return (
            <circle
              key={segment.key}
              ref={(node) => { arcRefs.current[segment.index] = node }}
              cx={center}
              cy={center}
              r={radius}
              pathLength={1}
              fill="none"
              stroke={`url(#${uid}-g${segment.index})`}
              strokeWidth={stroke}
              strokeDasharray={`${segment.share} 1`}
              strokeDashoffset={-(offset / circumference)}
              transform={`rotate(-90 ${center} ${center})`}
              style={{ transition: `stroke-dasharray 380ms ${EASE_OUT}` }}
            />
          )
        })}
        {/* 镜面高光：贴着环带外缘，亮度只在上半圈。 */}
        {segments.map((segment) => {
          const specRadius = outer - size * 0.005
          const offset = arcOffset(segment.from, specRadius)
          return (
            <circle
              key={`spec-${segment.key}`}
              ref={(node) => { specRefs.current[segment.index] = node }}
              cx={center}
              cy={center}
              r={specRadius}
              pathLength={1}
              fill="none"
              stroke={`url(#${uid}-spec)`}
              strokeWidth={Math.max(2, size * 0.007)}
              strokeDasharray={`${segment.share} 1`}
              strokeDashoffset={-(offset / circumference)}
              transform={`rotate(-90 ${center} ${center})`}
              style={{ transition: `stroke-dasharray 380ms ${EASE_OUT}` }}
            />
          )
        })}
        {/* 环心总览。 */}
        <text
          x={center}
          y={center + size * v.headlineGap}
          textAnchor="middle"
          fontSize={Math.max(15, size * v.headline)}
          fontWeight={700}
          fill={TEXT}
          letterSpacing={-size * 0.004}
          style={{ fontFamily: 'inherit' }}
        >
          {format(counted)}
        </text>
        <text
          x={center}
          y={center + size * v.lineGap}
          textAnchor="middle"
          fontSize={Math.max(8, size * v.caption)}
          fontWeight={500}
          fill={MUTED}
          letterSpacing={size * v.caption * 0.115}
          style={{ fontFamily: 'inherit' }}
        >
          {caption}
          {captionAccent !== undefined && (
            <>
              {' · '}
              <tspan fill={accent}>{captionAccent}</tspan>
            </>
          )}
        </text>
        <text
          x={center}
          y={center + size * (v.lineGap + v.subGap)}
          textAnchor="middle"
          fontSize={Math.max(8, size * v.sub)}
          fontWeight={400}
          fill={MUTED}
          letterSpacing={size * v.sub * 0.09}
          style={{ fontFamily: 'inherit' }}
        >
          {sub(counted)}
        </text>
      </svg>

      {visibleLabels.map((label) => {
        const segment = segments[label.index]
        if (segment === undefined) return null
        const mid = label.mid
        // 标签贴着环外缘：留太远会戳出环的方框，撞到上方的标签行。
        const anchor = outer + size * 0.038
        const x = center + anchor * Math.cos(mid)
        const y = center + anchor * Math.sin(mid)
        const horizontal = Math.cos(mid)
        const align = horizontal > 0.3 ? 'left' : horizontal < -0.3 ? 'right' : 'center'
        return (
          <span
            key={label.index}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              transform:
                align === 'left'
                  ? 'translate(0, -50%)'
                  : align === 'right'
                    ? 'translate(-100%, -50%)'
                    : 'translate(-50%, -50%)',
              fontFamily: FONT_SANS,
              fontSize: Math.max(10, size * 0.03),
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: MUTED,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {label.text}
          </span>
        )
      })}
    </div>
  )
}
