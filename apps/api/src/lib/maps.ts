import type { LatLng } from '@carpool/types';

import { env } from '../config/env.js';
import { logger } from './logger.js';

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

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

const waypoint = (p: LatLng) => ({
  location: { latLng: { latitude: p.lat, longitude: p.lng } },
});

interface ComputedRoute {
  distanceMeters?: number;
  /** Routes API returns a protobuf duration string, e.g. "4523s". */
  duration?: string;
  polyline?: { encodedPolyline?: string };
  optimizedIntermediateWaypointIndex?: number[];
}

/**
 * One call to Routes API `computeRoutes`. Returns null (and logs why) on any
 * failure so callers can drop to the offline estimate.
 *
 * NOTE: the legacy Directions API (`maps.googleapis.com/maps/api/directions`)
 * is not available to Cloud projects created after March 2025 — it answers
 * REQUEST_DENIED / "You're calling a legacy API". Routes API replaces it.
 */
async function computeRoutes(
  origin: LatLng,
  destination: LatLng,
  intermediates: LatLng[],
  optimize: boolean
): Promise<ComputedRoute | null> {
  const fields = [
    'routes.distanceMeters',
    'routes.duration',
    'routes.polyline.encodedPolyline',
    ...(optimize ? ['routes.optimizedIntermediateWaypointIndex'] : []),
  ];
  try {
    const res = await fetch(ROUTES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': env.googleMapsKey,
        'X-Goog-FieldMask': fields.join(','),
      },
      body: JSON.stringify({
        origin: waypoint(origin),
        destination: waypoint(destination),
        intermediates: intermediates.map(waypoint),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        optimizeWaypointOrder: optimize && intermediates.length > 0,
        polylineEncoding: 'ENCODED_POLYLINE',
      }),
    });
    const json = (await res.json()) as { routes?: ComputedRoute[]; error?: { message?: string } };
    if (!res.ok || json.error) {
      // Silent fallbacks are why a straight line shows up on the map with no
      // clue as to the cause — always say what Google rejected.
      logger.warn(
        { status: res.status, err: json.error?.message },
        'Routes API failed — falling back to straight-line estimate'
      );
      return null;
    }
    return json.routes?.[0] ?? null;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Routes API request threw — using estimate');
    return null;
  }
}

/** Routes API durations are strings like "4523s". */
const parseDuration = (d: string | undefined): number => Math.round(Number.parseFloat(d ?? '0'));

/**
 * Directions. Uses the Google Routes API when a key is configured; otherwise
 * returns a road-factor estimate so the whole flow works offline in dev.
 */
export async function getRoute(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[] = []
): Promise<RouteResult> {
  if (env.googleMapsKey) {
    const route = await computeRoutes(origin, destination, waypoints, false);
    if (route?.distanceMeters) {
      return {
        distanceM: route.distanceMeters,
        durationS: parseDuration(route.duration),
        polyline: route.polyline?.encodedPolyline ?? null,
        provider: 'google',
      };
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
 * Multi-stop route that also OPTIMIZES the pickup order. Routes API with
 * `optimizeWaypointOrder` returns the best visiting order
 * (`optimizedIntermediateWaypointIndex`); we fall back to nearest-neighbour
 * when no key is configured.
 */
export async function getOptimizedRoute(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[]
): Promise<RoutePlan> {
  if (env.googleMapsKey && waypoints.length > 0) {
    const route = await computeRoutes(origin, destination, waypoints, true);
    if (route?.distanceMeters) {
      return {
        distanceM: route.distanceMeters,
        durationS: parseDuration(route.duration),
        polyline: route.polyline?.encodedPolyline ?? null,
        order: route.optimizedIntermediateWaypointIndex ?? waypoints.map((_, i) => i),
        provider: 'google',
      };
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
