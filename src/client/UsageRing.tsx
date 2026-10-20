/**
 * 用量主环：四个 token 桶各占一段的粗软进度弧，环心是总览数字。
 *
 * 画法与 Figma 的 hero 图一致：一条极淡底环 + 四段有间隙的弧，
 * 弧自带顶光玻璃渐变与外发光 bloom，环心一枚柔和能量核。
 *
 * 几何全部按像素写进 viewBox（viewBox 与像素 1:1），
 * 所以同一套代码既能渲染窄栏的小环、也能渲染宽面板的大环，
 * 而字号不随缩放失真——这是把 hero 图落成产品面板的关键。
 */
import { useId } from 'react'
import type { ReactNode } from 'react'
import type { UsageBuckets } from '../protocol.js'
import { ACCENT, BUCKET_GLASS, FONT_SANS, MUTED, TEXT, rgba } from './usage-theme.js'

/** 环的两种形态：窄栏里的紧凑环、宽面板时的 hero 环。 */
export type RingVariant = 'compact' | 'hero'

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
 */
const VARIANT = {
  compact: { headline: 42, caption: 10.5, sub: 10.5, headlineGap: 1, lineGap: 21, subGap: 14 },
  hero: { headline: 84, caption: 13, sub: 13, headlineGap: 2, lineGap: 42, subGap: 28 },
} as const

/** 弧线路径半径占画布的比例（描边居中，所以外缘落在 50%）。 */
const RADIUS_RATIO = 0.465

/** 弧粗占画布的比例。 */
const STROKE_RATIO = 0.07

/** 环外标签：每个桶一行全名加百分比。 */
export interface RingLabel {
  /** 桶的键。 */
  key: string
  /** 展示文本。 */
  text: string
}

/** 主环的属性。 */
export interface UsageRingProps {
  /** 四桶用量。 */
  buckets: UsageBuckets
  /** 环心大字：总量。 */
  headline: string
  /** 环心第一行的中性部分（如「令牌」）。 */
  caption: string
  /** 环心第一行的强调部分（如「30 日」）：没有时只显示 caption。 */
  captionAccent?: string
  /** 环心第二行副文案。 */
  sub: string
  /** 渲染尺寸（正方形，px）。 */
  size: number
  /** 形态。 */
  variant: RingVariant
  /** 环外标签：只在 hero 形态给。 */
  labels?: readonly RingLabel[]
}

/**
 * 渲染用量主环。
 * @param props - 桶用量、环心文案、尺寸、形态与环外标签。
 * @returns 环与（hero 形态下的）环外标签。
 */
export function UsageRing(props: UsageRingProps): ReactNode {
  const { buckets, headline, caption, captionAccent, sub, size, variant, labels } = props
  // useId 带冒号，做 URL 片段引用要清掉。
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const v = VARIANT[variant]
  const center = size / 2
  const radius = size * RADIUS_RATIO
  const stroke = size * STROKE_RATIO
  const outer = radius + stroke / 2
  const total = RING_KEYS.reduce((sum, key) => sum + buckets[key], 0)

  // 四段弧：从十二点方向顺时针铺开，段与段之间留自然缺口。
  let cursor = -Math.PI / 2
  const segments = RING_KEYS.map((key, index) => {
    const value = buckets[key]
    const share = total > 0 ? value / total : 0
    const from = cursor
    const to = cursor + share * Math.PI * 2
    cursor = to
    return { key, index, value, share, from, to }
  })

  const arc = (from: number, to: number, pathRadius: number): { length: number; offset: number } => ({
    length: (to - from) * pathRadius,
    offset: (from + Math.PI / 2) * pathRadius,
  })

  return (
    <div style={{ position: 'relative', width: size, height: size, overflow: 'visible' }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        overflow="visible"
        role="img"
        aria-label={headline}
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
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.06}
          strokeWidth={stroke}
        />
        {/* 能量核：两层柔光球，不做实心球。 */}
        <circle cx={center} cy={center} r={outer} fill={`url(#${uid}-halo)`} />
        <circle cx={center} cy={center} r={size * 0.23} fill={`url(#${uid}-core)`} />
        {/* 四段弧：玻璃渐变 + 外发光 bloom。 */}
        {segments.map((segment) => {
          const { length, offset } = arc(segment.from, segment.to, radius)
          return (
            <circle
              key={segment.key}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={`url(#${uid}-g${segment.index})`}
              strokeWidth={stroke}
              strokeDasharray={`${length} ${2 * Math.PI * radius - length}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${center} ${center})`}
              style={{ filter: `drop-shadow(0 0 ${size * 0.022}px ${rgba(BUCKET_GLASS[segment.index].base, 0.42)})` }}
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
              cx={center}
              cy={center}
              r={specRadius}
              fill="none"
              stroke={`url(#${uid}-spec)`}
              strokeWidth={Math.max(2, size * 0.007)}
              strokeDasharray={`${length} ${2 * Math.PI * specRadius - length}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${center} ${center})`}
            />
          )
        })}
        {/* 环心总览。 */}
        <text
          x={center}
          y={center + v.headlineGap}
          textAnchor="middle"
          fontSize={v.headline}
          fontWeight={700}
          fill={TEXT}
          letterSpacing={-size * 0.004}
          style={{ fontFamily: 'inherit' }}
        >
          {headline}
        </text>
        <text
          x={center}
          y={center + v.lineGap}
          textAnchor="middle"
          fontSize={v.caption}
          fontWeight={500}
          fill={MUTED}
          letterSpacing={v.caption * 0.115}
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
          y={center + v.lineGap + v.subGap}
          textAnchor="middle"
          fontSize={v.sub}
          fontWeight={400}
          fill={MUTED}
          letterSpacing={v.sub * 0.09}
          style={{ fontFamily: 'inherit' }}
        >
          {sub}
        </text>
      </svg>

      {labels?.map((label, index) => {
        const segment = segments[index]
        if (segment === undefined) return null
        const mid = (segment.from + segment.to) / 2
        const anchor = outer + size * 0.055
        const x = center + anchor * Math.cos(mid)
        const y = center + anchor * Math.sin(mid)
        const horizontal = Math.cos(mid)
        const align = horizontal > 0.3 ? 'left' : horizontal < -0.3 ? 'right' : 'center'
        return (
          <span
            key={label.key}
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
              fontSize: Math.max(10, size * 0.026),
              fontWeight: 500,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: BUCKET_GLASS[index].base,
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
