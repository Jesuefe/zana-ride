import { GOOGLE_MAPS_EMBED_KEY } from './config';

let loadPromise: Promise<void> | null = null;

// Injects the Google Maps JavaScript SDK exactly once, no matter how many
// components request it. Every branded map on the site shares this.
export function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_EMBED_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
