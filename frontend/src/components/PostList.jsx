import { Link } from 'react-router-dom';

export function PostList({ posts }) {
  if (!posts?.length) {
    return <p className="muted">暂无文章。</p>;
  }
  return (
    <div className="postList">
      {posts.map((post) => (
        <article className="postRow" key={post.id}>
          <div>
            <Link className="postTitle" to={`/post/${post.id}`}>{post.title}</Link>
            <p>{post.summary || '没有摘要'}</p>
          </div>
          <span>{new Date(post.created_at).toLocaleDateString()}</span>
        </article>
      ))}
    </div>
  );
}
