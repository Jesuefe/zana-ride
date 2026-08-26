import { TripRequest } from '../types';

export const KIGALI_CENTER = {
  latitude: -1.9536,
  longitude: 30.0605,
};

const customerNames = ['Chantal M.', 'Patrick I.', 'Diane U.', 'Emmanuel R.'];
const pickupSpots = [
  { name: 'Kigali Heights', coords: { latitude: -1.9468, longitude: 30.0913 } },
  { name: 'Nyamirambo', coords: { latitude: -1.9767, longitude: 30.0431 } },
  { name: 'Remera', coords: { latitude: -1.9558, longitude: 30.1044 } },
];
const dropoffSpots = [
  { name: 'Kigali Convention Centre', coords: { latitude: -1.9536, longitude: 30.0937 } },
  { name: 'Kigali International Airport', coords: { latitude: -1.9686, longitude: 30.1395 } },
  { name: 'Kimihurura', coords: { latitude: -1.9557, longitude: 30.0925 } },
];

export function mockIncomingRequest(near: { latitude: number; longitude: number }): TripRequest {
  const pickup = pickupSpots[Math.floor(Math.random() * pickupSpots.length)];
  const dropoff = dropoffSpots[Math.floor(Math.random() * dropoffSpots.length)];
  const distanceToPickupKm = Math.round((0.6 + Math.random() * 2) * 10) / 10;
  const tripDistanceKm = Math.round((2 + Math.random() * 6) * 10) / 10;

  return {
    id: 'req-' + Date.now(),
    pickupAddress: pickup.name,
    pickupCoords: pickup.coords,
    destinationAddress: dropoff.name,
    destinationCoords: dropoff.coords,
    distanceToPickupKm,
    tripDistanceKm,
    estimatedEarningsRwf: Math.round(800 + tripDistanceKm * 350),
    serviceType: Math.random() > 0.5 ? 'BIKE' : 'ECONOMY',
    customerName: customerNames[Math.floor(Math.random() * customerNames.length)],
    customerRating: Math.round((4.5 + Math.random() * 0.5) * 10) / 10,
  };
}
