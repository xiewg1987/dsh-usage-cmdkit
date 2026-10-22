import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { TurnTokenUsage } from '@deepseek-ai/dsh-token-meter/client'
import { MIXED_PROVIDER_KEY, UNKNOWN_PROVIDER_KEY } from '../src/protocol.js'
import {
  dayByProviderInflatesTotal,
  mergeTurnIntoFile,
  normalizeStatsFile,
  resolveProviderKey,
  summarize,
  turnAttributionKind,
  uniqueRouteKeys,
  type UsageStatsFile,
} from '../src/usage-store.js'

const NOW = Date.parse('2026-10-22T12:00:00')

function turn(partial: Partial<TurnTokenUsage> & Pick<TurnTokenUsage, 'uncachedInputTokens' | 'outputTokens'>): TurnTokenUsage {
  return {
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    ...partial,
  }
}

function bucketTotal(b: { uncachedInputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }): number {
  return b.uncachedInputTokens + b.outputTokens + b.cacheReadTokens + b.cacheWriteTokens
}

function sumByProvider(day: UsageStatsFile['days'][string]): number {
  let sum = 0
  for (const b of Object.values(day.byProvider)) {
    sum += bucketTotal(b)
  }
  return sum
}

describe('resolveProviderKey', () => {
  it('empty routes → unknown', () => {
    assert.equal(resolveProviderKey(turn({ uncachedInputTokens: 1, outputTokens: 0 })), UNKNOWN_PROVIDER_KEY)
  })

  it('single route → provider/model', () => {
    assert.equal(
      resolveProviderKey(turn({
        uncachedInputTokens: 10,
        outputTokens: 10,
        routes: [{ provider: 'a', model: 'x' }],
      })),
      'a/x',
    )
  })

  it('duplicate routes dedupe to one exact key', () => {
    assert.deepEqual(
      uniqueRouteKeys(turn({
        uncachedInputTokens: 1,
        outputTokens: 0,
        routes: [
          { provider: 'a', model: 'x' },
          { provider: 'a', model: 'x' },
        ],
      })),
      ['a/x'],
    )
    assert.equal(turnAttributionKind(turn({
      uncachedInputTokens: 1,
      outputTokens: 0,
      routes: [
        { provider: 'a', model: 'x' },
        { provider: 'a', model: 'x' },
      ],
    })), 'exact')
  })

  it('multiple routes → __mixed__', () => {
    assert.equal(
      resolveProviderKey(turn({
        uncachedInputTokens: 10,
        outputTokens: 10,
        routes: [
          { provider: 'a', model: 'x' },
          { provider: 'b', model: 'y' },
        ],
      })),
      MIXED_PROVIDER_KEY,
    )
  })
})

describe('mergeTurnIntoFile', () => {
  const empty: UsageStatsFile = { version: 1, retentionDays: 30, days: {} }
  const dayKey = '2026-10-22'

  it('single route: sum(byProvider) === total', () => {
    const file = mergeTurnIntoFile(empty, dayKey, turn({
      uncachedInputTokens: 5,
      outputTokens: 5,
      routes: [{ provider: 'p', model: 'm' }],
    }), NOW)
    const day = file.days[dayKey]
    assert.ok(day)
    assert.equal(bucketTotal(day.total), 10)
    assert.equal(sumByProvider(day), 10)
    assert.equal(file.attribution?.exactTurns, 1)
    assert.equal(file.attribution?.mixedTurns, 0)
  })

  it('multi route: one __mixed__ bucket, sum === total', () => {
    const file = mergeTurnIntoFile(empty, dayKey, turn({
      uncachedInputTokens: 10,
      outputTokens: 10,
      routes: [
        { provider: 'a', model: 'x' },
        { provider: 'b', model: 'y' },
      ],
    }), NOW)
    const day = file.days[dayKey]
    assert.ok(day)
    assert.equal(bucketTotal(day.total), 20)
    assert.equal(sumByProvider(day), 20)
    assert.equal(day.byProvider[MIXED_PROVIDER_KEY]?.uncachedInputTokens, 10)
    assert.equal(Object.keys(day.byProvider).length, 1)
    assert.equal(file.attribution?.mixedTurns, 1)
  })

  it('summarize: d30 total matches sum(byProvider) for new data', () => {
    let file = empty
    file = mergeTurnIntoFile(file, dayKey, turn({
      uncachedInputTokens: 3,
      outputTokens: 7,
      routes: [{ provider: 'a', model: 'x' }],
    }), NOW)
    const summary = summarize(file, NOW)
    const providerSum = summary.byProvider.reduce(
      (acc, p) => acc + bucketTotal(p),
      0,
    )
    const d30Total = bucketTotal(summary.d30)
    assert.equal(providerSum, d30Total)
  })
})

describe('normalizeStatsFile legacy', () => {
  it('flags inflated byProvider from 0.1 semantics', () => {
    const legacy: UsageStatsFile = {
      version: 1,
      retentionDays: 30,
      days: {
        '2026-10-22': {
          total: { uncachedInputTokens: 10, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 },
          byProvider: {
            'a/x': { uncachedInputTokens: 10, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 },
            'b/y': { uncachedInputTokens: 10, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 },
          },
        },
      },
    }
    assert.equal(dayByProviderInflatesTotal(legacy.days['2026-10-22']), true)
    const normalized = normalizeStatsFile(legacy)
    assert.equal(normalized.attribution?.legacy, true)
  })
})
