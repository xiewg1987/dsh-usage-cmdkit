import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  StatsWriteBlockedError,
  clearUsage,
  mergeTurnIntoFile,
  parseRetentionDays,
  readStatsFileOutcome,
  readUsageSummary,
} from '../src/usage-store.js'

describe('parseRetentionDays', () => {
  it('clamps invalid values to default 30', () => {
    assert.equal(parseRetentionDays(Number.NaN), 30)
    assert.equal(parseRetentionDays(-1), 30)
    assert.equal(parseRetentionDays(1e12), 3650)
  })
})

describe('readStatsFileOutcome', () => {
  it('quarantines corrupt JSON and allows write', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'usage-stats-'))
    const path = join(dir, 'usage-stats.json')
    await writeFile(path, '{ not json', 'utf8')

    const outcome = await readStatsFileOutcome(path)
    assert.equal(outcome.kind, 'recovered')
    const names = await readdir(dir)
    assert.ok(names.some((name) => name.includes('.corrupt-')))

    const file = mergeTurnIntoFile(outcome.file, '2026-10-22', {
      uncachedInputTokens: 1,
      outputTokens: 0,
      routes: [{ provider: 'a', model: 'x' }],
    }, Date.parse('2026-10-22T12:00:00'))
    await writeFile(path, `${JSON.stringify(file, null, 2)}\n`, 'utf8')
    const reread = await readStatsFileOutcome(path)
    assert.equal(reread.kind, 'ok')
  })

  it('blocks writes for unsupported version', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'usage-stats-'))
    const path = join(dir, 'usage-stats.json')
    await writeFile(path, `${JSON.stringify({ version: 99, retentionDays: 30, days: {} }, null, 2)}\n`, 'utf8')

    const outcome = await readStatsFileOutcome(path)
    assert.equal(outcome.kind, 'unsupported')
    const summary = await readUsageSummary(path)
    assert.equal(summary.warning?.code, 'unsupported')

    await assert.rejects(() => clearUsage(path), StatsWriteBlockedError)
    const raw = await readFile(path, 'utf8')
    assert.match(raw, /"version": 99/)
  })

  it('creates backup on clear', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'usage-stats-'))
    const path = join(dir, 'usage-stats.json')
    let file = mergeTurnIntoFile(
      { version: 1, retentionDays: 30, days: {} },
      '2026-10-22',
      { uncachedInputTokens: 3, outputTokens: 0, routes: [{ provider: 'a', model: 'x' }] },
      Date.parse('2026-10-22T12:00:00'),
    )
    await writeFile(path, `${JSON.stringify(file, null, 2)}\n`, 'utf8')

    await clearUsage(path)
    const backup = await readFile(`${path}.bak`, 'utf8')
    assert.match(backup, /"uncachedInputTokens": 3/)
    const after = await readStatsFileOutcome(path)
    assert.equal(Object.keys(after.file.days).length, 0)
  })
})
