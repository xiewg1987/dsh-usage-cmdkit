/**
 * 键帽的呈现：把「主修饰键 + 键」按平台与运行时拼成人读的写法。
 *
 * 规则跟着宿主走：桌面应用用主修饰键（macOS 是 ⌘，其余是 Ctrl）；
 * 浏览器里的 Web 额外加一个 Alt——浏览器的 `Ctrl+数字` 是「切标签页」，
 * 直接占用会跟浏览器打架，宿主自己的命令也是这么避开的。
 *
 * 全局唤出键不在这儿拼：那一枚走宿主的快捷键目录，拿到的是**这台机器上**的
 * 真实键帽（含用户在设置里改过的绑定），比这里推算的准。
 */
import type { KeyStyle } from './usage-state.js'

/** 一个加速键：主键 + 可选的 Shift / Alt。 */
export interface Combo {
  /** 主键的显示名（`1` / `J` / `E`）。 */
  readonly key: string
  /** 是否带 Shift。 */
  readonly shift?: boolean
  /** 是否带 Alt。 */
  readonly alt?: boolean
}

/**
 * 渲染一个加速键。
 * @param style - 平台与运行时。
 * @param combo - 主键与修饰键。
 * @returns 人读的键帽串（macOS 连写，其余用 `+` 连接）。
 */
export function formatCombo(style: KeyStyle, combo: Combo): string {
  const alt = combo.alt === true || style.runtime === 'web'
  const shift = combo.shift === true
  if (style.platform === 'macos') {
    return `⌘${alt ? '⌥' : ''}${shift ? '⇧' : ''}${combo.key}`
  }
  const parts = ['Ctrl']
  if (alt) parts.push('Alt')
  if (shift) parts.push('Shift')
  parts.push(combo.key)
  return parts.join('+')
}

/**
 * 全局命令面板那一枚键帽。
 *
 * 优先用宿主快捷键目录里的**真实键帽**（那包含用户自己改过的绑定），
 * 目录还没就绪时按平台推算一枚——形状对，内容不会错。
 * @param style - 平台与运行时。
 * @param paletteKeys - 宿主目录给出的键帽。
 * @returns 人读的键帽串。
 */
export function paletteKeycap(style: KeyStyle, paletteKeys: readonly string[]): string {
  return paletteKeys.length > 0 ? paletteKeys.join('') : formatCombo(style, { key: 'J' })
}

/** 判断按键事件用到的修饰键。 */
export interface ComboEvent {
  /** 事件的 key 值。 */
  readonly key: string
  /** ⌘ 是否按下。 */
  readonly metaKey: boolean
  /** Ctrl 是否按下。 */
  readonly ctrlKey: boolean
  /** Alt 是否按下。 */
  readonly altKey: boolean
  /** Shift 是否按下。 */
  readonly shiftKey: boolean
}

/**
 * 判断一次按键事件是不是这个加速键。
 *
 * 修饰键必须**完全对上**：多按一个 Shift 也算没命中，
 * 否则面板里的 `⌘1` 会被 `⌘⇧1` 误触发。
 * @param style - 平台与运行时。
 * @param combo - 主键与修饰键。
 * @param event - 按键事件。
 * @returns 是否命中。
 */
export function matchesCombo(style: KeyStyle, combo: Combo, event: ComboEvent): boolean {
  if (event.key.toLowerCase() !== combo.key.toLowerCase()) return false
  if (style.platform === 'macos') {
    if (!event.metaKey || event.ctrlKey) return false
  } else if (!event.ctrlKey || event.metaKey) {
    return false
  }
  if (event.altKey !== (combo.alt === true || style.runtime === 'web')) return false
  return event.shiftKey === (combo.shift === true)
}
