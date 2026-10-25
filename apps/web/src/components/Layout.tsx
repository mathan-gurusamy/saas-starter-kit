import { useState, type FormEvent } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Layout() {
  const { user, orgs, activeOrg, switchOrg, createOrg, logout } = useAuth();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createOrg(name.trim());
    setName('');
    setCreating(false);
  };

  return (
    <div className="shell">
      <header className="topbar">
        <strong className="brand">SaaS Kit</strong>
        <nav>
          <NavLink to="/" end>Projects</NavLink>
          <NavLink to="/team">Team</NavLink>
          <NavLink to="/billing">Billing</NavLink>
        </nav>
        <div className="spacer" />
        <select
          aria-label="Organization"
          value={activeOrg?.id ?? ''}
          onChange={(e) => (e.target.value === '__new' ? setCreating(true) : switchOrg(e.target.value))}
        >
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.plan})
            </option>
          ))}
          <option value="__new">+ New organization…</option>
        </select>
        <span className="muted">{user?.name}</span>
        <button className="ghost" onClick={logout}>Sign out</button>
      </header>

      {creating && (
        <form className="inline-form banner" onSubmit={onCreate}>
          <input autoFocus placeholder="Organization name" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit">Create</button>
          <button type="button" className="ghost" onClick={() => setCreating(false)}>Cancel</button>
        </form>
      )}

      <main>{activeOrg ? <Outlet key={activeOrg.id} /> : <p className="muted">You don't belong to an organization yet.</p>}</main>
    </div>
  );
}
