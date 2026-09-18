import assert from 'node:assert/strict'
import test from 'node:test'
import { markdownToPost, postToMarkdown } from './markdown.js'

test('exports frontmatter and Mermaid code blocks', () => {
  const markdown = postToMarkdown({ title: 'Flow', slug: 'flow', summary: '', status: 'published', tags: [{ name: 'diagram' }], content_json: { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Start' }] }, { type: 'codeBlock', attrs: { language: 'mermaid' }, content: [{ type: 'text', text: 'flowchart LR\nA-->B' }] }] } })
  assert.match(markdown, /title: "Flow"/)
  assert.match(markdown, /```mermaid/)
})

test('imports headings and Mermaid code blocks', () => {
  const result = markdownToPost('---\ntitle: "Flow"\n---\n\n## Start\n\n```mermaid\nflowchart LR\nA-->B\n```\n')
  assert.equal(result.frontmatter.title, 'Flow')
  assert.equal(result.content.content[0].type, 'heading')
  assert.equal(result.content.content[1].attrs.language, 'mermaid')
})
