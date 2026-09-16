import assert from 'node:assert/strict'
import test from 'node:test'
import { postFiltersFromSearch, postFiltersToSearch } from './postFilters.js'

test('reads supported filters from a shared article-list URL', () => {
  assert.deepEqual(
    postFiltersFromSearch(new URLSearchParams('tag=algorithm&category=backend&status=published&page=2')),
    { tag: 'algorithm', category: 'backend', status: 'published', page: 2 },
  )
})

test('uses page one for invalid page values', () => {
  assert.equal(postFiltersFromSearch(new URLSearchParams('page=0')).page, 1)
  assert.equal(postFiltersFromSearch(new URLSearchParams('page=not-a-number')).page, 1)
})

test('does not add empty values or the default page to article-list URLs', () => {
  assert.equal(
    postFiltersToSearch({ tag: 'algorithm', category: '', status: '', page: 1 }).toString(),
    'tag=algorithm',
  )
})
