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

// A normal fetch() call made from inside a backgrounded WebView gets
// throttled by Android after about 5 minutes — this is a real, documented
// limitation, not a guess, confirmed by Capacitor's own maintainers and the
// background-geolocation plugin's own README. A driver whose screen has
// locked or who has switched to another app would silently stop updating
// their position exactly when it matters most. Routing this one call
// through Capacitor's native HTTP bridge instead avoids that throttling
// entirely — every other API call in the app is untouched and keeps using
// plain fetch, so this doesn't risk the wider regressions some Capacitor
// versions have had when native HTTP is patched in globally.
export async function updateDriverLocation(lat: number, lng: number) {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { CapacitorHttp } = await import('@capacitor/core');
      const { getToken, API_BASE_URL } = await import('./client');
      const token = getToken();
      await CapacitorHttp.post({
        url: `${API_BASE_URL}/driver/location`,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        data: { lat, lng },
      });
      return;
    }
  } catch {
    // Fall through to the normal path below — a browser tab (no native
    // bridge available at all) is expected to land here every time.
  }
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

export async function declineTrip(tripId: string, reason: string) {
  return api.post<DriverTrip>(`/driver/rides/${tripId}/decline`, { reason });
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
  return api.get<{ todayEarnings: number; weekEarnings: number; totalEarnings: number; totalTrips: number; totalDeliveries: number; walletBalance: number }>('/driver/earnings');
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
