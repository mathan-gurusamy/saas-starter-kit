import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiRequestError } from '../lib/api';
import { canManage, useAuth, type Role } from '../lib/auth';

interface Member {
  id: string;
  email: string;
  name: string;
  role: Role;
}
interface Invitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
}

export default function Team() {
  const { activeOrg, user } = useAuth();
  const myRole = activeOrg?.role;
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [acceptUrl, setAcceptUrl] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setMembers((await api<{ members: Member[] }>('/team/members')).members);
    if (canManage(myRole)) setInvites((await api<{ invitations: Invitation[] }>('/team/invitations')).invitations);
  }, [myRole]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong');
    }
  };

  const onInvite = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await api<{ acceptUrl: string }>('/team/invitations', { method: 'POST', body: { email, role } });
      setAcceptUrl(res.acceptUrl);
      setEmail('');
    });
  };

  return (
    <section>
      <h1>Team</h1>
      {error && <p className="error">{error}</p>}

      <ul className="list">
        {members.map((m) => (
          <li key={m.id}>
            <span>
              {m.name} <span className="muted">{m.email}</span>
            </span>
            <span className="row">
              {myRole === 'OWNER' && m.role !== 'OWNER' ? (
                <select
                  value={m.role}
                  onChange={(e) =>
                    run(() => api(`/team/members/${m.id}`, { method: 'PATCH', body: { role: e.target.value } }))
                  }
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                </select>
              ) : (
                <span className="badge">{m.role}</span>
              )}
              {canManage(myRole) && m.role !== 'OWNER' && m.id !== user?.id && (
                <button className="ghost danger" onClick={() => run(() => api(`/team/members/${m.id}`, { method: 'DELETE' }))}>
                  Remove
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {canManage(myRole) && (
        <>
          <h2>Invite a teammate</h2>
          <form className="inline-form" onSubmit={onInvite}>
            <input type="email" required placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')}>
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button>Send invite</button>
          </form>
          {acceptUrl && (
            <p className="banner">
              Share this link with them (wire up email in <code>team.routes.ts</code>): <code>{acceptUrl}</code>
            </p>
          )}

          {invites.length > 0 && (
            <>
              <h2>Pending invitations</h2>
              <ul className="list">
                {invites.map((i) => (
                  <li key={i.id}>
                    <span>
                      {i.email} <span className="badge">{i.role}</span>
                    </span>
                    <button className="ghost danger" onClick={() => run(() => api(`/team/invitations/${i.id}`, { method: 'DELETE' }))}>
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
