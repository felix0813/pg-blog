export function postSnapshot(meta, content) {
  return JSON.stringify({
    title: meta.title,
    slug: meta.slug,
    summary: meta.summary,
    status: meta.status,
    category_id: meta.category_id ? Number(meta.category_id) : null,
    tag_ids: meta.tag_ids.map(Number).sort((a, b) => a - b),
    content,
  })
}
