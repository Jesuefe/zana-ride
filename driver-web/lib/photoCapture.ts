// Camera capture with a burned-in timestamp, location and name — the record
// a driver or customer can point to if a delivery is ever disputed.
//
// Uses Capacitor's Camera plugin rather than a raw <input type="file">. A
// plain file input hands control to the system camera app, and Android is
// free to kill the WebView process while that app is in the foreground to
// reclaim memory — when control returns, the app restarts because its JS
// state did not survive. Capacitor's plugin is built specifically to survive
// that round trip. Its web implementation falls back to a normal file picker
// in an ordinary browser, so the same call works everywhere.

export type CaptureResult = { base64: string; lat?: number; lng?: number };

/**
 * Open the camera and return a compressed photo. Location is best-effort —
 * a slow GPS fix or a denied permission must never block a delivery.
 */
export async function capturePhoto(): Promise<CaptureResult | null> {
  const [{ Camera, CameraResultType, CameraSource }, pos] = await Promise.all([
    import('@capacitor/camera'),
    readLocation(),
  ]);

  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      saveToGallery: false,
    });
    if (!photo.dataUrl) return null;
    return { base64: photo.dataUrl, lat: pos?.lat, lng: pos?.lng };
  } catch {
    // The person cancelled, or the camera was unavailable.
    return null;
  }
}

function readLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), 4000);
    navigator.geolocation.getCurrentPosition(
      p => { clearTimeout(timer); resolve({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => { clearTimeout(timer); resolve(null); },
      { enableHighAccuracy: true, timeout: 3800 },
    );
  });
}

/**
 * Reverse-geocode when Google Maps is already loaded on the page; otherwise
 * fall back to plain coordinates rather than block on a network call.
 */
function reverseGeocode(lat: number, lng: number): Promise<string> {
  return new Promise(resolve => {
    const G = (window as any).google?.maps;
    if (!G) return resolve(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    new G.Geocoder().geocode({ location: { lat, lng } }, (results: any, status: any) => {
      resolve(
        status === 'OK' && results?.[0]?.formatted_address
          ? results[0].formatted_address
          : `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      );
    });
  });
}

/**
 * Burns a name badge in the top-left and a timestamp + location band across
 * the bottom, the way a dedicated GPS camera app does — so the proof lives
 * inside the image itself, not just in a database column that can be edited
 * separately from the photo.
 */
export async function stampPhoto(
  base64: string,
  name: string,
  coords?: { lat: number; lng: number },
): Promise<string> {
  const address = coords ? await reverseGeocode(coords.lat, coords.lng) : null;

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = base64;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return base64;

  ctx.drawImage(img, 0, 0);

  const scale = Math.max(1, img.width / 1000);
  const pad = 14 * scale;

  // Name badge, top-left.
  ctx.font = `${Math.round(15 * scale)}px system-ui, sans-serif`;
  const nameText = name;
  const nameWidth = ctx.measureText(nameText).width;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  roundedRect(ctx, pad * 0.6, pad * 0.6, nameWidth + pad * 1.4, 28 * scale, 6 * scale);
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'middle';
  ctx.fillText(nameText, pad * 0.6 + pad * 0.7, pad * 0.6 + 14 * scale);

  // Timestamp + location band, bottom edge.
  const now = new Date();
  const dateText = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeText = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const bottomLine1 = `${dateText}  ·  ${timeText}`;
  const bottomLine2 = address ?? 'Location unavailable';

  const bandHeight = 56 * scale;
  const gradient = ctx.createLinearGradient(0, canvas.height - bandHeight, 0, canvas.height);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.72)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, canvas.height - bandHeight, canvas.width, bandHeight);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${Math.round(14 * scale)}px system-ui, sans-serif`;
  ctx.fillText(bottomLine1, pad, canvas.height - bandHeight * 0.58);
  ctx.font = `${Math.round(12.5 * scale)}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  // Long addresses are trimmed rather than wrapped — a second line would
  // eat further into the photo itself.
  const maxWidth = canvas.width - pad * 2;
  let line2 = bottomLine2;
  while (ctx.measureText(line2).width > maxWidth && line2.length > 4) {
    line2 = line2.slice(0, -4) + '…';
  }
  ctx.fillText(line2, pad, canvas.height - bandHeight * 0.22);

  // Zana watermark, bottom-right — a quiet source mark, not a logo splash.
  ctx.font = `700 ${Math.round(12 * scale)}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  const wm = 'ZANA';
  const wmWidth = ctx.measureText(wm).width;
  ctx.fillText(wm, canvas.width - wmWidth - pad, canvas.height - bandHeight * 0.58);

  return canvas.toDataURL('image/jpeg', 0.85);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}
