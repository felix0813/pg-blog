import assert from 'node:assert/strict'
import test from 'node:test'
import { postSnapshot } from './postSnapshot.js'

const meta = { title: 'Title', slug: 'title', summary: '', status: 'draft', category_id: '', tag_ids: [2, 1] }
const doc = { type: 'doc', content: [{ type: 'paragraph' }] }

test('equivalent form values and reordered tags are not dirty', () => {
  assert.equal(postSnapshot(meta, doc), postSnapshot({ ...meta, category_id: null, tag_ids: ['1', '2'] }, doc))
})

test('detects changes to every article field and the body', () => {
  for (const patch of [{ title: 'Other' }, { slug: 'other' }, { summary: 'Summary' }, { status: 'published' }, { category_id: 3 }, { series_id: 4 }, { series_position: 2 }, { tag_ids: [1] }]) {
    assert.notEqual(postSnapshot(meta, doc), postSnapshot({ ...meta, ...patch }, doc))
  }
  assert.notEqual(postSnapshot(meta, doc), postSnapshot(meta, { ...doc, content: [] }))
})

test('restoring the original content restores the clean snapshot', () => {
  const original = postSnapshot(meta, doc)
  assert.notEqual(postSnapshot({ ...meta, title: 'Edited' }, doc), original)
  assert.equal(postSnapshot({ ...meta }, doc), original)
})
