/**
 * 底栏那两枚 ghost 按钮的样式。
 *
 * 样式住在**实现**里、预览直接引，而不是各写一遍：
 * 预览图要跟真面板一模一样，两份样式各改各的，早晚对不上。
 */
import type { CSSProperties } from 'react'
import { EDGE, FONT_MONO, MUTED } from './usage-theme.js'

/**
 * ghost 按钮的样式。
 *
 * 竖屏用紧凑档：状态行（同步 · 本机 · 版本号）必须整行放得下，
 * 动作按钮再宽一点就会把版本号挤成省略号。
 * @param wide - 宽版（true）还是窄版。
 * @returns 内联样式对象。
 */
export function ghostButtonStyle(wide: boolean): CSSProperties {
  return {
    font: 'inherit',
    fontFamily: FONT_MONO,
    fontSize: wide ? 9 : 8.5,
    letterSpacing: '0.08em',
    padding: wide ? '4px 8px' : '3px 6px',
    borderRadius: 5,
    border: `1px solid ${EDGE}`,
    background: 'transparent',
    color: MUTED,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  }
}
