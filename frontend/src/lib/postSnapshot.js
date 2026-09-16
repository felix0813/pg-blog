export function postSnapshot(meta, content) {
  return JSON.stringify({
    title: meta.title,
    slug: meta.slug,
    summary: meta.summary,
    status: meta.status,
    category_id: meta.category_id ? Number(meta.category_id) : null,
    series_id: meta.series_id ? Number(meta.series_id) : null,
    series_position: Number(meta.series_position) || 0,
    tag_ids: meta.tag_ids.map(Number).sort((a, b) => a - b),
    content,
  })
}
