'use client';

import { loadGoogleMaps } from './mapsLoader';

export type PlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

// Biases results toward Kigali so local searches rank first, and restricts
// to Rwanda so drivers never get routed somewhere impossible.
const KIGALI_BOUNDS_CENTER = { lat: -1.9536, lng: 30.0605 };

let sessionToken: google.maps.places.AutocompleteSessionToken | null = null;

// Google bills autocomplete per session (keystrokes grouped together with a
// final place lookup), so we hold one token across a search and reset it
// after a selection.
function getSessionToken() {
  if (typeof google === 'undefined') return undefined;
  if (!sessionToken) sessionToken = new google.maps.places.AutocompleteSessionToken();
  return sessionToken;
}

export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  if (!query.trim()) return [];
  await loadGoogleMaps();

  return new Promise((resolve) => {
    const service = new google.maps.places.AutocompleteService();
    service.getPlacePredictions(
      {
        input: query,
        sessionToken: getSessionToken(),
        componentRestrictions: { country: 'rw' },
        locationBias: { center: KIGALI_BOUNDS_CENTER, radius: 30000 },
      },
      (predictions, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
          resolve([]);
          return;
        }
        resolve(
          predictions.map((p) => ({
            placeId: p.place_id,
            primaryText: p.structured_formatting.main_text,
            secondaryText: p.structured_formatting.secondary_text ?? '',
          })),
        );
      },
    );
  });
}

export async function getPlaceCoordinates(
  placeId: string,
): Promise<{ lat: number; lng: number; address: string } | null> {
  await loadGoogleMaps();

  return new Promise((resolve) => {
    // PlacesService needs a DOM node or map to attach to; a detached div is
    // the documented way to use it without rendering a second map.
    const service = new google.maps.places.PlacesService(document.createElement('div'));
    service.getDetails(
      { placeId, fields: ['geometry', 'formatted_address', 'name'], sessionToken: getSessionToken() },
      (place, status) => {
        sessionToken = null; // selection ends the billing session
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
          resolve(null);
          return;
        }
        resolve({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address ?? place.name ?? '',
        });
      },
    );
  });
}
