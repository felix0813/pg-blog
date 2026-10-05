import MarkdownIt from 'markdown-it'

const markdownParser = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
})

function escapeYAML(value = '') {
  return JSON.stringify(String(value))
}

function renderInline(content = []) {
  return content.map((node) => {
    if (node.type === 'hardBreak') return '  \n'
    if (node.type === 'image') {
      const title = node.attrs?.title ? ` ${JSON.stringify(node.attrs.title)}` : ''
      return `![${node.attrs?.alt || ''}](${node.attrs?.src || ''}${title})`
    }
    let text = node.text || ''
    for (const mark of node.marks || []) {
      if (mark.type === 'bold') text = `**${text}**`
      if (mark.type === 'italic') text = `*${text}*`
      if (mark.type === 'strike') text = `~~${text}~~`
      if (mark.type === 'code') text = `\`${text}\``
      if (mark.type === 'link') text = `[${text}](${mark.attrs.href})`
    }
    return text
  }).join('')
}

function renderNode(node, depth = 0) {
  const content = node.content || []
  switch (node.type) {
    case 'paragraph': return `${renderInline(content)}\n\n`
    case 'heading': return `${'#'.repeat(node.attrs?.level || 1)} ${renderInline(content)}\n\n`
    case 'blockquote': return content.map((item) => renderNode(item).trimEnd().split('\n').map((line) => `> ${line}`).join('\n')).join('\n') + '\n\n'
    case 'bulletList': return content.map((item) => `${'  '.repeat(depth)}- ${renderInline(item.content?.[0]?.content || [])}\n`).join('') + '\n'
    case 'orderedList': return content.map((item, index) => `${'  '.repeat(depth)}${index + 1}. ${renderInline(item.content?.[0]?.content || [])}\n`).join('') + '\n'
    case 'codeBlock': return `\`\`\`${node.attrs?.language || ''}\n${renderInline(content)}\n\`\`\`\n\n`
    case 'table': {
      const rows = content.map((row) => (row.content || []).map((cell) => {
        const value = (cell.content || []).map((item) => renderInline(item.content || [])).join('<br>')
        return value.replace(/\|/g, '\\|')
      }))
      if (!rows.length) return ''
      const width = Math.max(...rows.map((row) => row.length))
      const formatRow = (row) => `| ${Array.from({ length: width }, (_, index) => row[index] || '').join(' | ')} |\n`
      return formatRow(rows[0]) + formatRow(Array(width).fill('---')) + rows.slice(1).map(formatRow).join('') + '\n'
    }
    default: return content.map((item) => renderNode(item, depth)).join('')
  }
}

export function postToMarkdown(post) {
  const tags = (post.tags || []).map((tag) => tag.name).join(', ')
  const series = post.series?.slug || ''
  const frontmatter = [
    '---',
    `title: ${escapeYAML(post.title)}`,
    `slug: ${escapeYAML(post.slug)}`,
    `summary: ${escapeYAML(post.summary)}`,
    `status: ${escapeYAML(post.status || 'draft')}`,
    `tags: ${escapeYAML(tags)}`,
    `series: ${escapeYAML(series)}`,
    `series_position: ${Number(post.series_position) || 0}`,
    '---',
    '',
  ].join('\n')
  return frontmatter + renderNode(post.content_json || { type: 'doc', content: [] }).trimEnd() + '\n'
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) return [{}, markdown]
  const end = markdown.indexOf('\n---\n', 4)
  if (end < 0) return [{}, markdown]
  const values = {}
  markdown.slice(4, end).split('\n').forEach((line) => {
    const separator = line.indexOf(':')
    if (separator < 0) return
    const key = line.slice(0, separator).trim()
    const raw = line.slice(separator + 1).trim()
    try { values[key] = JSON.parse(raw) } catch { values[key] = raw.replace(/^"|"$/g, '') }
  })
  return [values, markdown.slice(end + 5)]
}

export function markdownToPost(markdown) {
  const [frontmatter, body] = parseFrontmatter(markdown.replace(/\r\n/g, '\n'))
  return { frontmatter, content: markdownParser.render(body) }
}
