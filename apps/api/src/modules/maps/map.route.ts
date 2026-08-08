import { Router } from 'express';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { asyncHandler, ok } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';
import { decodePolyline, getOptimizedRoute, getRoute } from '../../lib/maps.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate, vbody, vquery } from '../../middleware/validate.js';

const router = Router();
router.use(authenticate);

/**
 * Driving route between two points, decoded into lat/lng points that follow the
 * actual roads (turns and all). Used by the live-tracking map to draw the real
 * route and to drive the simulation along it. Falls back to a straight line
 * when Google Directions is unavailable.
 */
router.get(
  '/directions',
  validate({
    query: z.object({
      oLat: z.coerce.number(),
      oLng: z.coerce.number(),
      dLat: z.coerce.number(),
      dLng: z.coerce.number(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { oLat, oLng, dLat, dLng } = vquery<{
      oLat: number;
      oLng: number;
      dLat: number;
      dLng: number;
    }>(req);
    const route = await getRoute({ lat: oLat, lng: oLng }, { lat: dLat, lng: dLng });
    const points =
      route.polyline && route.polyline.length > 0
        ? decodePolyline(route.polyline)
        : [
            { lat: oLat, lng: oLng },
            { lat: dLat, lng: dLng },
          ];
    ok(res, {
      points,
      distanceM: route.distanceM,
      durationS: route.durationS,
      provider: route.provider,
    });
  })
);

const ll = z.object({ lat: z.number(), lng: z.number() });

/**
 * Multi-stop route with OPTIMIZED pickup order. Given the driver's origin, the
 * destination, and every passenger pickup, returns the full road polyline plus
 * the best order to collect them (Google `optimize:true`, else nearest-neighbour).
 */
router.post(
  '/route-plan',
  validate({ body: z.object({ origin: ll, destination: ll, waypoints: z.array(ll).max(23) }) }),
  asyncHandler(async (req, res) => {
    const { origin, destination, waypoints } = vbody<{
      origin: { lat: number; lng: number };
      destination: { lat: number; lng: number };
      waypoints: { lat: number; lng: number }[];
    }>(req);
    const plan = await getOptimizedRoute(origin, destination, waypoints);
    const points = plan.polyline
      ? decodePolyline(plan.polyline)
      : [origin, ...plan.order.map((i) => waypoints[i]!), destination];
    ok(res, {
      points,
      order: plan.order,
      distanceM: plan.distanceM,
      durationS: plan.durationS,
      provider: plan.provider,
    });
  })
);

const UA = 'RideBuddy/1.0 (carpooling hackathon)';

interface Place {
  label: string;
  address: string;
  lat: number;
  lng: number;
}

/**
 * Forward geocoding. Uses Google Places if a key is set, else falls back to
 * Nominatim (OpenStreetMap) — free, no key, matches our Leaflet map tiles.
 */
router.get(
  '/geocode',
  validate({ query: z.object({ q: z.string().min(2).max(160) }) }),
  asyncHandler(async (req, res) => {
    const { q } = vquery<{ q: string }>(req);
    // Prefer Google Places when a key is configured (better India POI coverage
    // + fuzzy matching); otherwise use free OpenStreetMap/Nominatim.
    if (env.googleMapsKey) {
      try {
        ok(res, await geocodeGoogle(q));
        return;
      } catch (err) {
        logger.warn({ err: (err as Error).message }, 'Places API geocode failed — using Nominatim');
      }
    }
    try {
      ok(res, await geocodeNominatim(q));
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'geocode failed');
      ok(res, [] as Place[]);
    }
  })
);

/** Reverse geocoding — turn "use my location" coords into a readable label. */
router.get(
  '/reverse',
  validate({ query: z.object({ lat: z.coerce.number(), lng: z.coerce.number() }) }),
  asyncHandler(async (req, res) => {
    const { lat, lng } = vquery<{ lat: number; lng: number }>(req);
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lng));
      url.searchParams.set('format', 'json');
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
      const row = (await r.json()) as { display_name?: string; name?: string };
      ok(res, {
        label: row.name || row.display_name?.split(',')[0] || 'Current location',
        address: row.display_name ?? '',
        lat,
        lng,
      });
    } catch {
      ok(res, { label: 'Current location', address: '', lat, lng });
    }
  })
);

async function geocodeNominatim(q: string): Promise<Place[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '6');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'in');
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
  const rows = (await r.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    name?: string;
  }>;
  return rows.map((row) => ({
    label: row.name || row.display_name.split(',')[0]!,
    address: row.display_name,
    lat: Number(row.lat),
    lng: Number(row.lon),
  }));
}

async function geocodeGoogle(q: string): Promise<Place[]> {
  // Places API (New) Text Search — handles partial input + POI names far better
  // than the plain Geocoding API, and still returns coordinates in one call.
  // The legacy `/maps/api/place/textsearch` endpoint is unavailable to Cloud
  // projects created after March 2025, so we use the v1 endpoint.
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.googleMapsKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({ textQuery: q, regionCode: 'IN', maxResultCount: 6 }),
  });
  const json = (await r.json()) as {
    places?: Array<{
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
    }>;
    error?: { message?: string };
  };
  if (!r.ok || json.error) {
    throw new Error(json.error?.message ?? `Places API returned ${r.status}`);
  }
  return (json.places ?? [])
    .filter((row) => row.location)
    .map((row) => ({
      label: row.displayName?.text || row.formattedAddress?.split(',')[0] || q,
      address: row.formattedAddress ?? '',
      lat: row.location!.latitude,
      lng: row.location!.longitude,
    }));
}

export default router;
