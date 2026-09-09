import { api, setToken } from './client';

export type ApiUser = {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
};

type AuthResponse = { token: string; user: ApiUser };

export async function requestOtp(phone: string) {
  return api.post<{ sent: boolean }>('/auth/request-otp', { phone });
}

export async function verifyOtp(phone: string, code: string) {
  const result = await api.post<AuthResponse>('/auth/verify-otp', { phone, code });
  setToken(result.token);
  return result;
}

export async function register(data: {
  phone: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  const result = await api.post<AuthResponse>('/auth/register', data);
  setToken(result.token);
  return result;
}

export async function login(identifier: string, password: string) {
  const result = await api.post<AuthResponse>('/auth/login', { identifier, password });
  setToken(result.token);
  return result;
}

export async function updateProfile(data: { firstName?: string; lastName?: string }) {
  return api.patch<ApiUser>('/users/me', data);
}

export async function fetchMe() {
  return api.get<ApiUser & { wallet: { balance: number } }>('/users/me');
}

// ── Signing in with a code ──────────────────────────────────────────────────

export async function requestLoginCode(phone: string) {
  return api.post<{ sent: boolean }>('/auth/login/request-code', { phone });
}

export async function loginWithCode(phone: string, code: string) {
  const result = await api.post<AuthResponse>('/auth/login/code', { phone, code });
  if (result?.token) setToken(result.token);
  return result;
}

// ── Forgotten password ──────────────────────────────────────────────────────

export async function requestPasswordReset(identifier: string) {
  return api.post<{ sent: boolean; phoneHint: string | null }>(
    '/auth/password/forgot', { identifier },
  );
}

export async function resetPassword(phone: string, code: string, password: string) {
  const result = await api.post<AuthResponse>('/auth/password/reset', {
    phone, code, password,
  });
  if (result?.token) setToken(result.token);
  return result;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return api.post<{ changed: boolean }>('/auth/password/change', {
    currentPassword, newPassword,
  });
}
