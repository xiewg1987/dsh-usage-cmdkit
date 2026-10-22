import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bucketTotal, providersInWindow, windowSlice } from '../src/client/data/usage-metrics.js'
import type { UsageDailyPoint, UsageProviderDaily } from '../src/protocol.js'
import { mergeTurnIntoFile, summarize, type UsageStatsFile } from '../src/usage-store.js'

const NOW = Date.parse('2026-10-22T12:00:00')

describe('windowSlice', () => {
  const daily: UsageDailyPoint[] = [
    { day: '2026-10-20', uncachedInputTokens: 1, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    { day: '2026-10-21', uncachedInputTokens: 2, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    { day: '2026-10-22', uncachedInputTokens: 4, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  ]

  it('returns last N days in order', () => {
    assert.deepEqual(windowSlice(daily, 2).map((p) => p.day), ['2026-10-21', '2026-10-22'])
  })
})

describe('providersInWindow', () => {
  it('matches Host byProvider for 30-day window', () => {
    const empty: UsageStatsFile = { version: 1, retentionDays: 30, days: {} }
    let file = mergeTurnIntoFile(empty, '2026-10-22', {
      uncachedInputTokens: 10,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      routes: [{ provider: 'a', model: 'x' }],
    }, NOW)
    file = mergeTurnIntoFile(file, '2026-10-21', {
      uncachedInputTokens: 5,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      routes: [{ provider: 'b', model: 'y' }],
    }, NOW)
    const summary = summarize(file, NOW)
    const fromWindow = providersInWindow(summary.dailyByProvider, 30)
    assert.equal(fromWindow.length, summary.byProvider.length)
    for (let i = 0; i < fromWindow.length; i += 1) {
      assert.equal(fromWindow[i].provider, summary.byProvider[i].provider)
      assert.equal(fromWindow[i].model, summary.byProvider[i].model)
      assert.equal(bucketTotal(fromWindow[i]), bucketTotal(summary.byProvider[i]))
    }
  })

  it('today window only includes models with usage today', () => {
    const dailyByProvider: UsageProviderDaily[] = [
      {
        provider: 'a',
        model: 'x',
        daily: [
          { day: '2026-10-21', uncachedInputTokens: 100, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
          { day: '2026-10-22', uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        ],
      },
      {
        provider: 'b',
        model: 'y',
        daily: [
          { day: '2026-10-21', uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
          { day: '2026-10-22', uncachedInputTokens: 40, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        ],
      },
    ]
    const today = providersInWindow(dailyByProvider, 1)
    assert.equal(today.length, 1)
    assert.equal(today[0].provider, 'b')
    assert.equal(bucketTotal(today[0]), 40)
  })
})
