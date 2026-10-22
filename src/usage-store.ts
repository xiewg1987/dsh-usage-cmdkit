import { randomBytes } from 'node:crypto'
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { TurnTokenUsage } from '@deepseek-ai/dsh-token-meter/client'
import {
  MIXED_PROVIDER_KEY,
  UNKNOWN_PROVIDER_KEY,
  type UsageBuckets,
  type UsageDailyPoint,
  type UsageProviderDaily,
  type UsageProviderTotal,
  type UsageSummary,
  type UsageSummaryWarning,
} from './protocol.js'

/** 与 Web「本轮用量」一致的四桶 */
export interface TokenBuckets {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export interface DayRollup {
  total: TokenBuckets
  /**
   * 键：`provider/model`、{@link UNKNOWN_PROVIDER_KEY} 或 {@link MIXED_PROVIDER_KEY}。
   */
  byProvider: Record<string, TokenBuckets>
  /** 当日完成的 turn 数（0.2+ 写入；旧文件无此字段）。 */
  turns?: number
}

/** 归因统计：新 turn 写入时递增；旧文件可能缺失。 */
export interface AttributionStats {
  totalTurns: number
  exactTurns: number
  mixedTurns: number
  unknownTurns: number
  /** 0.1 迁移来的文件：byProvider 可能含多路由重复计数，不可与 total 对账。 */
  legacy?: boolean
}

export interface UsageStatsFile {
  version: 1
  retentionDays: number
  days: Record<string, DayRollup>
  attribution?: AttributionStats
}

const FILE_VERSION = 1 as const
const DEFAULT_RETENTION_DAYS = 30
const MIN_RETENTION_DAYS = 1
const MAX_RETENTION_DAYS = 3650
const STATS_DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/** 统计文件版本不兼容，禁止写入 / 清空。 */
export class StatsWriteBlockedError extends Error {
  readonly reason = 'unsupported' as const

  constructor() {
    super('usage stats file version is not supported')
    this.name = 'StatsWriteBlockedError'
  }
}

export type ReadOutcomeKind = 'ok' | 'missing' | 'recovered' | 'unsupported'

/** 读盘结果：内存中的文件快照 + 元数据（不隐式覆盖磁盘上的不兼容文件）。 */
export interface ReadOutcome {
  kind: ReadOutcomeKind
  file: UsageStatsFile
  quarantinePath?: string
  foundVersion?: number
}

/** 按路径记录「只读」：未知版本文件在磁盘上保留，直到用户手动处理。 */
const writeBlockedByPath = new Map<string, boolean>()

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

export type TurnAttributionKind = 'exact' | 'mixed' | 'unknown'

/** 去重后的 route 键（`provider/model`）。 */
export function uniqueRouteKeys(usage: TurnTokenUsage): string[] {
  if (usage.routes === undefined || usage.routes.length === 0) return []
  const keys = new Set<string>()
  for (const r of usage.routes) keys.add(`${r.provider}/${r.model}`)
  return [...keys]
}

/**
 * 本 turn 应写入 `byProvider` 的键。
 *
 * 单 route → 精确键；多 route → {@link MIXED_PROVIDER_KEY}（整轮 token 只记一次）；
 * 无 route → {@link UNKNOWN_PROVIDER_KEY}。
 */
export function resolveProviderKey(usage: TurnTokenUsage): string {
  const keys = uniqueRouteKeys(usage)
  if (keys.length === 0) return UNKNOWN_PROVIDER_KEY
  if (keys.length === 1) return keys[0]
  return MIXED_PROVIDER_KEY
}

/** 本 turn 的归因类别（用于 `attribution` 计数）。 */
export function turnAttributionKind(usage: TurnTokenUsage): TurnAttributionKind {
  const keys = uniqueRouteKeys(usage)
  if (keys.length === 0) return 'unknown'
  if (keys.length === 1) return 'exact'
  return 'mixed'
}

function emptyAttribution(): AttributionStats {
  return { totalTurns: 0, exactTurns: 0, mixedTurns: 0, unknownTurns: 0 }
}

/** 0.1 口径：同一 turn 的整轮 token 被记到多个 route 上。 */
export function dayByProviderInflatesTotal(day: DayRollup): boolean {
  let sum = zeroBuckets()
  for (const buckets of Object.values(day.byProvider)) {
    sum = addBuckets(sum, buckets)
  }
  return bucketTotal(sum) > bucketTotal(day.total)
}

function fileHasLegacyInflatedDays(file: UsageStatsFile): boolean {
  for (const day of Object.values(file.days)) {
    if (dayByProviderInflatesTotal(day)) return true
  }
  return false
}

/** 读盘后补全归因元数据（不写回磁盘）。 */
export function normalizeStatsFile(file: UsageStatsFile): UsageStatsFile {
  if (file.attribution?.legacy === true) return file
  if (!fileHasLegacyInflatedDays(file)) return file
  return {
    ...file,
    attribution: {
      ...(file.attribution ?? emptyAttribution()),
      legacy: true,
    },
  }
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

/** 四桶之和：面板上显示的「用量」就是这个数。 */
function bucketTotal(buckets: TokenBuckets): number {
  return buckets.uncachedInputTokens
    + buckets.outputTokens
    + buckets.cacheReadTokens
    + buckets.cacheWriteTokens
}

function isSafeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

/** 校验并夹紧保留天数。 */
export function parseRetentionDays(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_RETENTION_DAYS
  const n = Math.trunc(value)
  if (n < MIN_RETENTION_DAYS) return DEFAULT_RETENTION_DAYS
  if (n > MAX_RETENTION_DAYS) return MAX_RETENTION_DAYS
  return n
}

function sanitizeTokenBuckets(value: unknown): TokenBuckets | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  if (!isSafeCount(record.uncachedInputTokens)) return undefined
  if (!isSafeCount(record.outputTokens)) return undefined
  if (!isSafeCount(record.cacheReadTokens)) return undefined
  if (!isSafeCount(record.cacheWriteTokens)) return undefined
  return {
    uncachedInputTokens: record.uncachedInputTokens,
    outputTokens: record.outputTokens,
    cacheReadTokens: record.cacheReadTokens,
    cacheWriteTokens: record.cacheWriteTokens,
  }
}

/** 校验单日 rollup；非法条目丢弃。 */
export function sanitizeDayRollup(value: unknown): DayRollup | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const total = sanitizeTokenBuckets(record.total)
  if (total === undefined) return undefined
  const byProvider: Record<string, TokenBuckets> = {}
  if (record.byProvider !== null && typeof record.byProvider === 'object') {
    for (const [key, buckets] of Object.entries(record.byProvider as Record<string, unknown>)) {
      const sane = sanitizeTokenBuckets(buckets)
      if (sane !== undefined) byProvider[key] = sane
    }
  }
  const turns = record.turns === undefined ? undefined : (
    isSafeCount(record.turns) ? record.turns : undefined
  )
  return { total, byProvider, turns }
}

/** 校验日键 map，丢弃非法日键与 rollup。 */
export function sanitizeDaysRecord(raw: unknown): Record<string, DayRollup> {
  if (raw === null || typeof raw !== 'object') return {}
  const days: Record<string, DayRollup> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!STATS_DAY_KEY.test(key)) continue
    const rollup = sanitizeDayRollup(value)
    if (rollup !== undefined) days[key] = rollup
  }
  return days
}

function sanitizeAttribution(value: unknown): AttributionStats | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  if (!isSafeCount(record.totalTurns)) return undefined
  if (!isSafeCount(record.exactTurns)) return undefined
  if (!isSafeCount(record.mixedTurns)) return undefined
  if (!isSafeCount(record.unknownTurns)) return undefined
  return {
    totalTurns: record.totalTurns,
    exactTurns: record.exactTurns,
    mixedTurns: record.mixedTurns,
    unknownTurns: record.unknownTurns,
    legacy: record.legacy === true ? true : undefined,
  }
}

function setWriteBlocked(path: string, blocked: boolean): void {
  writeBlockedByPath.set(path, blocked)
}

function assertWritable(path: string): void {
  if (writeBlockedByPath.get(path) === true) {
    throw new StatsWriteBlockedError()
  }
}

async function quarantineCorruptFile(path: string): Promise<string | undefined> {
  const quarantinePath = `${path}.corrupt-${Date.now()}`
  try {
    await rename(path, quarantinePath)
    return quarantinePath
  } catch (error) {
    console.error('[dsh-usage-meters] 无法隔离损坏的统计文件', error)
    return undefined
  }
}

function fileFromParsedRecord(record: Record<string, unknown>): UsageStatsFile {
  return normalizeStatsFile({
    version: FILE_VERSION,
    retentionDays: parseRetentionDays(record.retentionDays),
    days: sanitizeDaysRecord(record.days),
    attribution: sanitizeAttribution(record.attribution),
  })
}

/** 由读盘结果与文件内容生成汇总 warning（优先级：unsupported > corrupt > legacy）。 */
export function summaryWarningFromRead(outcome: ReadOutcome, file: UsageStatsFile): UsageSummaryWarning | undefined {
  if (outcome.kind === 'unsupported') {
    return {
      code: 'unsupported',
      detail: outcome.foundVersion !== undefined ? String(outcome.foundVersion) : undefined,
    }
  }
  if (outcome.kind === 'recovered') return { code: 'corrupt' }
  if (file.attribution?.legacy === true) return { code: 'legacy' }
  return undefined
}

/**
 * 读统计文件并返回明确结果（不静默覆盖不兼容版本）。
 * @param path - 统计文件路径。
 */
export async function readStatsFileOutcome(path: string): Promise<ReadOutcome> {
  try {
    const raw = await readFile(path, 'utf8')
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      const quarantinePath = await quarantineCorruptFile(path)
      setWriteBlocked(path, false)
      return {
        kind: 'recovered',
        file: emptyFile(DEFAULT_RETENTION_DAYS),
        quarantinePath,
      }
    }

    if (parsed === null || typeof parsed !== 'object') {
      const quarantinePath = await quarantineCorruptFile(path)
      setWriteBlocked(path, false)
      return {
        kind: 'recovered',
        file: emptyFile(DEFAULT_RETENTION_DAYS),
        quarantinePath,
      }
    }

    const record = parsed as Record<string, unknown>
    if (record.version !== FILE_VERSION) {
      setWriteBlocked(path, true)
      return {
        kind: 'unsupported',
        file: emptyFile(DEFAULT_RETENTION_DAYS),
        foundVersion: typeof record.version === 'number' ? record.version : undefined,
      }
    }

    if (record.days === null || typeof record.days !== 'object') {
      const quarantinePath = await quarantineCorruptFile(path)
      setWriteBlocked(path, false)
      return {
        kind: 'recovered',
        file: emptyFile(DEFAULT_RETENTION_DAYS),
        quarantinePath,
      }
    }

    const file = fileFromParsedRecord(record)
    setWriteBlocked(path, false)
    return { kind: 'ok', file }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      setWriteBlocked(path, false)
      return { kind: 'missing', file: emptyFile(DEFAULT_RETENTION_DAYS) }
    }
    throw error
  }
}

async function readStatsFile(path: string): Promise<UsageStatsFile> {
  const outcome = await readStatsFileOutcome(path)
  return outcome.file
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
  const retention = parseRetentionDays(file.retentionDays)
  const cutoff = dayKeyOffset(nowMs, -(retention - 1))
  const days = Object.fromEntries(
    Object.entries(file.days).filter(([key]) => key >= cutoff),
  )
  if (Object.keys(days).length === Object.keys(file.days).length) return file
  return { ...file, days }
}

export function mergeTurnIntoFile(
  file: UsageStatsFile,
  dayKey: string,
  usage: TurnTokenUsage,
  nowMs: number,
): UsageStatsFile {
  const inc = bucketsFromTurn(usage)
  const prev = file.days[dayKey]
  const day: DayRollup = prev === undefined
    ? { total: zeroBuckets(), byProvider: {}, turns: 0 }
    : {
      total: { ...prev.total },
      byProvider: { ...prev.byProvider },
      turns: prev.turns ?? 0,
    }

  day.total = addBuckets(day.total, inc)
  const pk = resolveProviderKey(usage)
  const pPrev = day.byProvider[pk] ?? zeroBuckets()
  day.byProvider[pk] = addBuckets(pPrev, inc)
  day.turns = (day.turns ?? 0) + 1

  const kind = turnAttributionKind(usage)
  const base = file.attribution ?? emptyAttribution()
  const attribution: AttributionStats = {
    ...base,
    totalTurns: base.totalTurns + 1,
    exactTurns: base.exactTurns + (kind === 'exact' ? 1 : 0),
    mixedTurns: base.mixedTurns + (kind === 'mixed' ? 1 : 0),
    unknownTurns: base.unknownTurns + (kind === 'unknown' ? 1 : 0),
  }

  return pruneDays({
    ...file,
    attribution,
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

async function backupStatsFile(path: string): Promise<void> {
  try {
    await copyFile(path, `${path}.bak`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[dsh-usage-meters] 备份统计文件失败', error)
    }
  }
}

async function writeStatsAtomic(path: string, file: UsageStatsFile): Promise<void> {
  assertWritable(path)
  await mkdir(dirname(path), { recursive: true })
  const payload = `${JSON.stringify(file, null, 2)}\n`
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await writeFile(tmp, payload, 'utf8')
      await rename(tmp, path)
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => { setTimeout(resolve, 40 * (attempt + 1)) })
    }
  }
  throw lastError
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
   * 每个 provider/model 的逐日序列。
   *
   * **数据本来就在盘上**：`DayRollup.byProvider` 每天每模型都存了四桶，
   * 这里只是把它按天摊开——不迁数据、不改文件格式。
   *
   * 缺记录的日子补零，与全局日序列同一套规矩：
   * 那天这个模型没用，就是零，不是「没有记录」。
   */
  const dailyByProvider = new Map<string, UsageProviderDaily>()
  for (let offset = WINDOWS.d30 - 1; offset >= 0; offset--) {
    const dayKey = dayKeyOffset(nowMs, -offset)
    const day = file.days[dayKey]
    // 先登记当天出现过的模型（哪怕当天是零，也要占住这个位置）。
    for (const key of Object.keys(day?.byProvider ?? {})) {
      if (dailyByProvider.has(key)) continue
      const { provider, model } = splitProviderKey(key)
      dailyByProvider.set(key, { provider, model, daily: [] })
    }
  }
  for (const [key, entry] of dailyByProvider) {
    for (let offset = WINDOWS.d30 - 1; offset >= 0; offset--) {
      const dayKey = dayKeyOffset(nowMs, -offset)
      const buckets = file.days[dayKey]?.byProvider[key] ?? zeroBuckets()
      entry.daily.push({ day: dayKey, ...buckets })
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
    /**
     * 按四桶总和降序。
     *
     * 排序键必须和面板显示的「用量」是同一个数：Top 屏里每行显示的是四桶之和，
     * 头部占比环算的也是四桶之和。以前这里按 `未缓存输入 + 输出` 排，
     * 排序依据和显示值不是一回事——缓存命中极高的模型会被排到后面，
     * 环里算出来的却不是它。口径统一到四桶，排序和显示才对得上。
     */
    byProvider: [...byProvider.values()].sort((a, b) => bucketTotal(b) - bucketTotal(a)),
    daily,
    /**
     * 逐模型的日序列，顺序与 `byProvider` 一致（同一个模型就在同一位置）。
     *
     * 先按 `byProvider` 的名次排，再把日序列挂上去——
     * 两份列表必须能对上号，否则「排行第 2 的模型」和「日序列第 2 条」会错位。
     */
    dailyByProvider: [...byProvider.keys()]
      .sort((a, b) => bucketTotal(byProvider.get(b) ?? zeroBuckets()) - bucketTotal(byProvider.get(a) ?? zeroBuckets()))
      .map((key) => dailyByProvider.get(key))
      .filter((entry): entry is UsageProviderDaily => entry !== undefined),
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
  const outcome = await readStatsFileOutcome(path)
  const summary = summarize(outcome.file, nowMs)
  const warning = summaryWarningFromRead(outcome, outcome.file)
  return warning === undefined ? summary : { ...summary, warning }
}

/**
 * 清空统计：保留保留天数，清掉所有日键。
 * @param path - 统计文件路径。
 * @returns 清空后的统计文件。
 */
export function clearUsage(path: string = defaultStatsPath()): Promise<UsageStatsFile> {
  return enqueue(async () => {
    assertWritable(path)
    const outcome = await readStatsFileOutcome(path)
    await backupStatsFile(path)
    const cleared: UsageStatsFile = {
      ...outcome.file,
      days: {},
      attribution: undefined,
    }
    await writeStatsAtomic(path, cleared)
    setWriteBlocked(path, false)
    return cleared
  })
}
