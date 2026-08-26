import { GOOGLE_MAPS_EMBED_KEY } from '../lib/config';

type LatLng = { lat: number; lng: number };

export default function DirectionsMap({
  origin,
  destination,
  height = 220,
}: {
  origin: LatLng;
  destination: LatLng;
  height?: number;
}) {
  const src = `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_EMBED_KEY}&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=driving`;

  return (
    <iframe
      title="Route map"
      src={src}
      style={{ width: '100%', height, border: 0 }}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
