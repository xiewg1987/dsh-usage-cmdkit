/**
 * 用量面板的设计令牌：近黑午夜蓝 + 一种界面强调色。
 *
 * 一条规则贯穿全套令牌：**界面强调色只有蓝青一种**，
 * 四色只出现在环段、圆点、细条与它们的图例位置上，正文文字一律中性灰阶。
 * 这样背景永远是干净的近黑，视线只会落在数据上。
 *
 * 强调色上限是 3：界面蓝青 {@link ACCENT_CYAN}、
 * 涨跌绿 {@link POSITIVE}、涨跌红 {@link NEGATIVE}（只在真有负值时出现）。
 */

/**
 * 面板底色：近黑的午夜蓝。
 *
 * 比纯黑偏蓝一档：金融竖屏那种「夜里看盘」的底子，
 * 纯黑会发闷，带一点蓝才像一块玻璃底板。
 */
export const PANEL_BG = '#070a12'

/** 竖屏面板的卡片底色：深灰半透明。 */
export const CARD = 'rgba(255,255,255,0.035)'

/** 竖屏面板的卡片描边：极淡，只用来把卡片从底色里分出来。 */
export const CARD_EDGE = 'rgba(255,255,255,0.06)'

/**
 * 竖屏面板的唯一强调色：蓝青。
 *
 * 竖屏版全页只允许两种彩色——这一个是「界面色」（选中态、进度环、标签），
 * 另一个是 {@link POSITIVE}（涨跌）。其余一律灰阶。
 */
export const ACCENT_CYAN = '#38bdf8'

/**
 * 竖屏面板的第二种彩色：涨跌绿。
 *
 * 只用在「好的一面」的读数上（例如缓存命中的那枚副行）。
 */
export const POSITIVE = '#22c55e'

/**
 * 竖屏面板的第三种彩色（只在真的有负值时出现）：涨跌红。
 *
 * 三种彩色是**上限**：界面蓝青 + 涨跌绿/红，其余一律灰阶。
 */
export const NEGATIVE = '#ef4444'

/** 竖屏面板的进度环轨道：暗灰，不是黑。 */
export const RING_TRACK = '#1c2433'

/**
 * 竖屏面板的间距刻度：4 的倍数。
 *
 * 全部收在一处，免得同一份稿子里出现 13、15、17 这种随手值。
 */
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const

/** 竖屏面板的圆角刻度。 */
export const RADIUS = {
  /** 小卡（指标块、洞察卡）。 */
  sm: 10,
  /** 大卡（主指标、分类列表）。 */
  md: 12,
  /** 药丸。 */
  pill: 7,
  /** 面板本身。 */
  panel: 14,
} as const

/** 主文字。 */
export const TEXT = '#f2f5f9'

/** 次级文字：副文案、数值后缀。 */
export const MUTED = '#8b94a3'

/** 三级文字：页脚与微标。 */
export const FAINT = '#5b6472'

/** 面板内的发丝线：卡片之间那一道极细的横线。 */
export const HAIRLINE = 'rgba(255,255,255,0.07)'

/** 面板描边。 */
export const EDGE = 'rgba(255,255,255,0.07)'

/** 唯一强调色：电光蓝。 */
export const ACCENT = '#4c8dff'

/** 四个 token 桶的品类色：只用于环段与条形。 */
export const BUCKET_COLORS = ['#4c8dff', '#22c55e', '#a855f7', '#f59e0b'] as const

/**
 * 环段与进度条的玻璃渐变三档：顶光提亮、基色、底部压暗。
 *
 * 顺序与 {@link BUCKET_COLORS} 一一对应。
 */
export const BUCKET_GLASS = [
  { hi: '#6498ff', base: '#4c8dff', lo: '#4782f5' },
  { hi: '#2ecc71', base: '#22c55e', lo: '#20bd5a' },
  { hi: '#b56bf9', base: '#a855f7', lo: '#a050f0' },
  { hi: '#f9a72e', base: '#f59e0b', lo: '#ee980a' },
] as const

/** 正文无衬线字体栈：与设计稿同款 Inter 优先，缺字时退回系统无衬线。 */
export const FONT_SANS = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'

/** 微标等宽字体栈。 */
export const FONT_MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

/**
 * 把十六进制色转成带透明度的 rgba 字符串。
 * @param hex - `#rrggbb` 形式的颜色。
 * @param alpha - 0–1 的透明度。
 * @returns rgba 颜色串。
 */
export function rgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * 千分位整数。
 * @param value - 计数。
 * @returns 带千分位分隔的整数。
 */
export function formatCount(value: number): string {
  return value.toLocaleString()
}

/**
 * 紧凑数字：环心的大字与日均都用它。
 *
 * 千分位用大写 K / M，与设计稿的 `742.6K` 一致；
 * 一千以下取整，免得日均这类除出来的数露出长小数。
 * @param value - 计数。
 * @returns 形如 `742.6K` / `328` / `980` 的短串。
 */
export function formatCompact(value: number): string {
  if (value < 1000) return String(Math.round(value))
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}K`
  return `${(value / 1_000_000).toFixed(1)}M`
}

/**
 * 百分比：整数值，四舍五入。
 * @param value - 计数。
 * @param total - 总量。
 * @returns 0–100 的整数百分比。
 */
export function percentOf(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((value / total) * 100)
}
