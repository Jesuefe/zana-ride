import { GOOGLE_MAPS_EMBED_KEY } from './config';

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.maps?.Map) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const callbackName = '__zanaMapsReady';
    (window as any)[callbackName] = () => resolve();

    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      const poll = setInterval(() => {
        if ((window as any).google?.maps?.Map) {
          clearInterval(poll);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(poll); reject(new Error('Maps timeout')); }, 15000);
      return;
    }

    const script = document.createElement('script');
    // Stable v3 — no beta features, no mapId requirement
    // Google's own recommended loading pattern — loading=async here is a
    // URL parameter the Maps bootstrap loader reads to fetch its own
    // internal dependencies asynchronously, genuinely different from the
    // script.async DOM property below, which only controls this outer
    // tag's own loading and was never enough on its own to satisfy this.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_EMBED_KEY}&libraries=places&loading=async&callback=${callbackName}&v=3`;
    script.async = true;
    script.defer = true;
    script.onerror = () => { loadPromise = null; reject(new Error('Failed to load Google Maps')); };
    document.head.appendChild(script);
  });

  return loadPromise;
}
