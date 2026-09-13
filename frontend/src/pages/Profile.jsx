import React from 'react'
import { get } from '../lib/api.js'
import { PostList } from '../components/PostList.jsx'
import { QuillIcon } from '../components/Icons.jsx'

export function Profile({ user }) {
  const [posts, setPosts] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    const controller = new AbortController()
    get('/api/me/posts', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setPosts(data.items || [])
      })
      .catch((err) => {
        if (err.name !== 'AbortError' && !controller.signal.aborted) setError('文章加载失败，请重试。')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  return (
    <section className="contentPanel profilePosts">
      <div className="sectionHeader">
        <div className="flexRow">
          <QuillIcon size={24} className="brandIcon" />
          <div>
            <p className="eyebrow">我的空间</p>
            <h1>{user.display_name || user.username} 的文章</h1>
          </div>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {loading ? <p className="muted">加载文章中...</p> : <PostList posts={posts} />}
    </section>
  )
}
