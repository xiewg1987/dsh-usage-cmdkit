import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { TurnTokenUsage } from '@deepseek-ai/dsh-token-meter/client'

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

/** profile 目录下的默认路径；联调时 harness 会注入 DSH_PROFILE_DIR */
export function defaultStatsPath(): string {
  const profileDir = process.env.DSH_PROFILE_DIR
  if (profileDir !== undefined && profileDir !== '') {
    return join(profileDir, 'usage-stats.json')
  }
  const home = process.env.DSH_HOME
  if (home !== undefined && home !== '') {
    return join(home, 'profiles', 'web', 'usage-stats.json')
  }
  return join(process.cwd(), 'usage-stats.json')
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

/** 删除早于 retentionDays 的日键（按字符串排序即日历序） */
export function pruneDays(file: UsageStatsFile): UsageStatsFile {
  const keys = Object.keys(file.days).sort()
  if (keys.length <= file.retentionDays) return file
  const drop = new Set(keys.slice(0, keys.length - file.retentionDays))
  const days = Object.fromEntries(
    Object.entries(file.days).filter(([k]) => !drop.has(k)),
  )
  return { ...file, days }
}

function mergeTurnIntoFile(
  file: UsageStatsFile,
  dayKey: string,
  usage: TurnTokenUsage,
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
  })
}

/** 串行写盘，避免并发 turn 互相覆盖 */
let writeChain: Promise<void> = Promise.resolve()

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
  const dayKey = dayKeyFromMs(turnEndTimeMs)
  const run = async () => {
    const current = await readStatsFile(path)
    const file = mergeTurnIntoFile(current, dayKey, usage)
    await writeStatsAtomic(path, file)
    return { path, file, dayKey }
  }
  const result = writeChain.then(run)
  writeChain = result.then(() => {}, () => {})
  return result
}
