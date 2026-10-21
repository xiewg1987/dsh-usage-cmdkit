/**
 * 导出：把用量汇总变成可带走的两种形态——JSON（进剪贴板）与 CSV（落文件）。
 *
 * 两种形态都是**纯本机**的：数据不出这台机器，只交给用户自己选的去处。
 * 这一层不碰 DOM 与网络，方便单独验证内容对不对。
 */
import type { UsageBuckets, UsageSummary } from '../protocol.js'

/** CSV 的表头。列名用英文，机器读得懂；值不变。 */
const CSV_HEADER = 'window,provider,model,uncached_input,output,cache_read,cache_write,total'

/** 汇总行在 provider 列上用的占位名：它不是某个来源，是三个窗口各自的总计。 */
const TOTAL_ROW = '__total__'

/**
 * 给 CSV 的一个字段加引号（只在必要时）。
 * @param value - 字段原文。
 * @returns 可安全写进 CSV 的字段。
 */
function cell(value: string): string {
  return /[",\n\r]/u.test(value) ? `"${value.replace(/"/gu, '""')}"` : value
}

/**
 * 四个桶的合计。
 * @param buckets - 四个桶。
 * @returns 总量。
 */
function totalOf(buckets: UsageBuckets): number {
  return buckets.uncachedInputTokens
    + buckets.outputTokens
    + buckets.cacheReadTokens
    + buckets.cacheWriteTokens
}

/**
 * 排一行 CSV。
 * @param window - 时间窗名。
 * @param provider - 来源名。
 * @param model - 模型名。
 * @param buckets - 四个桶。
 * @returns 一行 CSV 文本。
 */
function rowOf(window: string, provider: string, model: string, buckets: UsageBuckets): string {
  return [
    window,
    provider,
    model,
    String(buckets.uncachedInputTokens),
    String(buckets.outputTokens),
    String(buckets.cacheReadTokens),
    String(buckets.cacheWriteTokens),
    String(totalOf(buckets)),
  ].map(cell).join(',')
}

/**
 * 把一份汇总导成 CSV 文本。
 *
 * 表结构：先三行窗口总计（今日 / 7 日 / 30 日），
 * 再按来源拆分的 30 日明细——汇总里 `byProvider` 就是这个口径。
 * @param summary - 用量汇总。
 * @returns CSV 文本。
 */
export function buildUsageCsv(summary: UsageSummary): string {
  const lines: string[] = [CSV_HEADER]
  lines.push(rowOf('today', TOTAL_ROW, '', summary.today))
  lines.push(rowOf('d7', TOTAL_ROW, '', summary.d7))
  lines.push(rowOf('d30', TOTAL_ROW, '', summary.d30))
  for (const provider of summary.byProvider) {
    lines.push(rowOf('d30', provider.provider, provider.model, provider))
  }
  return `${lines.join('\n')}\n`
}

/**
 * 把一份汇总导成 JSON 文本。
 * @param summary - 用量汇总。
 * @returns 缩进过的 JSON 文本。
 */
export function buildUsageJson(summary: UsageSummary): string {
  return JSON.stringify(summary, null, 2)
}

/**
 * 复制一段文本到剪贴板。
 *
 * 优先用异步剪贴板 API；它要求安全上下文，非安全上下文或被策略拒绝时，
 * 退回到「临时 textarea + execCommand」的老办法。
 * @param text - 要复制的文本。
 * @returns 是否复制成功。
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 落到下面的兜底：权限被拒与 API 不存在在这里没有区别。
  }
  return legacyCopy(text)
}

/**
 * 老办法复制：临时 textarea + execCommand('copy')。
 * @param text - 要复制的文本。
 * @returns 是否复制成功。
 */
function legacyCopy(text: string): boolean {
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

/**
 * 把一段文本作为文件下载。
 * @param name - 文件名。
 * @param text - 文件内容。
 * @param mime - MIME 类型。
 * @returns 是否触发下载。
 */
export function downloadTextFile(name: string, text: string, mime: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: mime }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    // 交给下一轮事件循环回收：立刻 revoke 会让部分浏览器拿不到内容。
    setTimeout(() => { URL.revokeObjectURL(url) }, 0)
    return true
  } catch {
    return false
  }
}

/**
 * 导出文件名里的时间戳：`20261020-1532`。
 *
 * 用本机时区：这份文件是给这台机器上的人看的。
 * @param timestamp - 毫秒时间戳。
 * @returns `YYYYMMDD-HHmm` 形式的时间戳。
 */
export function fileStamp(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number, width = 2): string => String(value).padStart(width, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}`
}
