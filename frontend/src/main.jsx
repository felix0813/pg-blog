import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import Cookies from 'js-cookie'
import { LogOut, Moon, PenLine, Search, Sun } from 'lucide-react'
import { QuillIcon } from './components/Icons.jsx'
import './styles.css'
import './search.css'
import { Home } from './pages/Home.jsx'
import { Posts } from './pages/Posts.jsx'
import { PostDetail } from './pages/PostDetail.jsx'
import { EditPostRoute } from './pages/EditPost.jsx'
import { Login } from './pages/Login.jsx'
import { Settings } from './pages/Settings.jsx'
import { Profile } from './pages/Profile.jsx'
import { SearchPage } from './pages/Search.jsx'
import { DailyLearning } from './pages/DailyLearning.jsx'
import { get, post } from './lib/api.js'
import { deleteUserDrafts } from './lib/draftStorage.js'

function App() {
  const [theme, setTheme] = React.useState(Cookies.get('theme') || 'light')
  const [user, setUser] = React.useState(null)
  const [authChecked, setAuthChecked] = React.useState(false)
  const navigate = useNavigate()
  React.useEffect(() => {
    const onKeyDown = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); navigate('/search') } }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])
  React.useEffect(() => { document.documentElement.dataset.theme = theme; Cookies.set('theme', theme, { sameSite: 'lax', expires: 365 }) }, [theme])
  React.useEffect(() => { get('/api/me').then((data) => setUser(data.user)).catch(() => setUser(null)).finally(() => setAuthChecked(true)) }, [])
  async function logout() {
    const userID = user?.id
    await post("/logout", {})
    if (userID) await deleteUserDrafts(userID).catch(() => undefined)
    setUser(null)
    navigate("/")
  }
  function ProtectedRoute({ children }) { return !authChecked ? <p className="muted">Loading...</p> : user ? children : <Navigate to="/login" replace /> }
  return <><header className="topbar"><Link className="brand" to="/"><QuillIcon size={20} className="brandIcon" />Personal Blog</Link><nav><NavLink to="/posts">文章</NavLink><NavLink to="/search"><Search size={16} />搜索</NavLink><NavLink to="/edit/new">写作</NavLink>{user && <NavLink to="/daily-learning">每日学习</NavLink>}{user && <NavLink to="/profile">我的主页</NavLink>}{user ? <NavLink to="/settings">设置</NavLink> : <NavLink to="/login">登录</NavLink>}</nav>{user && <div className="accountPill" title={user.bio || user.username}>{user.avatar_url ? <img src={user.avatar_url} alt="头像" /> : <span>{(user.display_name || user.username || 'U').slice(0, 1).toUpperCase()}</span>}<strong>{user.display_name || user.username}</strong></div>}{user && <button className="iconButton" title="退出登录" onClick={logout}><LogOut size={18} /></button>}<button className="iconButton" title="切换主题" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button></header><main className="shell"><Routes><Route path="/" element={<Home user={user} />} /><Route path="/posts" element={<Posts />} /><Route path="/search" element={<SearchPage />} /><Route path="/post/:id" element={<PostDetail />} /><Route path="/profile" element={<ProtectedRoute><Profile user={user} /></ProtectedRoute>} /><Route path="/edit/:id" element={<EditPostRoute user={user} />} /><Route path="/settings" element={<Settings user={user} onUserChange={setUser} />} /><Route path="/daily-learning" element={<ProtectedRoute><DailyLearning /></ProtectedRoute>} /><Route path="/login" element={<Login mode="login" onAuth={setUser} />} /><Route path="/register" element={<Login mode="register" onAuth={setUser} />} /></Routes></main>{(user || authChecked) && <Link className="composeFab" title="新建文章" to="/edit/new"><PenLine size={20} /></Link>}</>
}
const router = createBrowserRouter([{ path: '*', element: <App /> }], { basename: '/myblog' })
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><RouterProvider router={router} /></React.StrictMode>)
