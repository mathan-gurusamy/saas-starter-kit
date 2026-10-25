import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, refreshSession, setAccessToken, setActiveOrgId, type SessionResponse } from './api';

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER';
export interface User {
  id: string;
  email: string;
  name: string;
}
export interface Org {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'PRO' | 'TEAM';
  role: Role;
}

interface AuthState {
  user: User | null;
  orgs: Org[];
  activeOrg: Org | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string; orgName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  switchOrg: (orgId: string) => void;
  reloadOrgs: (preferOrgId?: string) => Promise<void>;
  createOrg: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const ORG_KEY = 'activeOrgId';

const readStoredOrg = () => {
  try {
    return localStorage.getItem(ORG_KEY);
  } catch {
    return null;
  }
};
const storeOrg = (id: string | null) => {
  try {
    if (id) localStorage.setItem(ORG_KEY, id);
    else localStorage.removeItem(ORG_KEY);
  } catch {
    /* storage unavailable — fine, the choice just won't persist */
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrgId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectOrg = useCallback((id: string | null) => {
    setActiveId(id);
    setActiveOrgId(id);
    storeOrg(id);
  }, []);

  const reloadOrgs = useCallback(
    async (preferOrgId?: string) => {
      const { orgs: list } = await api<{ orgs: Org[] }>('/orgs');
      setOrgs(list);
      const wanted = preferOrgId ?? readStoredOrg();
      const chosen = list.find((o) => o.id === wanted) ?? list[0] ?? null;
      selectOrg(chosen?.id ?? null);
    },
    [selectOrg],
  );

  const startSession = useCallback(
    async (session: SessionResponse) => {
      setAccessToken(session.accessToken);
      setUser(session.user);
      await reloadOrgs();
    },
    [reloadOrgs],
  );

  // Restore the session from the refresh cookie on first load.
  useEffect(() => {
    (async () => {
      const session = await refreshSession();
      if (session) await startSession(session).catch(() => undefined);
      setLoading(false);
    })();
  }, [startSession]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      orgs,
      activeOrg: orgs.find((o) => o.id === activeOrgId) ?? null,
      loading,
      login: async (email, password) =>
        startSession(await api<SessionResponse>('/auth/login', { method: 'POST', body: { email, password } })),
      register: async (input) =>
        startSession(await api<SessionResponse>('/auth/register', { method: 'POST', body: input })),
      logout: async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        setAccessToken(null);
        selectOrg(null);
        setUser(null);
        setOrgs([]);
      },
      switchOrg: selectOrg,
      reloadOrgs,
      createOrg: async (name) => {
        const { org } = await api<{ org: Org }>('/orgs', { method: 'POST', body: { name } });
        await reloadOrgs(org.id);
      },
    }),
    [user, orgs, activeOrgId, loading, startSession, selectOrg, reloadOrgs],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export const canManage = (role?: Role) => role === 'OWNER' || role === 'ADMIN';
