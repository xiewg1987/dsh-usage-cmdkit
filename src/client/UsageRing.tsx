/**
 * 用量主环：四个 token 桶各占一段的粗软进度弧，环心是总览数字。
 *
 * 画法与 Figma 的 v4 图一致：一条极淡底环 + 四段有间隙的弧，
 * 弧自带顶光玻璃渐变与外发光 bloom，环心一枚柔和能量核。
 *
 * 几何全部按像素写进 viewBox（viewBox 与像素 1:1），
 * 所以同一套代码既能渲染窄栏的小环、也能渲染宽面板的大环，
 * 而字号不随缩放失真——这是把设计稿落成产品面板的关键。
 *
 * 动效（见 `design/motion-spec.md`）：
 * - 入场时底环先亮，四段色弧按蓝→绿→紫→橙依次描边生长，环心数字同时递增。
 * - 入场结束后静止，只有环外柔光以 4s 周期极慢呼吸（亮度 ±5%）。
 * - 刷新时色弧角度平滑插值，**不重播**入场。
 */
import { useEffect, useId, useRef, type ReactNode } from 'react'
import type { UsageBuckets } from '../protocol.js'
import { ACCENT, BUCKET_GLASS, FONT_SANS, MUTED, TEXT, rgba } from './usage-theme.js'
import { EASE_LINEAR, EASE_OUT, useCountUp } from './usage-motion.js'

/** 环的两种形态：窄栏里的紧凑环、宽面板时的双栏大环。 */
export type RingVariant = 'compact' | 'wide'

/** 四个桶的固定顺序：与环上分段、条形、环外标签同序。 */
export const RING_KEYS = [
  'uncachedInputTokens',
  'outputTokens',
  'cacheReadTokens',
  'cacheWriteTokens',
] as const

/**
 * 形态参数：几何比例与字号。
 *
 * 几何按画布比例给，字号按像素给；
 * 三行文字的基线间距照设计稿的比例定，
 * 所以大数字压在环心线上、两行副文案落在它下方。
 *
 * 字号是**环径的比例**而不是固定像素：窄栏的小环与宽面板的大环
 * 换算下来，文字与环的关系保持一致（设计稿就是按画布缩放排的）。
 */
const VARIANT = {
  compact: { headline: 0.137, caption: 0.033, sub: 0.033, headlineGap: 0.004, lineGap: 0.083, subGap: 0.055 },
  wide: { headline: 0.13, caption: 0.03, sub: 0.03, headlineGap: 0.005, lineGap: 0.08, subGap: 0.052 },
} as const

/** 弧线路径半径占画布的比例（描边居中，所以外缘落在 50%）。 */
const RADIUS_RATIO = 0.465

/** 弧粗占画布的比例。 */
const STROKE_RATIO = 0.07

/**
 * 环外标签的最小占比。
 *
 * 比这更小的桶在环上几乎看不见，标出来只会和邻居叠在一起——
 * 叠在一起的标签比没有标签更难读。
 */
const MIN_LABEL_SHARE = 0.005

/**
 * 环外标签之间的最小角距（弧度）。
 *
 * 某一桶独大时，其余几桶的弧段会挤在一小段上，标签跟着挤成一团。
 * 角距太近就只留占比大的那个，另一个让位。
 */
const MIN_LABEL_GAP = 0.28

/** 环外标签：每个桶一个百分比。 */
export interface RingLabel {
  /** 桶的键。 */
  key: string
  /** 展示文本。 */
  text: string
}

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
  /** 环心第二行副文案：拿当前计数值决定内容。 */
  sub: (counted: number) => ReactNode
  /** 渲染尺寸（正方形，px）。 */
  size: number
  /** 形态。 */
  variant: RingVariant
  /** 环外标签：百分比。 */
  labels?: readonly RingLabel[]
  /** 入场节拍。 */
  timing: RingTiming
}

/**
 * 渲染用量主环。
 * @param props - 桶用量、环心文案、尺寸、形态、环外标签与入场节拍。
 * @returns 环与环外标签。
 */
export function UsageRing(props: UsageRingProps): ReactNode {
  const { buckets, total, format, caption, captionAccent, sub, size, variant, labels, timing } = props
  // useId 带冒号，做 URL 片段引用要清掉。
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const v = VARIANT[variant]
  const center = size / 2
  const radius = size * RADIUS_RATIO
  const stroke = size * STROKE_RATIO
  const outer = radius + stroke / 2
  const sum = RING_KEYS.reduce((acc, key) => acc + buckets[key], 0)
  const circumference = 2 * Math.PI * radius

  // 四段弧：从十二点方向顺时针铺开，段与段之间留自然缺口。
  let cursor = -Math.PI / 2
  const segments = RING_KEYS.map((key, index) => {
    const value = buckets[key]
    const share = sum > 0 ? value / sum : 0
    const from = cursor
    const to = cursor + share * Math.PI * 2
    cursor = to
    return { key, index, value, share, from, to }
  })

  const arc = (from: number, to: number, pathRadius: number): { length: number; offset: number } => ({
    length: (to - from) * pathRadius,
    offset: (from + Math.PI / 2) * pathRadius,
  })

  // 环外标签先挑一遍：太小的不标，角距太近的只留占比大的那个。
  const visibleLabels = labels === undefined
    ? []
    : labels.reduce<{ index: number; text: string; mid: number; share: number }[]>((kept, label, index) => {
      const segment = segments[index]
      if (segment === undefined) return kept
      const candidate = {
        index,
        text: label.text,
        mid: (segment.from + segment.to) / 2,
        share: segment.share,
      }
      if (candidate.share < MIN_LABEL_SHARE) return kept
      const clash = kept.find((other) => {
        const raw = Math.abs(other.mid - candidate.mid)
        const gap = Math.min(raw, Math.PI * 2 - raw)
        return gap < MIN_LABEL_GAP
      })
      if (clash === undefined) {
        kept.push(candidate)
        return kept
      }
      // 撞上了就留占比大的那条。
      if (candidate.share > clash.share) {
        kept[kept.indexOf(clash)] = candidate
      }
      return kept
    }, [])

  // 入场用的 ref：色弧（本体 + 镜面高光各一组）、底环、柔光层。
  const arcRefs = useRef<(SVGCircleElement | null)[]>([])
  const specRefs = useRef<(SVGCircleElement | null)[]>([])
  const trackRef = useRef<SVGCircleElement | null>(null)
  const haloRef = useRef<SVGCircleElement | null>(null)

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
      const { length, offset } = arc(segment.from, segment.to, radius)
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
            { strokeDasharray: `0 ${circumference}` },
            { strokeDasharray: `${length} ${circumference}` },
          ],
          options,
        )
      }
      void offset
    })

    // 柔光呼吸：4s 一周期，亮度只在 ±5% 内动，且是唯一的常驻动画。
    haloRef.current?.animate(
      [{ opacity: 0.95 }, { opacity: 1 }, { opacity: 0.95 }],
      { duration: 4000, iterations: Infinity, easing: 'ease-in-out' },
    )
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
          <radialGradient id={`${uid}-halo`}>
            <stop offset="0" stopColor={ACCENT} stopOpacity={0.09} />
            <stop offset="0.6" stopColor={ACCENT} stopOpacity={0.03} />
            <stop offset="1" stopColor={ACCENT} stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`${uid}-core`}>
            <stop offset="0" stopColor="#bfe0ff" stopOpacity={0.22} />
            <stop offset="0.45" stopColor={ACCENT} stopOpacity={0.07} />
            <stop offset="1" stopColor={ACCENT} stopOpacity={0} />
          </radialGradient>
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
        {/* 能量核：两层柔光球，不做实心球。 */}
        <circle ref={haloRef} cx={center} cy={center} r={outer} fill={`url(#${uid}-halo)`} />
        <circle cx={center} cy={center} r={size * 0.23} fill={`url(#${uid}-core)`} />
        {/* 四段弧：玻璃渐变 + 外发光 bloom。 */}
        {segments.map((segment) => {
          const { length, offset } = arc(segment.from, segment.to, radius)
          return (
            <circle
              key={segment.key}
              ref={(node) => { arcRefs.current[segment.index] = node }}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={`url(#${uid}-g${segment.index})`}
              strokeWidth={stroke}
              strokeDasharray={`${length} ${circumference}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${center} ${center})`}
              style={{
                filter: `drop-shadow(0 0 ${size * 0.022}px ${rgba(BUCKET_GLASS[segment.index].base, 0.42)})`,
                transition: `stroke-dasharray 380ms ${EASE_OUT}`,
              }}
            />
          )
        })}
        {/* 镜面高光：贴着环带外缘，亮度只在上半圈。 */}
        {segments.map((segment) => {
          const specRadius = outer - size * 0.005
          const { length, offset } = arc(segment.from, segment.to, specRadius)
          return (
            <circle
              key={`spec-${segment.key}`}
              ref={(node) => { specRefs.current[segment.index] = node }}
              cx={center}
              cy={center}
              r={specRadius}
              fill="none"
              stroke={`url(#${uid}-spec)`}
              strokeWidth={Math.max(2, size * 0.007)}
              strokeDasharray={`${length} ${circumference}`}
              strokeDashoffset={-offset}
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
          fontSize={size * v.headline}
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
          fontSize={size * v.caption}
          fontWeight={500}
          fill={MUTED}
          letterSpacing={size * v.caption * 0.115}
          style={{ fontFamily: 'inherit' }}
        >
          {caption}
          {captionAccent !== undefined && (
            <>
              {' · '}
              <tspan fill={ACCENT}>{captionAccent}</tspan>
            </>
          )}
        </text>
        <text
          x={center}
          y={center + size * (v.lineGap + v.subGap)}
          textAnchor="middle"
          fontSize={size * v.sub}
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
              color: BUCKET_GLASS[label.index].base,
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
