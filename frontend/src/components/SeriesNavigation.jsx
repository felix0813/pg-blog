import React from 'react'
import { Link } from 'react-router-dom'
import '../series.css'

export function SeriesNavigation({ data, currentPostID }) {
  if (!data?.series || !data.items?.length) return null
  const currentIndex = data.items.findIndex((item) => String(item.id) === String(currentPostID))
  const previous = currentIndex > 0 ? data.items[currentIndex - 1] : null
  const next = currentIndex >= 0 && currentIndex < data.items.length - 1 ? data.items[currentIndex + 1] : null

  return (
    <nav className="seriesNavigation" aria-labelledby="series-title">
      <p className="eyebrow">Series</p>
      <h2 id="series-title">{data.series.title}</h2>
      {data.series.description && <p>{data.series.description}</p>}
      <ol>
        {data.items.map((item) => (
          <li className={String(item.id) === String(currentPostID) ? 'current' : ''} key={item.id}>
            {String(item.id) === String(currentPostID) ? <span>{item.title}</span> : <Link to={`/post/${item.id}`}>{item.title}</Link>}
          </li>
        ))}
      </ol>
      <div className="seriesPager">
        {previous ? <Link to={`/post/${previous.id}`}>← {previous.title}</Link> : <span />}
        {next ? <Link to={`/post/${next.id}`}>{next.title} →</Link> : <span />}
      </div>
    </nav>
  )
}
