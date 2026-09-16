import assert from 'node:assert/strict'
import test from 'node:test'
import { createHeadingId } from './articleOutline.js'

test('creates readable and stable heading anchors', () => {
  const usedIds = new Set()
  assert.equal(createHeadingId('Getting Started', usedIds), 'getting-started')
  assert.equal(createHeadingId('数据结构与算法', usedIds), '数据结构与算法')
})

test('makes duplicate and empty heading anchors unique', () => {
  const usedIds = new Set()
  assert.equal(createHeadingId('Overview', usedIds), 'overview')
  assert.equal(createHeadingId('Overview', usedIds), 'overview-2')
  assert.equal(createHeadingId('!!!', usedIds), 'section')
  assert.equal(createHeadingId('???', usedIds), 'section-2')
})
