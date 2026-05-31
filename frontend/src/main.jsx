import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import Cookies from 'js-cookie';
import { Moon, PenLine, Sun } from 'lucide-react';
import './styles.css';
import { Home } from './pages/Home.jsx';
import { Posts } from './pages/Posts.jsx';
import { PostDetail } from './pages/PostDetail.jsx';
import { EditPost } from './pages/EditPost.jsx';
import { Login } from './pages/Login.jsx';

function App() {
  const [theme, setTheme] = React.useState(Cookies.get('theme') || 'light');

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    Cookies.set('theme', theme, { sameSite: 'lax', expires: 365 });
  }, [theme]);

  return (
    <>
      <header className="topbar">
        <Link className="brand" to="/">Personal Blog</Link>
        <nav>
          <NavLink to="/posts">文章</NavLink>
          <NavLink to="/edit/new">写作</NavLink>
          <NavLink to="/login">登录</NavLink>
        </nav>
        <button className="iconButton" title="切换主题" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>
      <main className="shell">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/edit/:id" element={<EditPost />} />
          <Route path="/login" element={<Login mode="login" />} />
          <Route path="/register" element={<Login mode="register" />} />
        </Routes>
      </main>
      <Link className="composeFab" title="新建文章" to="/edit/new"><PenLine size={20} /></Link>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
