import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { reloadOrgs } = useAuth();
  const [error, setError] = useState(token ? '' : 'Missing invitation token');
  const started = useRef(false); // StrictMode runs effects twice in dev; accept only once

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    (async () => {
      try {
        const { orgId } = await api<{ orgId: string }>('/invitations/accept', { method: 'POST', body: { token } });
        await reloadOrgs(orgId);
        navigate('/', { replace: true });
      } catch (err) {
        setError(err instanceof ApiRequestError ? err.message : 'Something went wrong');
      }
    })();
  }, [token, reloadOrgs, navigate]);

  return (
    <div className="card auth">
      <h1>Joining organization…</h1>
      {error ? (
        <>
          <p className="error">{error}</p>
          <Link to="/">Go to dashboard</Link>
        </>
      ) : (
        <p className="muted">One moment.</p>
      )}
    </div>
  );
}
