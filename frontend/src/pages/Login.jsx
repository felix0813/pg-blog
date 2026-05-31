import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { post } from '../lib/api.js';

export function Login({ mode, onAuth }) {
  const navigate = useNavigate();
  const isRegister = mode === 'register';
  const [form, setForm] = React.useState({ username: '', email: '', password: '' });
  const [error, setError] = React.useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await post(isRegister ? '/register' : '/login', form);
      onAuth?.(data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="authPage">
      <form className="authForm" onSubmit={submit}>
        <h1>{isRegister ? '注册' : '登录'}</h1>
        {error && <p className="error">{error}</p>}
        <input placeholder="用户名" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        {isRegister && <input placeholder="邮箱" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
        <input placeholder="密码" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="button primary" type="submit">{isRegister ? '创建账号' : '登录'}</button>
        <Link to={isRegister ? '/login' : '/register'}>{isRegister ? '已有账号' : '注册新账号'}</Link>
      </form>
    </section>
  );
}
