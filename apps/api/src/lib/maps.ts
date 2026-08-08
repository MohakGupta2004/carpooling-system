import type { LatLng } from '@carpool/types';

import { env } from '../config/env.js';

const R = 6371000; // earth radius m
const toRad = (d: number) => (d * Math.PI) / 180;

/** Straight-line distance (meters). Fallback when no maps key / for scoring. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Decode a Google encoded polyline into lat/lng points (road geometry w/ turns). */
export function decodePolyline(encoded: string): LatLng[] {
  const pts: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    pts.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return pts;
}

export interface RouteResult {
  distanceM: number;
  durationS: number;
  polyline: string | null;
  provider: 'google' | 'estimate';
}

/**
 * Directions. Uses Google Directions when a key is configured; otherwise
 * returns a road-factor estimate so the whole flow works offline in dev.
 */
export async function getRoute(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[] = []
): Promise<RouteResult> {
  if (env.googleMapsKey) {
    try {
      const wp = waypoints.map((w) => `${w.lat},${w.lng}`).join('|');
      const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
      url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
      url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
      if (wp) url.searchParams.set('waypoints', wp);
      url.searchParams.set('key', env.googleMapsKey);
      const res = await fetch(url);
      const json = (await res.json()) as any;
      const route = json.routes?.[0];
      if (route) {
        const leg = route.legs.reduce(
          (acc: { d: number; t: number }, l: any) => ({
            d: acc.d + l.distance.value,
            t: acc.t + l.duration.value,
          }),
          { d: 0, t: 0 }
        );
        return {
          distanceM: leg.d,
          durationS: leg.t,
          polyline: route.overview_polyline?.points ?? null,
          provider: 'google',
        };
      }
    } catch {
      /* fall through to estimate */
    }
  }

  // Estimate: haversine × road factor, ~28 km/h avg urban speed.
  const straight = [origin, ...waypoints, destination].reduce(
    (acc, pt, i, arr) => (i === 0 ? acc : acc + haversine(arr[i - 1]!, pt)),
    0
  );
  const distanceM = Math.round(straight * 1.35);
  const durationS = Math.round((distanceM / 1000 / 28) * 3600);
  return { distanceM, durationS, polyline: null, provider: 'estimate' };
}

export interface RoutePlan extends RouteResult {
  /** optimized visiting order of the input waypoints (indices into `waypoints`) */
  order: number[];
}

/** Greedy nearest-neighbour order from `start` — fallback when no maps key. */
function nearestNeighborOrder(start: LatLng, pts: LatLng[]): number[] {
  const order: number[] = [];
  const used = new Set<number>();
  let cur = start;
  for (let k = 0; k < pts.length; k++) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      if (used.has(i)) continue;
      const d = haversine(cur, pts[i]!);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) break;
    used.add(best);
    order.push(best);
    cur = pts[best]!;
  }
  return order;
}

/**
 * Multi-stop route that also OPTIMIZES the pickup order. Google Directions with
 * `waypoints=optimize:true` returns the best visiting order (`waypoint_order`);
 * we fall back to nearest-neighbour when no key is configured.
 */
export async function getOptimizedRoute(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[]
): Promise<RoutePlan> {
  if (env.googleMapsKey && waypoints.length > 0) {
    try {
      const wp = 'optimize:true|' + waypoints.map((w) => `${w.lat},${w.lng}`).join('|');
      const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
      url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
      url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
      url.searchParams.set('waypoints', wp);
      url.searchParams.set('key', env.googleMapsKey);
      const res = await fetch(url);
      const json = (await res.json()) as any;
      const route = json.routes?.[0];
      if (route) {
        const leg = route.legs.reduce(
          (acc: { d: number; t: number }, l: any) => ({
            d: acc.d + l.distance.value,
            t: acc.t + l.duration.value,
          }),
          { d: 0, t: 0 }
        );
        return {
          distanceM: leg.d,
          durationS: leg.t,
          polyline: route.overview_polyline?.points ?? null,
          order: (route.waypoint_order as number[]) ?? waypoints.map((_, i) => i),
          provider: 'google',
        };
      }
    } catch {
      /* fall through */
    }
  }

  const order = nearestNeighborOrder(origin, waypoints);
  const seq = [origin, ...order.map((i) => waypoints[i]!), destination];
  const straight = seq.reduce(
    (acc, pt, i) => (i === 0 ? acc : acc + haversine(seq[i - 1]!, pt)),
    0
  );
  const distanceM = Math.round(straight * 1.35);
  return {
    distanceM,
    durationS: Math.round((distanceM / 1000 / 28) * 3600),
    polyline: null,
    order,
    provider: 'estimate',
  };
}
