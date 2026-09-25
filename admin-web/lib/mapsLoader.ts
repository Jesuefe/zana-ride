let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.maps?.Map) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const callbackName = '__zanaAdminMapsReady';
    (window as any)[callbackName] = () => resolve();
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      const poll = setInterval(() => {
        if ((window as any).google?.maps?.Map) { clearInterval(poll); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(poll); reject(new Error('Maps timeout')); }, 15000);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyD4o-fXIpmGozrClaP1niC407cgRCrzSTI&libraries=geometry&loading=async&callback=' + callbackName + '&v=3';
    script.async = true; script.defer = true;
    script.onerror = () => { loadPromise = null; reject(new Error('Failed to load Google Maps')); };
    document.head.appendChild(script);
  });
  return loadPromise;
}
