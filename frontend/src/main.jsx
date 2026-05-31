import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom'
import Cookies from 'js-cookie'
import { LogOut, Moon, PenLine, Sun } from 'lucide-react'
import { QuillIcon } from './components/Icons.jsx'
import './styles.css'
import { Home } from './pages/Home.jsx'
import { Posts } from './pages/Posts.jsx'
import { PostDetail } from './pages/PostDetail.jsx'
import { EditPost } from './pages/EditPost.jsx'
import { Login } from './pages/Login.jsx'
import { Settings } from './pages/Settings.jsx'
import { get, post } from './lib/api.js'

function App() {
  const [theme, setTheme] = React.useState(Cookies.get('theme') || 'light')
  const [user, setUser] = React.useState(null)
  const [authChecked, setAuthChecked] = React.useState(false)
  const navigate = useNavigate()

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme
    Cookies.set('theme', theme, { sameSite: 'lax', expires: 365 })
  }, [theme])

  React.useEffect(() => {
    get('/api/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true))
  }, [])

  async function logout() {
    await post('/logout', {})
    setUser(null)
    navigate('/')
  }

  return (
    <>
      <header className="topbar">
        <Link className="brand" to="/">
          <QuillIcon size={20} className="brandIcon" />
          Personal Blog
        </Link>
        <nav>
          <NavLink to="/posts">文章</NavLink>
          <NavLink to="/edit/new">写作</NavLink>
          {user ? (
            <NavLink to="/settings">设置</NavLink>
          ) : (
            <NavLink to="/login">登录</NavLink>
          )}
        </nav>
        {user && (
          <div className="accountPill" title={user.bio || user.username}>
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="头像" />
            ) : (
              <span>
                {(user.display_name || user.username || 'U')
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
            )}
            <strong>{user.display_name || user.username}</strong>
          </div>
        )}
        {user && (
          <button className="iconButton" title="退出登录" onClick={logout}>
            <LogOut size={18} />
          </button>
        )}
        <button
          className="iconButton"
          title="切换主题"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>
      <main className="shell">
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/edit/:id" element={<EditPost />} />
          <Route
            path="/settings"
            element={<Settings user={user} onUserChange={setUser} />}
          />
          <Route
            path="/login"
            element={<Login mode="login" onAuth={setUser} />}
          />
          <Route
            path="/register"
            element={<Login mode="register" onAuth={setUser} />}
          />
        </Routes>
      </main>
      {(user || authChecked) && (
        <Link className="composeFab" title="新建文章" to="/edit/new">
          <PenLine size={20} />
        </Link>
      )}
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
