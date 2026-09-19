import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon } from 'lucide-react'
import { get } from '../lib/api.js'
import { HighlightedText } from '../components/HighlightedText.jsx'
import { containsSearchTerm } from '../lib/searchHighlight.js'
import { LearningStatus } from '../components/LearningStatus.jsx'
import { learningGoalMap } from '../lib/learningGoals.js'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''
  const [input, setInput] = React.useState(query)
  const [items, setItems] = React.useState([])
  const [nextCursor, setNextCursor] = React.useState('')
  const [cursor, setCursor] = React.useState('')
  const [cursorHistory, setCursorHistory] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [learningGoals, setLearningGoals] = React.useState({})

  React.useEffect(() => setInput(query), [query])

  React.useEffect(() => { get("/api/learning-goals").then((data) => setLearningGoals(learningGoalMap(data.items))).catch(() => setLearningGoals({})) }, [])

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = input.trim()
      if (value !== query) {
        setCursor('')
        setCursorHistory([])
        setParams(value ? { q: value } : {})
      }
    }, 280)
    return () => window.clearTimeout(timer)
  }, [input, query, setParams])

  React.useEffect(() => {
    if ([...query.trim()].length < 2) {
      setItems([])
      setNextCursor('')
      return
    }
    const controller = new AbortController()
    const request = new URLSearchParams({ q: query, page_size: '10' })
    if (cursor) request.set('cursor', cursor)
    setLoading(true)
    setError('')
    get(`/api/search?${request}`, { signal: controller.signal })
      .then((data) => {
        setItems(data.items || [])
        setNextCursor(data.next_cursor || '')
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [query, cursor])

  function nextPage() {
    setCursorHistory([...cursorHistory, cursor])
    setCursor(nextCursor)
  }

  function previousPage() {
    const history = [...cursorHistory]
    setCursor(history.pop() || '')
    setCursorHistory(history)
  }

  function resultExcerpt(item) {
    if (containsSearchTerm(item.summary, query)) return item.summary
    return item.snippet || item.summary || "\u6ca1\u6709\u6458\u8981"
  }

  return (
    <section className="searchPage">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Search</p>
          <h1>搜索文章</h1>
        </div>
      </div>
      <label className="searchBox">
        <SearchIcon size={20} />
        <input autoFocus value={input} onChange={(event) => setInput(event.target.value)} placeholder="搜索标题、摘要、正文、分类或标签" />
        <kbd>Ctrl K</kbd>
      </label>
      {[...query.trim()].length < 2 && <p className="muted searchHint">请输入至少两个字符。</p>}
      {loading && <p className="muted">搜索中...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && query && !error && items.length === 0 && <p className="muted">没有找到相关文章。</p>}
      <div className="searchResults">
        {items.map((item) => (
          <article className="searchResult" key={item.id}>
            <div className="postTitleLine">
              <Link className="postTitle" to={"/post/" + item.id}><HighlightedText text={item.title} query={query} /></Link>
              <span className={`statusBadge ${item.status}`}>{item.match_type === 'semantic' ? '语义匹配' : '关键词匹配'}</span>
              <LearningStatus active={Object.prototype.hasOwnProperty.call(learningGoals, String(item.id))} lastLearnedAt={learningGoals[String(item.id)]} />
            </div>
            <p><HighlightedText text={resultExcerpt(item)} query={query} /></p>
            <div className="resultMeta">
              {item.category && <span><HighlightedText text={item.category} query={query} /></span>}
              {(item.tags || []).map((tag) => <span key={tag}>#<HighlightedText text={tag} query={query} /></span>)}
              <time>{new Date(item.published_at || item.created_at).toLocaleDateString()}</time>
            </div>
          </article>
        ))}
      </div>
      {(cursorHistory.length > 0 || nextCursor) && (
        <div className="pager">
          <button disabled={cursorHistory.length === 0} onClick={previousPage}>上一页</button>
          <button disabled={!nextCursor} onClick={nextPage}>下一页</button>
        </div>
      )}
    </section>
  )
}
