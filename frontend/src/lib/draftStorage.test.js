import assert from 'node:assert/strict'
import test from 'node:test'
import { draftKey } from './draftStorage.js'

test('isolates drafts by user and article', () => {
  assert.equal(draftKey(7, 'new'), '7:new')
  assert.notEqual(draftKey(7, 12), draftKey(8, 12))
  assert.notEqual(draftKey(7, 12), draftKey(7, 13))
})
