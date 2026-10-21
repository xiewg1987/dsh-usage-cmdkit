/**
 * Loading 骨架：读数这段时间里身体长什么样。
 *
 * 骨架不是「放个转圈」，是**把这一屏的轮廓先画出来**：
 * 主指标多大、下面几块、每块里有几行——先给一个形状，数据到了再替换。
 *
 * 两种灰度：
 * - **块**（白 5%）：一整块内容的位置；
 * - **条**（白 15%）：块里的行。
 *
 * 条必须比块亮一档。骨架的全部信息量都在「条在不在」上：
 * 块和条同亮度的话，整屏糊成一块灰板，
 * 在缩略图、低亮度屏幕、乃至刚点亮的那一瞬间，都读不出「在加载」。
 */
import type { ReactNode } from 'react'
import { RADIUS, SKELETON_BAR, SKELETON_BLOCK } from '../theme/usage-theme.js'

/** 骨架的形态：跟着当前视图走。 */
export type SkeletonVariant = 'overview' | 'top' | 'alerts'

/** 一块骨架（整块内容的位置）。 */
function Block(props: { height: number; radius?: number; flex?: number }): ReactNode {
  return (
    <div
      aria-hidden="true"
      style={{
        height: props.height,
        borderRadius: props.radius ?? RADIUS.md,
        background: SKELETON_BLOCK,
        flex: props.flex,
        minWidth: 0,
      }}
    />
  )
}

/** 一条骨架（块里的一行）。 */
function Bar(props: { width: number }): ReactNode {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 12,
        width: props.width,
        borderRadius: 3,
        background: SKELETON_BAR,
        flex: 'none',
      }}
    />
  )
}

/** 一张卡：卡里排几行条。 */
function Card(props: { rows: readonly number[] }): ReactNode {
  return (
    <div
      style={{
        padding: '16px',
        borderRadius: RADIUS.md,
        background: SKELETON_BLOCK,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {props.rows.map((width) => (
        <Bar key={width} width={width} />
      ))}
    </div>
  )
}

/** 骨架的属性。 */
export interface UsageSkeletonProps {
  /** 形态：跟着当前视图走。 */
  variant: SkeletonVariant
}

/**
 * 渲染 Loading 骨架。
 * @param props - 形态。
 * @returns 骨架内容。
 */
export function UsageSkeleton(props: UsageSkeletonProps): ReactNode {
  const { variant } = props
  if (variant === 'top') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Block height={150} />
        <Card rows={[210, 250, 190]} />
        <Block height={96} />
      </div>
    )
  }
  if (variant === 'alerts') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Block height={168} />
        <Card rows={[240, 200, 230, 180]} />
        <Block height={104} />
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Block height={150} />
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        <Block height={72} radius={RADIUS.sm} flex={1} />
        <Block height={72} radius={RADIUS.sm} flex={1} />
      </div>
      <Card rows={[240, 210, 260, 190]} />
    </div>
  )
}
