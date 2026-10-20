/**
 * `usage` 命名空间字典（Dashboard 的文案）。
 *
 * zh 是键集的事实来源，en 按同一键集校验。
 * 带 `{name}` 的键是模板，调用方用 `t(key, params)` 填值。
 */

/** 简体中文字典。 */
export const zh = {
  'tab.title': '用量',
  'tab.description': '本机记录的 token 用量',
  'range.today': '今日',
  'range.d7': '7 日',
  'range.d30': '30 日',
  'window.today': '今日',
  'window.d7': '7 日',
  'window.d30': '30 日',
  'bucket.uncachedInput': '输入（未命中缓存）',
  'bucket.output': '输出',
  'bucket.cacheRead': '缓存读取',
  'bucket.cacheWrite': '缓存写入',
  'bucket.uncachedInput.short': '未缓存输入',
  'bucket.output.short': '输出',
  'bucket.cacheRead.short': '缓存读取',
  'bucket.cacheWrite.short': '缓存写入',
  'total.label': '令牌',
  'ring.dailyAvg': '日均 {value}',
  'panel.subtitle': 'DeepSeek Web 本机 token 遥测 · 侧栏环 · 4 桶面板 · 30 天滚动',
  'hud.telemetry': '遥测',
  'hud.locked': '已锁定',
  'hud.webLocal': '本机',
  'hud.phase': '阶段 {window}',
  'hud.buckets': '{count} 桶',
  'hud.sync': '同步 {time}',
  'insight.uncached': '未缓存输入占所选窗口 {pct}——提示词复用让这一项保持低位。',
  'footer.build': 'DSH · 本机记录 · 30 天滚动 · 本地 JSON',
  'provider.title': '按来源',
  'provider.empty': '暂无数据',
  'provider.unknown': '未标注来源',
  'action.refresh': '刷新',
  'action.clear': '清空',
  'action.clearing': '清空中…',
  'state.loading': '正在读取用量…',
  'state.failed': '无法读取用量',
  'state.empty': '这段时间还没有用量记录',
} satisfies Record<string, string>

/** `usage` 命名空间的键联合。 */
export type UsageKey = keyof typeof zh

/** 英文字典，按 zh 的键集校验完整性。 */
export const en = {
  'tab.title': 'Usage',
  'tab.description': 'Token usage recorded on this machine',
  'range.today': 'Today',
  'range.d7': '7 days',
  'range.d30': '30 days',
  'window.today': 'TODAY',
  'window.d7': '7 DAYS',
  'window.d30': '30 DAYS',
  'bucket.uncachedInput': 'Input (uncached)',
  'bucket.output': 'Output',
  'bucket.cacheRead': 'Cache read',
  'bucket.cacheWrite': 'Cache write',
  'bucket.uncachedInput.short': 'Uncached input',
  'bucket.output.short': 'Output',
  'bucket.cacheRead.short': 'Cache read',
  'bucket.cacheWrite.short': 'Cache write',
  'total.label': 'TOKENS',
  'ring.dailyAvg': 'DAILY AVG {value}',
  'panel.subtitle': 'Local token telemetry for DeepSeek Web · Sidebar ring · 4-token panel · 30-day rollup',
  'hud.telemetry': 'TELEMETRY',
  'hud.locked': 'LOCKED',
  'hud.webLocal': 'WEB-LOCAL',
  'hud.phase': 'PHASE {window}',
  'hud.buckets': '{count} BUCKETS',
  'hud.sync': 'SYNC {time}',
  'insight.uncached': 'Uncached input at {pct} of the window — prompt reuse keeps that bar low.',
  'footer.build': 'DSH · WEB-LOCAL · 30-DAY ROLLUP · JSON-LOCAL',
  'provider.title': 'By source',
  'provider.empty': 'No data yet',
  'provider.unknown': 'Unattributed source',
  'action.refresh': 'Refresh',
  'action.clear': 'Clear',
  'action.clearing': 'Clearing…',
  'state.loading': 'Loading usage…',
  'state.failed': 'Could not load usage',
  'state.empty': 'No usage recorded for this period',
} satisfies Record<UsageKey, string>
