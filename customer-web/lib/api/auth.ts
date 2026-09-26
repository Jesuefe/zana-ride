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

// Confirms the code register() automatically sends — separate from
// the older verifyOtp below, which is for a different, unused
// OTP-only signup path and would try to create a duplicate account.
export async function verifyPhone(code: string) {
  return api.post<{ id: string; phoneVerified: boolean }>('/auth/verify-phone', { code });
}

// useEmail switches delivery channel without starting over — the
// real foreign-SIM path: SMS never arrives, so ask for the same code
// by email instead, using the address already given at signup.
export async function resendVerification(useEmail?: boolean) {
  return api.post<{ sent: boolean }>('/auth/resend-verification', { email: useEmail });
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
  return api.post<{ sent: boolean; channel: 'email' | 'sms' | null; phoneHint: string | null; emailHint: string | null }>(
    '/auth/password/forgot', { identifier },
  );
}

export async function resetPassword(identifier: string, code: string, password: string) {
  const result = await api.post<AuthResponse>('/auth/password/reset', {
    identifier, code, password,
  });
  if (result?.token) setToken(result.token);
  return result;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return api.post<{ changed: boolean }>('/auth/password/change', {
    currentPassword, newPassword,
  });
}
