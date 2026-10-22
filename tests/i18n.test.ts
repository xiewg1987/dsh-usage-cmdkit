import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { en, zh } from '../src/client/i18n/locales.js'

describe('i18n key parity', () => {
  it('en has the same keys as zh', () => {
    const zhKeys = Object.keys(zh).sort()
    const enKeys = Object.keys(en).sort()
    assert.deepEqual(enKeys, zhKeys)
  })
})
