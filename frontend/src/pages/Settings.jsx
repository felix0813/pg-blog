import React from 'react';
import { Save, UserRound } from 'lucide-react';
import { get, put } from '../lib/api.js';

export function Settings({ user, onUserChange }) {
  const [form, setForm] = React.useState({ display_name: '', avatar_url: '', bio: '' });
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (user) {
      setForm({
        display_name: user.display_name || user.username || '',
        avatar_url: user.avatar_url || '',
        bio: user.bio || '',
      });
      return;
    }
    get('/api/me')
      .then((data) => {
        onUserChange?.(data.user);
        setForm({
          display_name: data.user?.display_name || data.user?.username || '',
          avatar_url: data.user?.avatar_url || '',
          bio: data.user?.bio || '',
        });
      })
      .catch((err) => setError(err.message));
  }, [onUserChange, user]);

  async function submit(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const data = await put('/api/me', form);
      onUserChange?.(data.user);
      setMessage('设置已保存');
    } catch (err) {
      setError(err.message);
    }
  }

  const avatarLabel = (form.display_name || user?.username || 'PB').trim().slice(0, 2).toUpperCase();

  return (
    <section className="settingsPage">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>个人设置</h1>
          <p>维护标题栏展示信息、头像和主页签名。</p>
        </div>
      </div>
      <form className="settingsCard" onSubmit={submit}>
        <div className="settingsPreview">
          {form.avatar_url ? <img className="avatar imageAvatar" src={form.avatar_url} alt="头像预览" /> : <div className="avatar"><UserRound size={26} />{avatarLabel}</div>}
          <div>
            <strong>{form.display_name || '未设置昵称'}</strong>
            <p>{form.bio || '写一句签名，介绍你正在关注的事情。'}</p>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
        <label>
          昵称
          <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="用于标题栏和个人资料展示" />
        </label>
        <label>
          头像 URL
          <input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://example.com/avatar.png" />
        </label>
        <label>
          签名
          <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="例如：持续构建、持续记录。" />
        </label>
        <button className="button primary" type="submit"><Save size={17} />保存设置</button>
      </form>
    </section>
  );
}
