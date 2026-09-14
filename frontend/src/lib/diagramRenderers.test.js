import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_DIAGRAM_SOURCE_LENGTH,
  normalizeDiagramLanguage,
  registerDiagramRenderer,
  renderDiagram,
  supportsDiagramLanguage,
  validateDiagramSource,
} from './diagramRenderers.js'

test('normalizes and recognizes diagram languages', () => {
  assert.equal(normalizeDiagramLanguage(' Mermaid '), 'mermaid')
  assert.equal(supportsDiagramLanguage('MERMAID'), true)
  assert.equal(supportsDiagramLanguage('javascript'), false)
})

test('rejects empty and oversized diagram sources', () => {
  assert.throws(() => validateDiagramSource('  '), /不能为空/)
  assert.throws(
    () => validateDiagramSource('x'.repeat(MAX_DIAGRAM_SOURCE_LENGTH + 1)),
    /不能超过/,
  )
})

test('dispatches registered renderers without executing arbitrary languages', async () => {
  registerDiagramRenderer('test-diagram', async ({ source }) => `<svg>${source}</svg>`)
  assert.equal(
    await renderDiagram({ language: 'TEST-DIAGRAM', source: 'safe', id: 'test', theme: 'light' }),
    '<svg>safe</svg>',
  )
  assert.throws(
    () => renderDiagram({ language: 'javascript', source: 'alert(1)', id: 'test', theme: 'light' }),
    /暂不支持/,
  )
})
