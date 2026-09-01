import { GOOGLE_MAPS_EMBED_KEY } from './config';

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  // Already loaded
  if ((window as any).google?.maps?.Map) return Promise.resolve();

  // Already loading
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const callbackName = '__zanaMapsReady';
    (window as any)[callbackName] = () => resolve();

    // Check if script already injected (e.g. from a previous render cycle)
    const existing = document.querySelector(`script[src*="maps.googleapis.com"]`);
    if (existing) {
      // Script exists but API not ready yet — poll until it is
      const poll = setInterval(() => {
        if ((window as any).google?.maps?.Map) {
          clearInterval(poll);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(poll); reject(new Error('Maps timeout')); }, 10000);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_EMBED_KEY}&libraries=places,marker&callback=${callbackName}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load Google Maps'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
