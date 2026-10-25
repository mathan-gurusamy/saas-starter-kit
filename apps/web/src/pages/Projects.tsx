import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiRequestError } from '../lib/api';
import { canManage, useAuth } from '../lib/auth';

interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export default function Projects() {
  const { activeOrg } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [limitHit, setLimitHit] = useState(false);

  const load = useCallback(async () => {
    setProjects((await api<{ projects: Project[] }>('/projects')).projects);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLimitHit(false);
    try {
      await api('/projects', { method: 'POST', body: { name } });
      setName('');
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setLimitHit(err.status === 402);
      }
    }
  };

  const onDelete = async (id: string) => {
    await api(`/projects/${id}`, { method: 'DELETE' }).catch((e) => setError(e.message));
    await load();
  };

  return (
    <section>
      <h1>Projects</h1>
      <p className="muted">
        Example tenant-scoped resource — every row is filtered by the active organization on the server.
      </p>
      <form className="inline-form" onSubmit={onCreate}>
        <input required placeholder="New project name" value={name} onChange={(e) => setName(e.target.value)} />
        <button>Add project</button>
      </form>
      {error && (
        <p className="error">
          {error} {limitHit && <Link to="/billing">See plans →</Link>}
        </p>
      )}
      <ul className="list">
        {projects.map((p) => (
          <li key={p.id}>
            <span>{p.name}</span>
            {canManage(activeOrg?.role) && (
              <button className="ghost danger" onClick={() => onDelete(p.id)}>Delete</button>
            )}
          </li>
        ))}
        {!projects.length && <li className="muted">No projects yet.</li>}
      </ul>
    </section>
  );
}
