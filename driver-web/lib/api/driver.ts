import { api } from './client';

export type DriverProfile = {
  id: string;
  vehicle: string;
  plate: string;
  serviceType: 'BIKE' | 'ECONOMY' | 'COMFORT';
  approvalStatus: string;
  onlineStatus: 'OFFLINE' | 'ONLINE' | 'BUSY';
  rating: number;
  user: { firstName: string | null; lastName: string | null; phone: string };
};

export type DriverTrip = {
  id: string;
  status: string;
  estimatedFare: number;
  serviceType?: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
  customer: { firstName: string | null; lastName: string | null; phone: string };
};

export async function fetchMyDriverProfile() {
  return api.get<DriverProfile>('/driver/me');
}

export async function goOnline() {
  return api.patch<DriverProfile>('/driver/go-online');
}

export async function goOffline() {
  return api.patch<DriverProfile>('/driver/go-offline');
}

export async function updateDriverLocation(lat: number, lng: number) {
  return api.post('/driver/location', { lat, lng });
}

export async function fetchSearchingTrips() {
  return api.get<DriverTrip[]>('/driver/rides/searching');
}

export async function fetchMyActiveTrip() {
  return api.get<DriverTrip | null>('/driver/rides/active');
}

export async function acceptTrip(tripId: string) {
  return api.post<DriverTrip>(`/driver/rides/${tripId}/accept`);
}

export async function declineTrip(tripId: string) {
  return api.post<DriverTrip>(`/driver/rides/${tripId}/decline`);
}

export async function arriveAtPickup(tripId: string) {
  return api.post<DriverTrip>(`/driver/rides/${tripId}/arrive`);
}

export async function startTrip(tripId: string) {
  return api.post<DriverTrip>(`/driver/rides/${tripId}/start`);
}

export async function completeTrip(tripId: string) {
  return api.post<DriverTrip>(`/driver/rides/${tripId}/complete`);
}

export async function fetchEarnings() {
  return api.get<{ todayTotal: number; todayTrips: number; allTimeTotal: number }>('/driver/earnings');
}

export async function updateDriverMode(mode: 'RIDES' | 'DELIVERIES' | 'BOTH') {
  return api.patch<{ driverMode: string }>('/driver/mode', { mode });
}

export type PendingDelivery = {
  id: string;
  itemDescription: string;
  weight: string;
  imageUrl: string | null;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  fee: number;
  distanceKm: number;
  customer?: { firstName: string | null } | null;
  merchant?: { businessName: string } | null;
};

export async function fetchPendingDeliveries(lat: number, lng: number) {
  return api.get<PendingDelivery[]>(`/driver/deliveries/pending?lat=${lat}&lng=${lng}`);
}

export async function acceptDelivery(id: string) {
  return api.post(`/driver/deliveries/${id}/accept`);
}
