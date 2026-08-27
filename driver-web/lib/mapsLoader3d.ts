// Loads the Google Maps bootstrap on the "alpha" version channel — the
// Photorealistic 3D Maps feature (maps3d library) is experimental/Preview
// and typically isn't available on the default stable channel.
import { GOOGLE_MAPS_EMBED_KEY } from './config';

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps3d(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.maps?.importLibrary) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    (window as any).__zanaMapsAlphaResolve = resolve;
    const script = document.createElement('script');
    script.textContent = `
      (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=\`https://maps.\${c}apis.com/maps/api/js?\`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({key:"${GOOGLE_MAPS_EMBED_KEY}",v:"alpha"});
    `;
    document.head.appendChild(script);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps (alpha)'));
    // The inline bootstrap doesn't fire a normal onload reliably, so also
    // resolve as soon as the API object exists.
    const check = setInterval(() => {
      if ((window as any).google?.maps?.importLibrary) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });

  return loadPromise;
}
