/**
 * 面板用的小图标。
 *
 * 图形**不是手画的**：取自 Lucide（ISC 许可，https://lucide.dev），
 * 路径数据原样搬过来，避免「设计稿一套图标、代码另一套」。
 * Figma 里那几个图标也是从同一份 SVG 导进去的，两边形状完全一致。
 *
 * 约定：24×24 视窗、2px 描边、圆角端点——与 Lucide 默认一致，
 * 缩到 12–16px 也不会糊。
 */
import type { ReactNode } from 'react'

/** 图标的公共属性。 */
export interface IconProps {
  /** 边长（px）。 */
  size?: number
  /** 描边颜色，默认跟随文字色。 */
  color?: string
  /** 描边宽度，默认 2。 */
  strokeWidth?: number
  /** 无障碍标题；不给就当装饰图处理。 */
  title?: string
}

/**
 * 图标壳的内部属性。
 *
 * `children` 必须从 **props** 里取，不能写成第二个位置参数
 * （`function Icon(props, children)`）：React 18 调用函数组件时，
 * 第二个位置参数是 legacy context——一个空对象 `{}`，
 * 把它当 children 渲染出去就会炸「Objects are not valid as a React child」。
 */
interface IconShellProps extends IconProps {
  /** 图标路径。 */
  children?: ReactNode
}

/** 图标的公共外壳：视窗、描边属性与标题。 */
function Icon(props: IconShellProps): ReactNode {
  const { size = 14, color = 'currentColor', strokeWidth = 2, title, children } = props
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title === undefined}
      role={title === undefined ? undefined : 'img'}
      style={{ display: 'block', flex: 'none' }}
    >
      {title !== undefined && <title>{title}</title>}
      {children}
    </svg>
  )
}

/**
 * 刷新：环形箭头。
 * @param props - 尺寸与颜色。
 * @returns 图标。
 */
export function IconRefresh(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </Icon>
  )
}

/**
 * 上涨：右上箭头。
 * @param props - 尺寸与颜色。
 * @returns 图标。
 */
export function IconUp(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </Icon>
  )
}

/**
 * 下跌：右下箭头。
 * @param props - 尺寸与颜色。
 * @returns 图标。
 */
export function IconDown(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="m7 7 10 10" />
      <path d="M17 7v10H7" />
    </Icon>
  )
}

/**
 * 表盘：半环 + 指针（用在命中率那一枚）。
 * @param props - 尺寸与颜色。
 * @returns 图标。
 */
export function IconGauge(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </Icon>
  )
}

/**
 * 说明：圆圈里的 i（洞察卡标题前的小标）。
 * @param props - 尺寸与颜色。
 * @returns 图标。
 */
export function IconInfo(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Icon>
  )
}

/**
 * 清空：垃圾桶。
 * @param props - 尺寸与颜色。
 * @returns 图标。
 */
export function IconTrash(props: IconProps): ReactNode {
  return (
    <Icon {...props}>
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Icon>
  )
}
