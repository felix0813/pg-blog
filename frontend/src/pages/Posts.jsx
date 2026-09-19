import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { get } from '../lib/api.js'
import { PostList } from '../components/PostList.jsx'
import { QuillIcon } from '../components/Icons.jsx'
import { learningGoalMap } from '../lib/learningGoals.js'
import { postFiltersFromSearch, postFiltersToSearch } from '../lib/postFilters.js'

export function Posts() {
  const [posts, setPosts] = React.useState([])
  const [hasMore, setHasMore] = React.useState(false)
  const [categories, setCategories] = React.useState([])
  const [tags, setTags] = React.useState([])
  const [learningGoals, setLearningGoals] = React.useState({})
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = postFiltersFromSearch(searchParams)

  function changeFilters(patch) {
    const next = { ...filters, ...patch }
    if (patch.page === undefined) next.page = 1
    setSearchParams(postFiltersToSearch(next))
  }

  React.useEffect(() => {
    get('/api/categories').then((data) => setCategories(data.items || []))
    get('/api/tags').then((data) => setTags(data.items || []))
    get("/api/learning-goals").then((data) => setLearningGoals(learningGoalMap(data.items))).catch(() => setLearningGoals({}))
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      page: String(filters.page),
      page_size: '10',
    })
    if (filters.category) params.set('category', filters.category)
    if (filters.tag) params.set('tag', filters.tag)
    if (filters.status) params.set('status', filters.status)
    get(`/api/posts?${params}`, { signal: controller.signal })
      .then((data) => {
        setPosts(data.items || [])
        setHasMore(data.has_more || false)
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        setPosts([])
        setHasMore(false)
      })
    return () => controller.abort()
  }, [filters.category, filters.tag, filters.status, filters.page])

  return (
    <section>
      <div className="sectionHeader">
        <div className="flexRow">
          <QuillIcon size={24} className="brandIcon" />
          <h1>文章列表</h1>
        </div>
        <div className="filters">
          <select
            value={filters.category}
            onChange={(e) =>
              changeFilters({ category: e.target.value })
            }
          >
            <option value="">全部分类</option>
            {categories.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={filters.tag}
            onChange={(e) =>
              changeFilters({ tag: e.target.value })
            }
          >
            <option value="">全部标签</option>
            {tags.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) =>
              changeFilters({ status: e.target.value })
            }
          >
            <option value="">全部状态</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
            <option value="archived">已归档</option>
          </select>
        </div>
      </div>
      <PostList posts={posts} learningGoals={learningGoals} />
      <div className="pager">
        <button
          disabled={filters.page <= 1}
          onClick={() => changeFilters({ page: filters.page - 1 })}
        >
          上一页
        </button>
        <span>第 {filters.page} 页</span>
        <button
          disabled={!hasMore}
          onClick={() => changeFilters({ page: filters.page + 1 })}
        >
          下一页
        </button>
      </div>
    </section>
  )
}
