import React from 'react';
import DOMPurify from 'dompurify';
import { Link, useParams } from 'react-router-dom';
import { get } from '../lib/api.js';

export function PostDetail() {
  const { id } = useParams();
  const [post, setPost] = React.useState(null);

  React.useEffect(() => {
    get(`/api/posts/${id}`).then(setPost);
  }, [id]);

  if (!post) return <p className="muted">加载中...</p>;

  return (
    <article className="article">
      <div className="sectionHeader">
        <div>
          <h1>{post.title}</h1>
          <p>{new Date(post.created_at).toLocaleString()}</p>
        </div>
        <Link className="button" to={`/edit/${post.id}`}>编辑</Link>
      </div>
      <div className="rendered" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content_html || '') }} />
    </article>
  );
}
