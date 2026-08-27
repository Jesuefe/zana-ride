import { api } from './client';

export type ServiceType = 'BIKE' | 'ECONOMY' | 'COMFORT';

export type RideEstimateResponse = { distanceKm: number; durationMinutes: number; fare: number };

export async function estimateRide(
  pickup: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  serviceType: ServiceType,
) {
  return api.post<RideEstimateResponse>('/rides/estimate', { serviceType, pickup, destination });
}

export type ApiTrip = {
  id: string;
  status: string;
  estimatedFare: number;
  driverId: string | null;
  pickupLat: number;
  pickupLng: number;
  destinationLat: number;
  destinationLng: number;
  driver?: { id: string; user: { firstName: string | null }; vehicle: string; plate: string; rating: number } | null;
};

export async function createRide(data: {
  serviceType: ServiceType;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
}) {
  return api.post<ApiTrip>('/rides', data);
}

// Books multiple motos at once for a group — each gets its own independent
// trip and driver, but they share a groupId so the tracking screen can show
// them together.
export async function createRideGroup(
  data: {
    serviceType: ServiceType;
    pickupAddress: string;
    pickupLat: number;
    pickupLng: number;
    destinationAddress: string;
    destinationLat: number;
    destinationLng: number;
  },
  count: number,
) {
  return api.post<(ApiTrip & { groupId: string | null; groupSeatIndex: number | null })[]>('/rides', {
    ...data,
    count,
  });
}

export async function fetchTripGroup(groupId: string) {
  return api.get<(ApiTrip & { groupId: string | null; groupSeatIndex: number | null })[]>(`/rides/group/${groupId}`);
}

export async function fetchTrip(id: string) {
  return api.get<ApiTrip>(`/rides/${id}`);
}

export async function cancelRide(id: string) {
  return api.post<ApiTrip>(`/rides/${id}/cancel`);
}

export async function fetchWallet() {
  return api.get<{ balance: number; transactions: { id: string; amount: number; reference: string | null; createdAt: string; status: string }[] }>(
    '/wallet/me',
  );
}

export async function initiateMomoTopUp(phone: string, amount: number) {
  return api.post<{ ref: string; status: string }>('/wallet/top-up/momo', { phone, amount });
}

export async function checkMomoTopUpStatus(ref: string) {
  return api.get<{ status: string; balance?: number }>(`/wallet/top-up/momo/${ref}/status`);
}
