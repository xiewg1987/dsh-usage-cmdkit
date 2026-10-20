/**
 * 入场编排：时间表与动画原语。
 *
 * 动效全部走 **Web Animations API**（`element.animate`）：
 * 样式仍旧只用内联 style，不引 CSS Modules，也不在运行时插 `<style>` 标签——
 * 这个插件的浏览器半是独立打包的产物，多一条样式构建依赖就多一处会漂的地方。
 *
 * 时间表与 `design/motion-spec.md` 同源：改这里要同步改那份文档。
 *
 * 两处刻意的取舍：
 * - 所有入场动画用 `fill: 'backwards'`：延迟期间保持起始态（元素不可见），
 *   播完即交还给样式表。这样**刷新**时元素回到内联样式上的新值，
 *   由 CSS transition 平滑插值，而不是重播一遍入场。
 * - 数值滚动用 rAF + state，而不是动画 DOM 文本：
 *   文本归 React 管，刷新时不会被动画残留的 DOM 值覆盖。
 */
import { useEffect, useRef, useState } from 'react'

/** 主缓动：进入用缓出。 */
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'

/** 线性：只给进度条宽度、环弧生长这类「按比例推进」的动画用。 */
export const EASE_LINEAR = 'linear'

/**
 * 入场编排的时间表（毫秒）。
 *
 * 宽版（≥900px 的面板 / 全屏）走完整编排，紧凑版（右栏窄态）把步骤合并：
 * 品牌头、视图 Tab、时间窗并成一组先落，环提前到列表之前。
 */
export const TIMING = {
  /** 宽版：总长约 1.15s。 */
  wide: {
    frame: 0,
    header: 80,
    tabs: 150,
    pills: 200,
    kpi: 280,
    kpiStep: 60,
    rows: 400,
    rowStep: 50,
    bars: 400,
    track: 480,
    arc: 540,
    arcStep: 80,
    number: 540,
    caption: 600,
    insight: 740,
    entry: 820,
    footer: 900,
  },
  /** 紧凑版：总长约 1.0s。品牌头、视图 Tab、时间窗合并成一组同时落下。 */
  compact: {
    frame: 0,
    header: 80,
    tabs: 80,
    pills: 80,
    kpi: 240,
    kpiStep: 40,
    rows: 360,
    rowStep: 45,
    bars: 360,
    track: 300,
    arc: 340,
    arcStep: 30,
    number: 340,
    caption: 420,
    insight: 740,
    entry: 820,
    footer: 900,
  },
} as const

/** 刷新时数值从旧值滑到新值的时长。 */
export const REFRESH_SPAN = 400

/**
 * 能不能播动画。
 *
 * Web Animations API 在现代浏览器里都有，但测试用的 DOM 实现（jsdom 等）
 * 没有——那里应当安静地跳过动画，而不是把整个面板炸掉。
 * @param element - 目标元素。
 * @returns 该元素是否支持 animate。
 */
function canAnimate(element: Element): element is Element & { animate: Element['animate'] } {
  return typeof (element as { animate?: unknown }).animate === 'function'
}

/**
 * 元素上浮淡入：列表行、KPI 这类「从下方升起」的元素。
 * @param element - 目标元素。
 * @param delay - 延迟（毫秒）。
 * @param duration - 时长（毫秒）。
 */
export function riseIn(element: Element | null | undefined, delay: number, duration = 180): void {
  if (element === null || element === undefined || !canAnimate(element)) return
  element.animate(
    [
      { opacity: 0, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    { duration, delay, easing: EASE_OUT, fill: 'backwards' },
  )
}

/**
 * 元素自上方滑入淡入：品牌头、Tab、时间窗这些「从上方落下」的元素。
 * @param element - 目标元素。
 * @param delay - 延迟（毫秒）。
 * @param duration - 时长（毫秒）。
 */
export function dropIn(element: Element | null | undefined, delay: number, duration = 200): void {
  if (element === null || element === undefined || !canAnimate(element)) return
  element.animate(
    [
      { opacity: 0, transform: 'translateY(-8px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    { duration, delay, easing: EASE_OUT, fill: 'backwards' },
  )
}

/**
 * 元素淡入：不动位置，只亮起来。
 * @param element - 目标元素。
 * @param delay - 延迟（毫秒）。
 * @param duration - 时长（毫秒）。
 */
export function fadeIn(element: Element | null | undefined, delay: number, duration = 180): void {
  if (element === null || element === undefined || !canAnimate(element)) return
  element.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration, delay, easing: EASE_OUT, fill: 'backwards' },
  )
}

/**
 * 把一个数从旧值滚到新值。
 *
 * 首次挂载从 0 起、按 `delay` 入场；此后再变（刷新）则从当前值接着滚，
 * 滚过时不留小数位噪声——终值直接落位。
 * @param target - 终值。
 * @param delay - 首次入场的延迟（毫秒）。
 * @param duration - 首次入场的时长（毫秒）。
 * @returns 当前显示值。
 */
export function useCountUp(target: number, delay: number, duration: number): number {
  const [value, setValue] = useState(0)
  const current = useRef(0)
  const started = useRef(false)

  useEffect(() => {
    const first = !started.current
    started.current = true
    const from = first ? 0 : current.current
    const wait = first ? delay : 0
    const span = first ? duration : REFRESH_SPAN

    let frame = 0
    let origin = 0
    const step = (stamp: number): void => {
      if (origin === 0) origin = stamp
      const elapsed = stamp - origin - wait
      const p = elapsed <= 0 ? 0 : Math.min(1, elapsed / span)
      const eased = 1 - (1 - p) ** 3
      const next = from + (target - from) * eased
      current.current = next
      setValue(next)
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, delay, duration])

  return value
}
