export function postFiltersFromSearch(searchParams) {
  const page = Number.parseInt(searchParams.get('page') || '1', 10)
  return {
    category: searchParams.get('category') || '',
    tag: searchParams.get('tag') || '',
    status: searchParams.get('status') || '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

export function postFiltersToSearch(filters) {
  const searchParams = new URLSearchParams()
  if (filters.category) searchParams.set('category', filters.category)
  if (filters.tag) searchParams.set('tag', filters.tag)
  if (filters.status) searchParams.set('status', filters.status)
  if (filters.page > 1) searchParams.set('page', String(filters.page))
  return searchParams
}
