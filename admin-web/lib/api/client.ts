const API = 'https://zana.ajumalink.com/api/v1';
const KEY = 'zana_admin_token';

export const getToken = () => typeof window !== 'undefined' ? localStorage.getItem(KEY) : null;
export const setToken = (t: string) => localStorage.setItem(KEY, t);
export const clearToken = () => localStorage.removeItem(KEY);

export class ApiError extends Error { constructor(public message: string, public status: number) { super(message); } }

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const raw = res.status === 204 ? '' : await res.text();
  let payload: any = null;
  if (raw.trim()) {
    try { payload = JSON.parse(raw); }
    catch { throw new ApiError(`Invalid JSON response from ${path} (HTTP ${res.status})`, res.status); }
  }
  if (!res.ok) {
    // A database reset or revoked session makes the cached admin JWT invalid.
    // Do not leave the dashboard rendering with endless 401 placeholders.
    if (res.status === 401 && typeof window !== 'undefined') {
      clearToken();
      if (window.location.pathname !== '/login') window.location.replace('/login');
    }
    const msg = payload?.message ?? res.statusText ?? 'Request failed';
    throw new ApiError(Array.isArray(msg) ? msg.join(', ') : String(msg), res.status);
  }
  if (!raw.trim() || res.status === 204) return null as T;
  return payload as T;
}

export const api = {
  get: <T>(path: string) => req<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => req<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => req<T>(path, { method: 'DELETE' }),
  patch: <T>(path: string, body?: unknown) => req<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
};

// ── Password recovery ───────────────────────────────────────────────────────

export async function requestPasswordReset(identifier: string) {
  return api.post<{ sent: boolean; channel: 'email' | 'sms' | null; phoneHint: string | null; emailHint: string | null }>(
    '/auth/password/forgot', { identifier },
  );
}

export async function resetPassword(identifier: string, code: string, password: string) {
  const result = await api.post<any>('/auth/password/reset', { identifier, code, password });
  if (result?.token) setToken(result.token);
  return result;
}
