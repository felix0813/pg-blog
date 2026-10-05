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
  assert.match(result.content, /<h2>Start<\/h2>/)
  assert.match(result.content, /<code class="language-mermaid">/)
})

test('imports GFM tables and inline formatting', () => {
  const result = markdownToPost('**Bold** and `code`\n\n| Name | Value |\n| --- | --- |\n| val | immutable |\n')
  assert.match(result.content, /<strong>Bold<\/strong>/)
  assert.match(result.content, /<code>code<\/code>/)
  assert.match(result.content, /<table>/)
  assert.match(result.content, /<th>Name<\/th>/)
  assert.match(result.content, /<td>immutable<\/td>/)
})

test('imports Markdown images without enabling raw HTML', () => {
  const result = markdownToPost('![diagram](https://example.com/diagram.png "Architecture")\n\n<img src="https://example.com/raw.png">')
  assert.match(result.content, /<img src="https:\/\/example.com\/diagram.png" alt="diagram" title="Architecture">/)
  assert.match(result.content, /&lt;img src=/)
  assert.doesNotMatch(result.content, /<img src="https:\/\/example.com\/raw\.png">/)
})
