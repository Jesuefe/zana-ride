import { GOOGLE_MAPS_EMBED_KEY } from './config';

const GOOGLE_MAPS_KEY_PATTERN = /^AIza[0-9A-Za-z_-]{30,}$/;
let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.maps?.Map) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const apiKey = GOOGLE_MAPS_EMBED_KEY.trim();
  if (!GOOGLE_MAPS_KEY_PATTERN.test(apiKey)) {
    return Promise.reject(
      new Error(
        'Google Maps API key is missing or malformed. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in the production build environment.',
      ),
    );
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const callbackName = '__zanaMapsReady';
    const previousAuthFailure = (window as any).gm_authFailure;
    let settled = false;
    let pollId: number | undefined;
    let timeoutId: number | undefined;

    const cleanup = () => {
      if (pollId !== undefined) window.clearInterval(pollId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if ((window as any)[callbackName] === onReady) {
        delete (window as any)[callbackName];
      }
      if ((window as any).gm_authFailure === onAuthFailure) {
        if (previousAuthFailure) (window as any).gm_authFailure = previousAuthFailure;
        else delete (window as any).gm_authFailure;
      }
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      loadPromise = null;
      reject(new Error(message));
    };

    const onReady = () => {
      if (settled) return;
      if (!(window as any).google?.maps?.Map) return;
      settled = true;
      cleanup();
      resolve();
    };

    const onAuthFailure = () => {
      try {
        if (typeof previousAuthFailure === 'function') previousAuthFailure();
      } finally {
        fail(
          'Google Maps rejected the API key. Check its website restrictions and Maps JavaScript API permission in Google Cloud.',
        );
      }
    };

    (window as any)[callbackName] = onReady;
    (window as any).gm_authFailure = onAuthFailure;

    // Poll as well as using the callback so an existing Maps script can be
    // reused safely when another page component started loading it first.
    pollId = window.setInterval(onReady, 100);
    timeoutId = window.setTimeout(
      () => fail('Google Maps did not finish loading within 15 seconds.'),
      15000,
    );

    const existing = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]',
    ) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener(
        'error',
        () => fail('The Google Maps JavaScript API script failed to load.'),
        { once: true },
      );
      onReady();
      return;
    }

    const script = document.createElement('script');
    script.id = 'zana-google-maps';
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,marker,routes&loading=async&callback=${callbackName}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onerror = () =>
      fail('The Google Maps JavaScript API script failed to load.');
    document.head.appendChild(script);
  });

  return loadPromise;
}
