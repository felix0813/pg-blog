import React from 'react'
import { get } from '../lib/api.js'
import { PostList } from '../components/PostList.jsx'
import { QuillIcon } from '../components/Icons.jsx'
import { learningGoalMap } from '../lib/learningGoals.js'

export function Profile({ user }) {
  const [posts, setPosts] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [learningPosts, setLearningPosts] = React.useState([])
  const [learningGoals, setLearningGoals] = React.useState({})
  const [learningLoading, setLearningLoading] = React.useState(true)

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

  React.useEffect(() => {
    const controller = new AbortController()
    Promise.all([get("/api/learning-goals", { signal: controller.signal }), get("/api/learning-goals/posts", { signal: controller.signal })])
      .then(([goals, targets]) => { if (!controller.signal.aborted) { setLearningGoals(learningGoalMap(goals.items)); setLearningPosts(targets.items || []) } })
      .catch(() => { if (!controller.signal.aborted) { setLearningGoals({}); setLearningPosts([]) } })
      .finally(() => { if (!controller.signal.aborted) setLearningLoading(false) })
    return () => controller.abort()
  }, [])

  return (
    <section className="contentPanel profilePosts">
      <div className="sectionHeader">
        <div className="flexRow">
          <QuillIcon size={24} className="brandIcon" />
          <div>
            <p className="eyebrow">我的空间</p>
            <h1>{"\u6211\u7684\u7a7a\u95f4"}</h1>
          </div>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <section className="ownPosts">
        <h2>{"\u6211\u7684\u6587\u7ae0"}</h2>
        {loading ? <p className="muted">{"\u52a0\u8f7d\u6587\u7ae0\u4e2d..."}</p> : <PostList posts={posts} learningGoals={learningGoals} />}
      </section>
      <section className="learningPanel">
        <h2>{"\u5b66\u4e60\u76ee\u6807"}</h2>
        {learningLoading ? <p className="muted">{"\u52a0\u8f7d\u5b66\u4e60\u76ee\u6807\u4e2d..."}</p> : <PostList posts={learningPosts} learningGoals={learningGoals} />}
      </section>
    </section>
  )
}
