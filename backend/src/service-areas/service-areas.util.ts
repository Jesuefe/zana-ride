// GeoJSON coordinates are [lng, lat].
type Ring = number[][];

function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = [Number(ring[i][0]), Number(ring[i][1])];
    const [xj, yj] = [Number(ring[j][0]), Number(ring[j][1])];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// A polygon is [outerRing, ...holes].
function inPolygon(lng: number, lat: number, polygon: Ring[]): boolean {
  if (!polygon?.length || !inRing(lng, lat, polygon[0])) return false;
  return !polygon.slice(1).some(hole => inRing(lng, lat, hole));
}

export function pointInBoundary(lat: number, lng: number, boundary: any): boolean {
  if (!boundary || !Array.isArray(boundary.coordinates)) return false;
  if (boundary.type === 'Polygon') return inPolygon(lng, lat, boundary.coordinates);
  if (boundary.type === 'MultiPolygon') return boundary.coordinates.some((p: Ring[]) => inPolygon(lng, lat, p));
  return false;
}
