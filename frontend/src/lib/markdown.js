function escapeYAML(value = '') {
  return JSON.stringify(String(value))
}

function renderInline(content = []) {
  return content.map((node) => {
    if (node.type === 'hardBreak') return '  \n'
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
  const lines = body.split('\n')
  const content = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) { index += 1; continue }
    const fence = line.match(/^```(.*)$/)
    if (fence) {
      const code = []
      index += 1
      while (index < lines.length && !lines[index].startsWith('```')) code.push(lines[index++])
      if (index < lines.length) index += 1
      content.push({ type: 'codeBlock', attrs: { language: fence[1].trim() || 'text' }, content: code.length ? [{ type: 'text', text: code.join('\n') }] : [] })
      continue
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) { content.push({ type: 'heading', attrs: { level: heading[1].length }, content: [{ type: 'text', text: heading[2] }] }); index += 1; continue }
    const quote = line.match(/^>\s?(.*)$/)
    if (quote) { content.push({ type: 'blockquote', content: [{ type: 'paragraph', content: quote[1] ? [{ type: 'text', text: quote[1] }] : [] }] }); index += 1; continue }
    const bullet = line.match(/^[-*]\s+(.+)$/)
    if (bullet) { content.push({ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: bullet[1] }] }] }] }); index += 1; continue }
    const ordered = line.match(/^\d+\.\s+(.+)$/)
    if (ordered) { content.push({ type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: ordered[1] }] }] }] }); index += 1; continue }
    const paragraph = [line]
    index += 1
    while (index < lines.length && lines[index].trim() && !/^```|^(#{1,3})\s|^>\s|^[-*]\s|^\d+\.\s/.test(lines[index])) paragraph.push(lines[index++])
    content.push({ type: 'paragraph', content: [{ type: 'text', text: paragraph.join('\n') }] })
  }
  return { frontmatter, content: { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] } }
}
