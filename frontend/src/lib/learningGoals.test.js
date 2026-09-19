import assert from 'node:assert/strict'
import test from 'node:test'
import { learningGoalMap } from './learningGoals.js'

test('maps user-isolated learning goal timestamps by post id', () => {
  assert.deepEqual(learningGoalMap([{ post_id: 8, last_learned_at: null }, { post_id: 9, last_learned_at: '2026-09-19T08:00:00Z' }]), {
    8: null,
    9: '2026-09-19T08:00:00Z',
  })
})
