import { pointInBoundary } from './service-areas.util';

const square = { type: 'Polygon', coordinates: [[[30, -2], [31, -2], [31, -1], [30, -1], [30, -2]]] };
const withHole = { type: 'Polygon', coordinates: [square.coordinates[0], [[30.4, -1.6], [30.6, -1.6], [30.6, -1.4], [30.4, -1.4], [30.4, -1.6]]] };

describe('pointInBoundary', () => {
  it('detects points inside and outside a polygon ([lng, lat] order)', () => {
    expect(pointInBoundary(-1.5, 30.5, square)).toBe(true);
    expect(pointInBoundary(-1.5, 31.5, square)).toBe(false);
  });
  it('respects holes', () => {
    expect(pointInBoundary(-1.5, 30.5, withHole)).toBe(false);
    expect(pointInBoundary(-1.1, 30.1, withHole)).toBe(true);
  });
  it('supports MultiPolygon and rejects bad input', () => {
    expect(pointInBoundary(-1.5, 30.5, { type: 'MultiPolygon', coordinates: [square.coordinates] })).toBe(true);
    expect(pointInBoundary(0, 0, null)).toBe(false);
  });
});
