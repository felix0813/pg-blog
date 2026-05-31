import React from 'react'
import DOMPurify from 'dompurify'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { del, get } from '../lib/api.js'
import { QuillIcon } from '../components/Icons.jsx'

export function PostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = React.useState(null)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    setError('')
    get(`/api/posts/${id}`)
      .then(setPost)
      .catch((err) => setError(err.message))
  }, [id])

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
      <div
        className="rendered"
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(post.content_html || ''),
        }}
      />
    </article>
  )
}
