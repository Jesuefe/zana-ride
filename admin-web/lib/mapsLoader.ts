let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.maps?.Map) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const callbackName = '__zanaAdminMapsReady';
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) { loadPromise = null; reject(error); } else resolve();
    };
    const timeout = setTimeout(() => finish(new Error('Google Maps did not respond within 15 seconds. Check network access, API key restrictions and Maps JavaScript API billing.')), 15000);
    (window as any)[callbackName] = () => finish();
    const existing = document.querySelector('script[src*="maps.googleapis.com"]') as HTMLScriptElement | null;
    if (existing) {
      const poll = setInterval(() => { if ((window as any).google?.maps?.Map) { clearInterval(poll); finish(); } }, 150);
      existing.addEventListener('error', () => { clearInterval(poll); finish(new Error('Google Maps script failed to download.')); }, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyD4o-fXIpmGozrClaP1niC407cgRCrzSTI&libraries=geometry,places&loading=async&callback=' + callbackName + '&v=3';
    script.async = true; script.defer = true;
    script.onerror = () => finish(new Error('Google Maps script failed to download.'));
    document.head.appendChild(script);
  });
  return loadPromise;
}
