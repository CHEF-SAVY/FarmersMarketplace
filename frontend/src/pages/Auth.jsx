import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const s = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { background: '#fff', borderRadius: 12, padding: 36, width: 360, boxShadow: '0 2px 16px #0001' },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#2d6a4f' },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, marginBottom: 4, color: '#555' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 },
  select: { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14 },
  btn: { width: '100%', padding: '12px', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
  err: { color: '#c0392b', fontSize: 13, marginTop: 8 },
  link: { display: 'block', textAlign: 'center', marginTop: 16, color: '#2d6a4f', fontSize: 14 },
};

export function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const { token, user } = await api.login(form);
      login(token, user);
      navigate(user.role === 'farmer' ? '/dashboard' : '/marketplace');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.title}>🌿 Welcome back</div>
        <form onSubmit={handleSubmit}>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input style={s.input} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input style={s.input} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>
          {error && <div style={s.err}>{error}</div>}
          <button style={s.btn} type="submit">Login</button>
        </form>
        <Link to="/register" style={s.link}>Don't have an account? Register</Link>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'buyer' });
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const { token, user } = await api.register(form);
      login(token, user);
      navigate(user.role === 'farmer' ? '/dashboard' : '/marketplace');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.title}>🌱 Create Account</div>
        <form onSubmit={handleSubmit}>
          {['name', 'email', 'password'].map(field => (
            <div key={field} style={s.field}>
              <label style={s.label}>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
              <input style={s.input} type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} required />
            </div>
          ))}
          <div style={s.field}>
            <label style={s.label}>I am a...</label>
            <select style={s.select} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="buyer">Buyer</option>
              <option value="farmer">Farmer</option>
            </select>
          </div>
          {error && <div style={s.err}>{error}</div>}
          <button style={s.btn} type="submit">Create Account</button>
        </form>
        <Link to="/login" style={s.link}>Already have an account? Login</Link>
      </div>
    </div>
  );
}
