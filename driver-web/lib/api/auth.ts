import { api, setToken } from './client';

export type ApiUser = {
  id: string;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
};

type AuthResponse = { token: string; user: ApiUser };

export async function login(identifier: string, password: string) {
  const result = await api.post<AuthResponse>('/auth/login', { identifier, password });
  setToken(result.token);
  return result;
}

export async function registerDriver(data: {
  phone: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  vehicle: string;
  plate: string;
  serviceType: 'BIKE' | 'ECONOMY' | 'COMFORT';
}) {
  const result = await api.post<AuthResponse>('/auth/register-driver', data);
  setToken(result.token);
  return result;
}

// ── Signing in with a code, and password recovery ───────────────────────────

export async function requestLoginCode(phone: string) {
  return api.post<{ sent: boolean }>('/auth/login/request-code', { phone });
}

export async function loginWithCode(phone: string, code: string) {
  const result = await api.post<any>('/auth/login/code', { phone, code });
  if (result?.token) setToken(result.token);
  return result;
}

export async function requestPasswordReset(identifier: string) {
  return api.post<{ sent: boolean; phoneHint: string | null }>(
    '/auth/password/forgot', { identifier },
  );
}

export async function resetPassword(phone: string, code: string, password: string) {
  const result = await api.post<any>('/auth/password/reset', { phone, code, password });
  if (result?.token) setToken(result.token);
  return result;
}
