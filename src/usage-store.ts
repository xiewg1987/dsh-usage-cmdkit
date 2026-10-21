import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { TurnTokenUsage } from '@deepseek-ai/dsh-token-meter/client'
import type { UsageBuckets, UsageDailyPoint, UsageProviderTotal, UsageSummary } from './protocol.js'

/** 与 Web「本轮用量」一致的四桶 */
export interface TokenBuckets {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export interface DayRollup {
  total: TokenBuckets
  /** 键：`provider/model`，无 routes 时归入 `unknown` */
  byProvider: Record<string, TokenBuckets>
}

export interface UsageStatsFile {
  version: 1
  retentionDays: number
  days: Record<string, DayRollup>
}

const FILE_VERSION = 1 as const
const DEFAULT_RETENTION_DAYS = 30

/** 汇总窗口的长度（含今日）。 */
const WINDOWS = { d7: 7, d30: 30 } as const

const zeroBuckets = (): TokenBuckets => ({
  uncachedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
})

/** 本地日历日 YYYY-MM-DD（与 dsh-context activity 一致，用宿主本地时区） */
export function dayKeyFromMs(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 相对某个时刻的本地日历日偏移。
 *
 * 用「日」构造器做本地日历算术，而不是减 24 小时：跨夏令时的那一天
 * 只有 23 或 25 小时，减固定毫秒会落错日。
 * @param ms - 基准时刻（毫秒时间戳）。
 * @param offsetDays - 向后（正）或向前（负）偏移的自然日数。
 * @returns 偏移后的本地日历日键。
 */
export function dayKeyOffset(ms: number, offsetDays: number): string {
  const base = new Date(ms)
  const shifted = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays)
  return dayKeyFromMs(shifted.getTime())
}

/**
 * profile 目录下的默认路径。
 *
 * 优先级：
 * 1. `DSH_PROFILE_DIR`——联调或自定义时显式指定。
 * 2. Harness home 下的 `profiles/web`——home 的规则与 harness 一致
 *    （`$DSH_HOME`，否则 `~/.dsh`；见 `@deepseek-ai/dsh-home-paths` 的 `resolveDshHome`）。
 *
 * **不**退回当前工作目录：harness 往往从源码仓库启动，退回 cwd 会把统计文件
 * 写进别人的源码树（本插件联调时就落到了 harness 仓库根目录）。
 * @returns 统计文件的绝对路径。
 */
export function defaultStatsPath(): string {
  const profileDir = process.env.DSH_PROFILE_DIR
  if (profileDir !== undefined && profileDir !== '') {
    return join(profileDir, 'usage-stats.json')
  }
  const configured = process.env.DSH_HOME
  const home = configured !== undefined && configured.trim().length > 0
    ? expandHomePath(configured.trim())
    : join(homedir(), '.dsh')
  return join(home, 'profiles', 'web', 'usage-stats.json')
}

/**
 * 展开受支持的 `~` 前缀（其余原样返回）。
 * @param path - 可能以 `~` 开头的路径。
 * @returns 展开后的路径。
 */
function expandHomePath(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2))
  return resolve(path)
}

function bucketsFromTurn(usage: TurnTokenUsage): TokenBuckets {
  return {
    uncachedInputTokens: usage.uncachedInputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
  }
}

function addBuckets(a: TokenBuckets, b: TokenBuckets): TokenBuckets {
  return {
    uncachedInputTokens: a.uncachedInputTokens + b.uncachedInputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  }
}

function providerKeys(usage: TurnTokenUsage): string[] {
  if (usage.routes === undefined || usage.routes.length === 0) return ['unknown']
  const keys = new Set<string>()
  for (const r of usage.routes) keys.add(`${r.provider}/${r.model}`)
  return [...keys]
}

/**
 * 拆开 `provider/model` 键。
 *
 * provider 名不含 `/`，因此按第一个斜杠拆：model 名里带斜杠也不受影响。
 */
function splitProviderKey(key: string): { provider: string; model: string } {
  const at = key.indexOf('/')
  if (at < 0) return { provider: key, model: '' }
  return { provider: key.slice(0, at), model: key.slice(at + 1) }
}

function emptyFile(retentionDays: number): UsageStatsFile {
  return { version: FILE_VERSION, retentionDays, days: {} }
}

async function readStatsFile(path: string): Promise<UsageStatsFile> {
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as UsageStatsFile
    if (parsed.version !== FILE_VERSION || typeof parsed.days !== 'object') {
      return emptyFile(DEFAULT_RETENTION_DAYS)
    }
    return {
      version: FILE_VERSION,
      retentionDays: typeof parsed.retentionDays === 'number' ? parsed.retentionDays : DEFAULT_RETENTION_DAYS,
      days: parsed.days ?? {},
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return emptyFile(DEFAULT_RETENTION_DAYS)
    }
    throw error
  }
}

/**
 * 丢弃超出保留窗口的日键。
 *
 * 按**日历日**裁剪而不是按条数：只保留「今天往前 retentionDays-1 天」内的日键。
 * 按条数裁剪会把停用期间的旧日键一直留着（只有一两个日键时永不触发），
 * 与「保留约 30 天」的实际意图不符。
 * @param file - 当前统计文件。
 * @param nowMs - 参考时刻（毫秒时间戳），默认取当前时间。
 * @returns 裁剪后的统计文件。
 */
export function pruneDays(file: UsageStatsFile, nowMs: number = Date.now()): UsageStatsFile {
  const retention = Math.max(1, Math.trunc(file.retentionDays))
  const cutoff = dayKeyOffset(nowMs, -(retention - 1))
  const days = Object.fromEntries(
    Object.entries(file.days).filter(([key]) => key >= cutoff),
  )
  if (Object.keys(days).length === Object.keys(file.days).length) return file
  return { ...file, days }
}

function mergeTurnIntoFile(
  file: UsageStatsFile,
  dayKey: string,
  usage: TurnTokenUsage,
  nowMs: number,
): UsageStatsFile {
  const inc = bucketsFromTurn(usage)
  const prev = file.days[dayKey]
  const day: DayRollup = prev === undefined
    ? { total: zeroBuckets(), byProvider: {} }
    : {
      total: { ...prev.total },
      byProvider: { ...prev.byProvider },
    }

  day.total = addBuckets(day.total, inc)
  for (const pk of providerKeys(usage)) {
    const pPrev = day.byProvider[pk] ?? zeroBuckets()
    day.byProvider[pk] = addBuckets(pPrev, inc)
  }

  return pruneDays({
    ...file,
    days: { ...file.days, [dayKey]: day },
  }, nowMs)
}

/** 串行写盘，避免并发 turn 互相覆盖 */
let writeChain: Promise<void> = Promise.resolve()

/** 把一次磁盘写排进串行链，保证读-改-写不互相覆盖。 */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = writeChain.then(task)
  writeChain = result.then(() => {}, () => {})
  return result
}

async function writeStatsAtomic(path: string, file: UsageStatsFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, `${JSON.stringify(file, null, 2)}\n`, 'utf8')
  await rename(tmp, path)
}

/**
 * 将本 turn 用量 merge 进 JSON 并写回磁盘。
 * @returns 写后的文件快照与路径
 */
export function persistTurnUsage(
  usage: TurnTokenUsage,
  turnEndTimeMs: number,
  path: string = defaultStatsPath(),
): Promise<{ path: string; file: UsageStatsFile; dayKey: string }> {
  return enqueue(async () => {
    const dayKey = dayKeyFromMs(turnEndTimeMs)
    const current = await readStatsFile(path)
    const file = mergeTurnIntoFile(current, dayKey, usage, turnEndTimeMs)
    await writeStatsAtomic(path, file)
    return { path, file, dayKey }
  })
}

/**
 * 汇总指定时间窗的用量。
 *
 * 窗口按**本地日历日**计算：今日往前 6 天是 7 日窗（含今日），往前 29 天是 30 日窗。
 * @param file - 已读入的统计文件。
 * @param nowMs - 参考时刻（毫秒时间戳）。
 * @returns 三个时间窗的总量与按 provider 的拆分。
 */
export function summarize(file: UsageStatsFile, nowMs: number = Date.now()): UsageSummary {
  const sumWindow = (days: number): UsageBuckets => {
    let total = zeroBuckets()
    for (let offset = 0; offset < days; offset++) {
      const day = file.days[dayKeyOffset(nowMs, -offset)]
      if (day === undefined) continue
      total = addBuckets(total, day.total)
    }
    return total
  }

  const byProvider = new Map<string, UsageProviderTotal>()
  for (let offset = 0; offset < WINDOWS.d30; offset++) {
    const day = file.days[dayKeyOffset(nowMs, -offset)]
    if (day === undefined) continue
    for (const [key, buckets] of Object.entries(day.byProvider)) {
      const { provider, model } = splitProviderKey(key)
      const prev = byProvider.get(key) ?? {
        provider,
        model,
        uncachedInputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }
      byProvider.set(key, { ...addBuckets(prev, buckets), provider, model })
    }
  }

  /**
   * 日序列：从旧到新，缺记录的日子补零。
   *
   * 补零而不是跳过：客户端要画折线，跳过空日会把断档连成直线，
   * 看起来像「那几天用量平稳」，其实是「那几天没用」。
   */
  const daily: UsageDailyPoint[] = []
  for (let offset = WINDOWS.d30 - 1; offset >= 0; offset--) {
    const day = dayKeyOffset(nowMs, -offset)
    const total = file.days[day]?.total
    daily.push({
      day,
      uncachedInputTokens: total?.uncachedInputTokens ?? 0,
      outputTokens: total?.outputTokens ?? 0,
      cacheReadTokens: total?.cacheReadTokens ?? 0,
      cacheWriteTokens: total?.cacheWriteTokens ?? 0,
    })
  }

  return {
    today: sumWindow(1),
    d7: sumWindow(WINDOWS.d7),
    d30: sumWindow(WINDOWS.d30),
    byProvider: [...byProvider.values()].sort(
      (a, b) => (b.uncachedInputTokens + b.outputTokens) - (a.uncachedInputTokens + a.outputTokens),
    ),
    daily,
    generatedAt: nowMs,
  }
}

/**
 * 读出当前用量汇总。
 * @param path - 统计文件路径。
 * @param nowMs - 参考时刻（毫秒时间戳）。
 * @returns 三个时间窗的总量与按 provider 的拆分。
 */
export async function readUsageSummary(
  path: string = defaultStatsPath(),
  nowMs: number = Date.now(),
): Promise<UsageSummary> {
  return summarize(await readStatsFile(path), nowMs)
}

/**
 * 清空统计：保留保留天数，清掉所有日键。
 * @param path - 统计文件路径。
 * @returns 清空后的统计文件。
 */
export function clearUsage(path: string = defaultStatsPath()): Promise<UsageStatsFile> {
  return enqueue(async () => {
    const current = await readStatsFile(path)
    const cleared: UsageStatsFile = { ...current, days: {} }
    await writeStatsAtomic(path, cleared)
    return cleared
  })
}
