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
  serviceType: ServiceType;
  estimatedFare: number;
  driverId: string | null;
  pickupLat: number;
  pickupLng: number;
  destinationLat: number;
  destinationLng: number;
  driver?: {
    id: string;
    user: { firstName: string | null; phone?: string | null };
    vehicle: string;
    plate: string;
    rating: number;
    lastLat: number | null;
    lastLng: number | null;
  } | null;
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

export type NearbyDriver = {
  id: string;
  lat: number;
  lng: number;
  serviceType: ServiceType;
  distanceKm: number;
};

// Real available drivers near the passenger, straight from the database —
// replaces the simulated markers we were scattering on the map before.
export async function fetchNearbyDrivers(lat: number, lng: number, serviceType: ServiceType, radiusKm = 5) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    serviceType,
    radiusKm: String(radiusKm),
  });
  return api.get<NearbyDriver[]>(`/drivers/nearby?${params.toString()}`);
}

export type FareConfig = {
  serviceType: ServiceType;
  base: number;
  perKm: number;
  perMin: number;
  bookingFee: number;
  minimum: number;
};

export async function fetchFares() {
  return api.get<FareConfig[]>('/fares');
}

// Marketplace types for food/gifts ordering
export type MarketplaceMerchant = {
  id: string;
  businessName: string;
  branch: string | null;
  category: string;
  products: MarketplaceProduct[];
};

export type MarketplaceProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  category: string;
  available: boolean;
};

export async function fetchMarketplace(category?: string) {
  const q = category ? `?category=${category}` : '';
  return api.get<MarketplaceMerchant[]>(`/marketplace${q}`);
}

export async function createOrder(data: {
  merchantId: string;
  items: { productId: string; quantity: number }[];
  dropoffAddress?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  locationCode?: string;
  receiverPhone?: string;
  note?: string;
}) {
  return api.post<any>('/orders', data);
}

export async function fetchMyOrders() {
  return api.get<any[]>('/orders');
}
