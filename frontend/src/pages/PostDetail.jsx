import React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { del, get } from '../lib/api.js'
import { QuillIcon } from '../components/Icons.jsx'
import { RenderedPostContent } from '../components/RenderedPostContent.jsx'
import { ArticleTableOfContents } from '../components/ArticleTableOfContents.jsx'
import { SeriesNavigation } from '../components/SeriesNavigation.jsx'

export function PostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = React.useState(null)
  const [related, setRelated] = React.useState([])
  const [error, setError] = React.useState('')
  const [headings, setHeadings] = React.useState([])
  const [seriesData, setSeriesData] = React.useState(null)
  const handleHeadingsChange = React.useCallback((items) => setHeadings(items), [])

  React.useEffect(() => {
    setError('')
    get(`/api/posts/${id}`)
      .then(setPost)
      .catch((err) => setError(err.message))
  }, [id])
  React.useEffect(() => { get("/api/posts/" + id + "/related?limit=6").then((data) => setRelated(data.items || [])).catch(() => setRelated([])) }, [id])
  React.useEffect(() => { get("/api/posts/" + id + "/series").then(setSeriesData).catch(() => setSeriesData(null)) }, [id])


  async function deletePost() {
    if (!window.confirm('确定删除这篇文章吗？')) return
    setError('')
    try {
      await del(`/api/posts/${id}`)
      navigate('/posts')
    } catch (err) {
      setError(err.message)
    }
  }

  if (error && !post) return <p className="error">{error}</p>
  if (!post) return <p className="muted">加载中...</p>

  const statusLabels = {
    draft: '草稿',
    published: '已发布',
    archived: '已归档',
  }

  return (
    <div className="articleLayout">
    <article className="article">
      <div className="sectionHeader">
        <div>
          <div className="postTitleLine">
            <QuillIcon
              size={28}
              className="brandIcon"
              style={{ marginRight: '8px' }}
            />
            <h1>{post.title}</h1>
            <span className={`statusBadge ${post.status || 'draft'}`}>
              {statusLabels[post.status] || post.status || '草稿'}
            </span>
          </div>
          <p>{new Date(post.created_at).toLocaleString()}</p>
          {(post.tags || []).length > 0 && (
            <ul className="postTags" aria-label={'\u6587\u7ae0\u6807\u7b7e'}>
              {post.tags.map((tag) => (
                <li key={tag.id}>
                  <Link to={`/posts?tag=${encodeURIComponent(tag.slug)}`}>#{tag.name}</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="actions">
          <Link className="button" to={`/edit/${post.id}`}>
            编辑
          </Link>
          <button className="button danger" type="button" onClick={deletePost}>
            删除
          </button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {post.summary && <p className="articleSummary">{post.summary}</p>}
      <RenderedPostContent html={post.content_html} onHeadingsChange={handleHeadingsChange} />
      <SeriesNavigation data={seriesData} currentPostID={post.id} />
      {related.length > 0 && (
        <section className="relatedPosts">
          <h2>相关文章</h2>
          <div className="relatedGrid">
            {related.map((item) => (
              <Link className="relatedCard" key={item.id} to={"/post/" + item.id}>
                <strong>{item.title}</strong>
                <span>{item.summary || "继续阅读"}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
    <ArticleTableOfContents headings={headings} />
    </div>
  )
}
