import assert from 'node:assert/strict'
import test from 'node:test'
import { insertMermaidBlock, continueWritingAfterCode } from './editorBlocks.js'

function mockEditor() {
  const calls = []
  const chain = {
    focus() { return this },
    insertContentAt(...args) { calls.push(['insert', ...args]); return this },
    setTextSelection(position) { calls.push(['selection', position]); return this },
    run() { return true },
  }
  return {
    calls,
    state: { selection: { from: 5, to: 12, $from: { after: () => 30 } } },
    chain: () => chain,
    isActive: () => true,
  }
}

test('inserts an independent Mermaid block without replacing selected prose', () => {
  const editor = mockEditor()
  insertMermaidBlock(editor)
  const [, position, content] = editor.calls[0]
  assert.equal(position, 12)
  assert.equal(content[0].type, 'codeBlock')
  assert.equal(content[0].attrs.language, 'mermaid')
  assert.equal(content[1].type, 'paragraph')
})

test('continues in a paragraph after the current code block', () => {
  const editor = mockEditor()
  continueWritingAfterCode(editor)
  assert.deepEqual(editor.calls, [
    ['insert', 30, { type: 'paragraph' }],
    ['selection', 31],
  ])
})
