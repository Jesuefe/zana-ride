import { api, setToken } from './client';

export type ApiUser = {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
};

export async function requestOtp(phone: string) {
  return api.post<{ sent: boolean }>('/auth/request-otp', { phone });
}

export async function verifyOtp(phone: string, code: string) {
  const result = await api.post<{ token: string; user: ApiUser }>('/auth/verify-otp', { phone, code });
  setToken(result.token);
  return result;
}
