import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card auth" onSubmit={onSubmit}>
      <h1>Sign in</h1>
      {error && <p className="error">{error}</p>}
      <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p className="muted">No account? <Link to="/register" state={{ from }}>Create one</Link></p>
    </form>
  );
}
