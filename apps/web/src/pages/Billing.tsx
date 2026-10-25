import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

interface BillingInfo {
  plan: 'FREE' | 'PRO' | 'TEAM';
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  limits: { projects: number | null; members: number | null };
  usage: { projects: number; members: number };
}

const fmt = (limit: number | null) => (limit === null ? '∞' : String(limit));

export default function Billing() {
  const { activeOrg, reloadOrgs } = useAuth();
  const [params] = useSearchParams();
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [error, setError] = useState('');
  const isOwner = activeOrg?.role === 'OWNER';

  useEffect(() => {
    api<BillingInfo>('/billing').then(setInfo).catch((e) => setError(e.message));
    // After returning from Checkout the webhook may land a moment later — refresh the plan badge.
    if (params.get('checkout') === 'success') {
      const t = setTimeout(() => {
        api<BillingInfo>('/billing').then(setInfo).catch(() => undefined);
        void reloadOrgs(activeOrg?.id);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [params, reloadOrgs, activeOrg?.id]);

  const redirectTo = async (path: string, body?: unknown) => {
    setError('');
    try {
      const { url } = await api<{ url: string }>(path, { method: 'POST', body });
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong');
    }
  };

  return (
    <section>
      <h1>Billing</h1>
      {params.get('checkout') === 'success' && <p className="banner">Thanks! Your subscription is being activated…</p>}
      {params.get('checkout') === 'cancelled' && <p className="banner">Checkout cancelled — no charge was made.</p>}
      {error && <p className="error">{error}</p>}

      {info && (
        <div className="card">
          <h2>
            Current plan: <span className="badge">{info.plan}</span>
          </h2>
          <p className="muted">
            Projects {info.usage.projects}/{fmt(info.limits.projects)} · Members {info.usage.members}/{fmt(info.limits.members)}
          </p>
          {info.currentPeriodEnd && (
            <p className="muted">
              {info.cancelAtPeriodEnd ? 'Ends' : 'Renews'} on {new Date(info.currentPeriodEnd).toLocaleDateString()}
              {info.status === 'past_due' && ' — payment failed, please update your card'}
            </p>
          )}
          {!isOwner && <p className="muted">Only the organization owner can change the plan.</p>}
          {isOwner && (
            <div className="row">
              {info.plan === 'FREE' ? (
                <>
                  <button onClick={() => redirectTo('/billing/checkout', { plan: 'PRO' })}>Upgrade to Pro</button>
                  <button onClick={() => redirectTo('/billing/checkout', { plan: 'TEAM' })}>Upgrade to Team</button>
                </>
              ) : (
                <button onClick={() => redirectTo('/billing/portal')}>Manage subscription</button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
