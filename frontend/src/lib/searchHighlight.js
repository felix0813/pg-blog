function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function searchTerms(query) {
  return [...new Set(query.trim().split(/\s+/).filter(Boolean))].sort((a, b) => b.length - a.length)
}

export function highlightParts(text = '', query = '') {
  const terms = searchTerms(query)
  if (!text || terms.length === 0) return [{ text, match: false }]
  const matcher = new RegExp(`(${terms.map(escapeRegex).join('|')})`, 'gi')
  return text.split(matcher).filter((part) => part !== '').map((part) => ({
    text: part,
    match: terms.some((term) => term.toLocaleLowerCase() === part.toLocaleLowerCase()),
  }))
}

export function containsSearchTerm(text = '', query = '') {
  const lowerText = text.toLocaleLowerCase()
  return searchTerms(query).some((term) => lowerText.includes(term.toLocaleLowerCase()))
}
