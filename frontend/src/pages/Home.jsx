import React from 'react';
import { get } from '../lib/api.js';
import { StatStrip } from '../components/StatStrip.jsx';
import { PostList } from '../components/PostList.jsx';

export function Home() {
  const [stats, setStats] = React.useState(null);
  const [posts, setPosts] = React.useState([]);

  React.useEffect(() => {
    get('/api/stats/profile').then(setStats).catch(() => setStats({}));
    get('/api/posts?page=1&page_size=5').then((data) => setPosts(data.items || [])).catch(() => setPosts([]));
  }, []);

  return (
    <section className="profileLayout">
      <aside className="profilePanel">
        <div className="avatar">PB</div>
        <h1>个人主页</h1>
        <p>记录日常开发、问题复盘和长期维护的技术笔记。</p>
        <StatStrip stats={stats} />
      </aside>
      <section className="contentPanel">
        <div className="sectionHeader">
          <h2>最新文章</h2>
        </div>
        <PostList posts={posts} />
        <div className="tagCloud">
          {(stats?.hot_tags || []).map((tag) => (
            <span key={tag.Member || tag.member}>{tag.Member || tag.member}</span>
          ))}
        </div>
      </section>
    </section>
  );
}
