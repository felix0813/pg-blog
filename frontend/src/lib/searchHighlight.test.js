import assert from 'node:assert/strict'
import test from 'node:test'
import { containsSearchTerm, highlightParts, searchTerms } from './searchHighlight.js'

test('extracts unique search terms in longest-first order', () => {
  assert.deepEqual(searchTerms('map hashmap map'), ['hashmap', 'map'])
})

test('highlights case-insensitive and Chinese matches without HTML injection', () => {
  assert.deepEqual(highlightParts('HashMap 与数据结构', 'hashmap 数据'), [
    { text: 'HashMap', match: true },
    { text: ' 与', match: false },
    { text: '数据', match: true },
    { text: '结构', match: false },
  ])
  assert.equal(containsSearchTerm('<script>', 'script'), true)
})
