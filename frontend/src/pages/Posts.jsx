import React from 'react'
import { get } from '../lib/api.js'
import { PostList } from '../components/PostList.jsx'
import { QuillIcon } from '../components/Icons.jsx'

export function Posts() {
  const [posts, setPosts] = React.useState([])
  const [hasMore, setHasMore] = React.useState(false)
  const [categories, setCategories] = React.useState([])
  const [tags, setTags] = React.useState([])
  const [filters, setFilters] = React.useState({
    category: '',
    tag: '',
    status: '',
    page: 1,
  })

  React.useEffect(() => {
    get('/api/categories').then((data) => setCategories(data.items || []))
    get('/api/tags').then((data) => setTags(data.items || []))
  }, [])

  React.useEffect(() => {
    const params = new URLSearchParams({
      page: String(filters.page),
      page_size: '10',
    })
    if (filters.category) params.set('category', filters.category)
    if (filters.tag) params.set('tag', filters.tag)
    if (filters.status) params.set('status', filters.status)
    get(`/api/posts?${params}`)
      .then((data) => {
        setPosts(data.items || [])
        setHasMore(data.has_more || false)
      })
      .catch(() => {
        setPosts([])
        setHasMore(false)
      })
  }, [filters])

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
              setFilters({ ...filters, category: e.target.value, page: 1 })
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
              setFilters({ ...filters, tag: e.target.value, page: 1 })
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
              setFilters({ ...filters, status: e.target.value, page: 1 })
            }
          >
            <option value="">全部状态</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
            <option value="archived">已归档</option>
          </select>
        </div>
      </div>
      <PostList posts={posts} />
      <div className="pager">
        <button
          disabled={filters.page <= 1}
          onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
        >
          上一页
        </button>
        <span>第 {filters.page} 页</span>
        <button
          disabled={!hasMore}
          onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
        >
          下一页
        </button>
      </div>
    </section>
  )
}
