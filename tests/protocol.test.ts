import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isUsageSummary, type UsageSummary } from '../src/protocol.js'

const base: UsageSummary = {
  today: { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  d7: { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  d30: { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  byProvider: [],
  daily: [],
  dailyByProvider: [],
  generatedAt: 1,
}

describe('isUsageSummary', () => {
  it('accepts optional warning', () => {
    assert.equal(isUsageSummary({ ...base, warning: { code: 'legacy' } }), true)
    assert.equal(isUsageSummary({ ...base, warning: { code: 'unsupported', detail: '99' } }), true)
    assert.equal(isUsageSummary({ ...base, warning: { code: 'nope' } }), false)
  })
})
