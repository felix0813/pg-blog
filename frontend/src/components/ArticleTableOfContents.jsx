import React from 'react'
import '../article-toc.css'

export function ArticleTableOfContents({ headings }) {
  if (headings.length === 0) return null

  return (
    <nav className="articleToc" aria-label="文章目录">
      <strong>文章目录</strong>
      <ol>
        {headings.map((heading) => (
          <li className={`level${heading.level}`} key={heading.id}>
            <a href={`#${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
