import { api, setToken } from './client';

export type MerchantProfile = {
  id: string;
  businessName: string;
  branch: string | null;
  user: { firstName: string | null; lastName: string | null; phone: string; wallet: { balance: number } | null };
};

export type ApiUser = { id: string; phone: string; firstName: string | null; lastName: string | null; role: string };

export async function login(identifier: string, password: string) {
  const result = await api.post<{ token: string; user: ApiUser }>('/auth/login', { identifier, password });
  setToken(result.token);
  return result;
}

export async function requestOtp(phone: string) {
  return api.post<{ sent: boolean }>('/auth/request-otp', { phone });
}

export async function verifyOtp(phone: string, code: string) {
  const result = await api.post<{ token: string; user: ApiUser }>('/auth/verify-otp', { phone, code });
  setToken(result.token);
  return result;
}

export async function fetchMyMerchant() {
  return api.get<MerchantProfile>('/merchant/me');
}

export async function fetchWallet() {
  return api.get<{
    balance: number;
    transactions: { id: string; amount: number; reference: string | null; createdAt: string }[];
  }>('/wallet/me');
}

export type PackageWeight = 'UNDER_1KG' | 'KG_1_TO_5' | 'KG_5_TO_10' | 'KG_10_TO_20' | 'OVER_20KG';

export const WEIGHT_OPTIONS: { value: PackageWeight; label: string }[] = [
  { value: 'UNDER_1KG', label: 'Under 1 kg' },
  { value: 'KG_1_TO_5', label: '1 – 5 kg' },
  { value: 'KG_5_TO_10', label: '5 – 10 kg' },
  { value: 'KG_10_TO_20', label: '10 – 20 kg' },
  { value: 'OVER_20KG', label: 'Over 20 kg' },
];

export type Delivery = {
  id: string;
  itemDescription: string;
  weight: PackageWeight;
  imageUrl: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  receiverName: string | null;
  receiverPhone: string;
  distanceKm: number;
  fee: number;
  status: string;
  createdAt: string;
};

export async function createDelivery(data: {
  itemDescription: string;
  weight: PackageWeight;
  imageBase64?: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  locationCode?: string;
  receiverName?: string;
  receiverPhone: string;
}) {
  return api.post<Delivery>('/merchant/deliveries', data);
}

export async function fetchDeliveries() {
  return api.get<Delivery[]>('/merchant/deliveries');
}

export async function quoteDelivery(data: {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  weight: PackageWeight;
}) {
  return api.post<{ distanceKm: number; durationMinutes: number; fee: number }>('/deliveries/quote', data);
}

export type LocationCode = {
  code: string;
  lat: number;
  lng: number;
  address: string | null;
  expiresAt: string;
};

export async function resolveLocationCode(code: string) {
  return api.get<LocationCode>(`/location-codes/${encodeURIComponent(code)}`);
}

// Aliases kept so existing pages that imported the older names keep working.
export type ApiMerchant = MerchantProfile;
export type ApiDelivery = Delivery;
export type ApiWallet = {
  balance: number;
  transactions: { id: string; amount: number; reference: string | null; createdAt: string }[];
};
