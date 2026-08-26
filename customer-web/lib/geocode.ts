import { GOOGLE_MAPS_EMBED_KEY } from './config';

// Turns a lat/lng into a real street address for display. Falls back to a
// generic label if the request fails (offline, key not yet propagated, etc).
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_EMBED_KEY}`,
    );
    const data = await res.json();
    if (data.status === 'OK' && data.results?.[0]) {
      return data.results[0].formatted_address as string;
    }
    return null;
  } catch {
    return null;
  }
}
