import { api } from './client';

export type PackageWeight = 'UNDER_1KG' | 'KG_1_TO_5' | 'KG_5_TO_10' | 'KG_10_TO_20' | 'OVER_20KG';

export const WEIGHT_OPTIONS: { value: PackageWeight; label: string }[] = [
  { value: 'UNDER_1KG', label: 'Under 1 kg' },
  { value: 'KG_1_TO_5', label: '1 – 5 kg' },
  { value: 'KG_5_TO_10', label: '5 – 10 kg' },
  { value: 'KG_10_TO_20', label: '10 – 20 kg' },
  { value: 'OVER_20KG', label: 'Over 20 kg' },
];

export type LocationCode = {
  code: string;
  lat: number;
  lng: number;
  address: string | null;
  expiresAt: string;
};

// Generates a short code standing in for the caller's exact GPS position,
// so a receiver who can't describe their address can just share the code.
export async function createLocationCode(lat: number, lng: number, address?: string) {
  return api.post<LocationCode>('/location-codes', { lat, lng, address });
}

export async function resolveLocationCode(code: string) {
  return api.get<LocationCode>(`/location-codes/${encodeURIComponent(code)}`);
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

export type Delivery = {
  id: string;
  itemDescription: string;
  weight: PackageWeight;
  imageUrl: string | null;
  pickupAddress: string;
  dropoffAddress: string;
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
  return api.post<Delivery>('/deliveries', data);
}

export async function fetchMyDeliveries() {
  return api.get<Delivery[]>('/deliveries');
}
