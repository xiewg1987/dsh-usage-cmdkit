/**
 * `usage` 命名空间字典（用量面板的文案）。
 *
 * zh 是键集的事实来源，en 按同一键集校验。
 * 带 `{name}` 的键是模板，调用方用 `t(key, params)` 填值。
 */

/** 简体中文字典。 */
export const zh = {
  'tab.title': '用量',
  'tab.description': '本机记录的 token 用量',
  'window.today': '今日',
  'window.d7': '7 日',
  'window.d30': '30 日',
  'window.today.short': '今日',
  'window.d7.short': '7 日',
  'window.d30.short': '30 日',
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
  'brand.name': 'DSH CmdKit',
  'brand.usage': 'Usage',
  'view.overview': '总览',
  'view.top': 'Top',
  'view.alerts': '告警',
  'view.soon': '该视图仍在开发中',
  'kpi.hitRate': '缓存命中率',
  'kpi.hitSub': '缓存读 {count}',
  'gauge.hitRate': '缓存命中',
  'stat.today': '今日',
  'stat.d7': '近 7 日',
  'insight.title': '洞察',
  'delta.vs': '较前 {days} 日',
  'delta.vsDay': '较昨日',
  'insight.uncachedLow': '未缓存输入占所选窗口 {pct}——提示词复用让这一项保持低位。',
  'insight.uncachedHigh': '未缓存输入占所选窗口 {pct}——缓存命中偏低，提示词的重复读入是主要开销。',
  'provider.title': '按来源',
  'provider.empty': '暂无数据',
  'provider.unknown': '未标注来源',
  'action.refresh': '刷新',
  'action.clear': '清空',
  'action.clearing': '清空中…',
  'footer.repo': 'dsh-usage-cmdkit',
  'footer.synced': '已同步',
  'footer.local': '本机正常',
  'state.loading': '正在读取用量…',
  'state.failed': '无法读取用量',
  'state.empty': '这段时间还没有用量记录',
} satisfies Record<string, string>

/** `usage` 命名空间的键联合。 */
export type UsageKey = keyof typeof zh

/**
 * 翻译函数的形状。
 *
 * 面板组件自己不绑 locale：把 `t` 当参数传进来，
 * 这样同一份组件既能挂在宿主里（`t` 由 locale 服务注入），
 * 也能在设计稿预览里喂一份本地字典（见 `design/_v5_src/`）。
 */
export type UsageTranslate = (key: UsageKey, params?: Record<string, string>) => string

/** 英文字典，按 zh 的键集校验完整性。 */
export const en = {
  'tab.title': 'Usage',
  'tab.description': 'Token usage recorded on this machine',
  'window.today': 'TODAY',
  'window.d7': '7 DAYS',
  'window.d30': '30 DAYS',
  'window.today.short': 'TODAY',
  'window.d7.short': '7D',
  'window.d30.short': '30D',
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
  'brand.name': 'DSH CmdKit',
  'brand.usage': 'Usage',
  'view.overview': 'OVERVIEW',
  'view.top': 'TOP',
  'view.alerts': 'ALERTS',
  'view.soon': 'This view is still in development',
  'kpi.hitRate': 'CACHE HIT RATE',
  'kpi.hitSub': '{count} cached',
  'gauge.hitRate': 'CACHE HIT',
  'stat.today': 'TODAY',
  'stat.d7': '7 DAYS',
  'insight.title': 'INSIGHT',
  'delta.vs': 'vs prev {days}d',
  'delta.vsDay': 'vs yesterday',
  'insight.uncachedLow': 'Uncached input at {pct} of the window — prompt reuse keeps that bar low.',
  'insight.uncachedHigh': 'Uncached input at {pct} of the window — cache hits are low, so repeated reads dominate the cost.',
  'provider.title': 'BY SOURCE',
  'provider.empty': 'No data yet',
  'provider.unknown': 'Unattributed source',
  'action.refresh': 'Refresh',
  'action.clear': 'Clear',
  'action.clearing': 'Clearing…',
  'footer.repo': 'dsh-usage-cmdkit',
  'footer.synced': 'synced',
  'footer.local': 'local ok',
  'state.loading': 'Loading usage…',
  'state.failed': 'Could not load usage',
  'state.empty': 'No usage recorded for this period',
} satisfies Record<UsageKey, string>
