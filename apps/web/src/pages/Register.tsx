import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [form, setForm] = useState({ name: '', email: '', password: '', orgName: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register({ ...form, orgName: form.orgName.trim() || undefined });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card auth" onSubmit={onSubmit}>
      <h1>Create account</h1>
      {error && <p className="error">{error}</p>}
      <label>Name<input required value={form.name} onChange={set('name')} /></label>
      <label>Email<input type="email" required value={form.email} onChange={set('email')} /></label>
      <label>Password (min 8)<input type="password" required minLength={8} value={form.password} onChange={set('password')} /></label>
      <label>Organization name (optional)<input value={form.orgName} onChange={set('orgName')} /></label>
      <button disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      <p className="muted">Have an account? <Link to="/login" state={{ from }}>Sign in</Link></p>
    </form>
  );
}
