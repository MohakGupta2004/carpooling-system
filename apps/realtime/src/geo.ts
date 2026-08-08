const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough ETA (seconds) from remaining distance and current speed (m/s). */
export function etaSeconds(remainingM: number, speedMps?: number): number {
  const v = speedMps && speedMps > 1 ? speedMps : 8.3; // default ~30 km/h
  return Math.round(remainingM / v);
}
