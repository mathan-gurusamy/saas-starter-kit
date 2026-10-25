// Access token lives in memory only (not localStorage) so XSS can't steal it.
// The long-lived refresh token is an httpOnly cookie the browser sends to /api/auth.
let accessToken: string | null = null;
let activeOrgId: string | null = null;

export const setAccessToken = (t: string | null) => (accessToken = t);
export const setActiveOrgId = (id: string | null) => (activeOrgId = id);

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

async function send(path: string, { method = 'GET', body }: Options): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (activeOrgId) headers['X-Org-Id'] = activeOrgId;
  return fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export interface SessionResponse {
  accessToken: string;
  user: { id: string; email: string; name: string };
}

let refreshing: Promise<SessionResponse | null> | null = null;

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<SessionResponse | null> {
  refreshing ??= (async () => {
    try {
      const res = await send('/auth/refresh', { method: 'POST' });
      if (!res.ok) return null;
      const data = (await res.json()) as SessionResponse;
      accessToken = data.accessToken;
      return data;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  let res = await send(path, options);
  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) res = await send(path, options);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiRequestError(res.status, data.error ?? res.statusText, data.details);
  return data as T;
}
