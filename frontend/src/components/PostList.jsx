import { Link } from 'react-router-dom';

const statusLabels = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};

export function PostList({ posts }) {
  if (!posts?.length) {
    return <p className="muted">暂无文章。</p>;
  }
  return (
    <div className="postList">
      {posts.map((post) => (
        <article className="postRow" key={post.id}>
          <div>
            <div className="postTitleLine">
              <Link className="postTitle" to={`/post/${post.id}`}>{post.title}</Link>
              <span className={`statusBadge ${post.status || 'draft'}`}>{statusLabels[post.status] || post.status || '草稿'}</span>
            </div>
            <p>{post.summary || '没有摘要'}</p>
          </div>
          <span>{new Date(post.created_at).toLocaleDateString()}</span>
        </article>
      ))}
    </div>
  );
}
