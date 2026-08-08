import type { CreateRideInput, SearchRideInput } from '@carpool/types';

import { BadRequest, NotFound } from '../../lib/errors.js';
import { decodePolyline, getRoute, haversine } from '../../lib/maps.js';
import { prisma } from '../../lib/prisma.js';

type LL = { lat: number; lng: number };

/** Build a PostGIS geography LineString WKT from route points (lng lat order). */
function lineStringWkt(points: LL[]): string | null {
  if (points.length < 2) return null;
  const coords = points.map((p) => `${p.lng} ${p.lat}`).join(',');
  return `SRID=4326;LINESTRING(${coords})`;
}

/**
 * Store the ride's road route as a geography LineString so corridor matching
 * (ST_DWithin) can run in-DB. Falls back to a 2-point origin→destination line
 * when there's no decoded polyline (estimate mode).
 */
async function setRouteGeo(
  rideId: string,
  polyline: string | null | undefined,
  origin: LL,
  dest: LL
) {
  const pts = polyline ? decodePolyline(polyline) : [origin, dest];
  const wkt = lineStringWkt(pts.length >= 2 ? pts : [origin, dest]);
  if (!wkt) return;
  await prisma.$executeRaw`UPDATE "Ride" SET "routeGeo" = ST_GeogFromText(${wkt}) WHERE id = ${rideId}`;
}

export async function routePreview(
  origin: { lat: number; lng: number; label?: string },
  destination: { lat: number; lng: number; label?: string },
  stops: { lat: number; lng: number }[] = []
) {
  const route = await getRoute(origin, destination, stops);
  return {
    ...route,
    distanceKm: +(route.distanceM / 1000).toFixed(1),
    durationMin: Math.round(route.durationS / 60),
  };
}

export async function createRide(orgId: string, driverId: string, input: CreateRideInput) {
  // PS: a driver must have at least one verified vehicle before publishing.
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: input.vehicleId, ownerId: driverId, deletedAt: null },
  });
  if (!vehicle) throw NotFound('Vehicle not found');
  if (vehicle.verification !== 'VERIFIED')
    throw BadRequest('Vehicle must be verified before offering a ride');
  if (input.totalSeats > vehicle.seats)
    throw BadRequest(`Vehicle seats (${vehicle.seats}) exceeded`);

  // Women-only rides can only be offered by female drivers.
  if (input.rules?.womenOnly) {
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: { gender: true },
    });
    if (driver?.gender !== 'FEMALE')
      throw BadRequest('Only women drivers can offer a women-only ride');
  }

  const route = await getRoute(input.origin, input.destination, input.stops ?? []);
  const polyline = input.routePolyline ?? route.polyline;

  const ride = await prisma.ride.create({
    data: {
      organizationId: orgId,
      driverId,
      vehicleId: input.vehicleId,
      originLabel: input.origin.label,
      originLat: input.origin.lat,
      originLng: input.origin.lng,
      destLabel: input.destination.label,
      destLat: input.destination.lat,
      destLng: input.destination.lng,
      stops: input.stops as object | undefined,
      routePolyline: polyline,
      distanceM: input.distanceM ?? route.distanceM,
      durationS: input.durationS ?? route.durationS,
      departAt: new Date(input.departAt),
      recurrence: input.recurrence as object | undefined,
      totalSeats: input.totalSeats,
      seatsAvailable: input.totalSeats,
      farePerSeat: input.farePerSeat,
      rules: input.rules as object | undefined,
      bookingMode: input.bookingMode,
      maxDetourM: input.maxDetourM,
      status: 'PUBLISHED',
    },
  });
  await setRouteGeo(ride.id, polyline, input.origin, input.destination);

  // Create the trip up-front so the driver can open/track the ride immediately
  // for reference — even before anyone books. Booking later upserts this same row.
  await prisma.trip.upsert({
    where: { rideId: ride.id },
    create: { rideId: ride.id, status: 'BOOKED' },
    update: {},
  });
  return ride;
}

interface Scored {
  ride: Awaited<ReturnType<typeof loadRides>>[number];
  score: number;
  pickupDistanceM: number;
  dropDistanceM: number;
  detourFactor: number;
  reason: string;
}

function loadRides(ids: string[]) {
  return prisma.ride.findMany({
    where: { id: { in: ids } },
    include: {
      driver: { select: { id: true, fullName: true, photoUrl: true, rating: true, gender: true } },
      vehicle: {
        select: { type: true, fuelType: true, brand: true, model: true, seats: true, isAc: true },
      },
    },
  });
}

/**
 * Spatial candidate prefilter — CORRIDOR based (the ride-share way). Uses the GIST-
 * indexed route LineString (`routeGeo`) to find rides whose ROUTE passes within
 * `radius` of the passenger's pickup AND within `radius` of the drop, with the
 * pickup coming BEFORE the drop along the route (via ST_LineLocatePoint). This is
 * what makes carpooling work: your pickup lives along the driver's path, not at
 * the driver's starting point. `ST_Distance` (meters, to the route line) feeds the
 * score. Everything runs index-backed in Postgres — no scanning rides in JS.
 */
async function candidateRides(
  orgId: string,
  date: string,
  seats: number,
  pickup: { lat: number; lng: number },
  drop: { lat: number; lng: number },
  radius: number
) {
  const day = new Date(date);
  const start = new Date(new Date(day).setHours(0, 0, 0, 0));
  const end = new Date(new Date(day).setHours(23, 59, 59, 999));
  // Don't surface rides that already departed.
  const notBefore = new Date(Math.max(start.getTime(), Date.now() - 60 * 60_000));

  const rows = await prisma.$queryRaw<
    Array<{ id: string; pickupDistanceM: number; dropDistanceM: number }>
  >`
    SELECT r.id,
      ST_Distance(r."routeGeo", ST_SetSRID(ST_MakePoint(${pickup.lng}, ${pickup.lat}), 4326)::geography) AS "pickupDistanceM",
      ST_Distance(r."routeGeo", ST_SetSRID(ST_MakePoint(${drop.lng},   ${drop.lat}),   4326)::geography) AS "dropDistanceM"
    FROM "Ride" r
    WHERE r."organizationId" = ${orgId}
      AND r.status = 'PUBLISHED'::"RideStatus"
      AND r."seatsAvailable" >= ${seats}
      AND r."departAt" >= ${notBefore} AND r."departAt" <= ${end}
      AND r."routeGeo" IS NOT NULL
      -- pickup AND drop both lie within the corridor of the ride's route
      AND ST_DWithin(r."routeGeo", ST_SetSRID(ST_MakePoint(${pickup.lng}, ${pickup.lat}), 4326)::geography, ${radius})
      AND ST_DWithin(r."routeGeo", ST_SetSRID(ST_MakePoint(${drop.lng},   ${drop.lat}),   4326)::geography, ${radius})
      -- and the pickup comes BEFORE the drop along the route (right direction)
      AND ST_LineLocatePoint(r."routeGeo"::geometry, ST_SetSRID(ST_MakePoint(${pickup.lng}, ${pickup.lat}), 4326))
        < ST_LineLocatePoint(r."routeGeo"::geometry, ST_SetSRID(ST_MakePoint(${drop.lng}, ${drop.lat}), 4326))
    ORDER BY (
      ST_Distance(r."routeGeo", ST_SetSRID(ST_MakePoint(${pickup.lng}, ${pickup.lat}), 4326)::geography)
      + ST_Distance(r."routeGeo", ST_SetSRID(ST_MakePoint(${drop.lng}, ${drop.lat}), 4326)::geography)
    ) ASC
    LIMIT 50`;

  const dist = new Map(
    rows.map((r) => [
      r.id,
      { pickupDistanceM: Number(r.pickupDistanceM), dropDistanceM: Number(r.dropDistanceM) },
    ])
  );
  const rides = rows.length ? await loadRides(rows.map((r) => r.id)) : [];
  return { rides, dist };
}

/**
 * Ride matching v1/v2 (corridor + weighted score). Ranks candidate rides by how
 * well the passenger's pickup→drop fits the driver's origin→destination, plus
 * time, rating and filters. Returns explainable results.
 */
export async function searchRides(orgId: string, userId: string, input: SearchRideInput) {
  const radius = input.filters?.radiusM ?? 3000;
  // Women-only rides are only visible to women, regardless of the filter toggle.
  const searcher = await prisma.user.findUnique({
    where: { id: userId },
    select: { gender: true },
  });
  const isWoman = searcher?.gender === 'FEMALE';
  // Index-backed spatial prefilter in PostGIS (see candidateRides).
  const { rides, dist } = await candidateRides(
    orgId,
    input.date,
    input.seats,
    input.pickup,
    input.destination,
    radius
  );

  const scored: Scored[] = [];
  for (const ride of rides) {
    const d = dist.get(ride.id);
    if (!d) continue;
    const pickupDistanceM = d.pickupDistanceM;
    const dropDistanceM = d.dropDistanceM;

    const origin = { lat: Number(ride.originLat), lng: Number(ride.originLng) };
    const dest = { lat: Number(ride.destLat), lng: Number(ride.destLng) };

    // --- filters ---
    const f = input.filters ?? {};
    if (f.ev && ride.vehicle.type !== 'EV' && ride.vehicle.fuelType !== 'ELECTRIC') continue;
    if (f.maxFare && ride.farePerSeat > f.maxFare) continue;
    if (f.minRating && Number(ride.driver.rating) < f.minRating) continue;
    if (f.gender && f.gender !== 'ANY' && ride.driver.gender !== f.gender) continue;
    const rules = (ride.rules ?? {}) as { womenOnly?: boolean };
    // Men never see women-only rides; women can additionally filter to only them.
    if (rules.womenOnly && !isWoman) continue;
    if (f.womenOnly && !rules.womenOnly) continue;

    const routeLenM = ride.distanceM ?? haversine(origin, dest);
    const detourFactor = (pickupDistanceM + dropDistanceM) / Math.max(routeLenM, 1);

    // --- score (0..100) ---
    const proximityScore =
      100 * (1 - Math.min(1, (pickupDistanceM + dropDistanceM) / (2 * radius)));
    const ratingScore = (Number(ride.driver.rating) / 5) * 100;

    let timeScore = 60;
    if (input.time) {
      const [h, m] = input.time.split(':').map(Number);
      const want = new Date(input.date);
      want.setHours(h ?? 0, m ?? 0, 0, 0);
      const diffMin = Math.abs(ride.departAt.getTime() - want.getTime()) / 60000;
      timeScore = 100 * Math.max(0, 1 - diffMin / 120); // within 2h window
    }

    const score = 0.5 * proximityScore + 0.3 * timeScore + 0.2 * ratingScore;
    scored.push({
      ride,
      score: Math.round(score),
      pickupDistanceM: Math.round(pickupDistanceM),
      dropDistanceM: Math.round(dropDistanceM),
      detourFactor: +detourFactor.toFixed(2),
      reason: buildReason(pickupDistanceM, timeScore, Number(ride.driver.rating)),
    });
  }

  const sorters: Record<SearchRideInput['sort'], (a: Scored, b: Scored) => number> = {
    DISTANCE: (a, b) => a.pickupDistanceM + a.dropDistanceM - (b.pickupDistanceM + b.dropDistanceM),
    PRICE: (a, b) => a.ride.farePerSeat - b.ride.farePerSeat,
    RATING: (a, b) => Number(b.ride.driver.rating) - Number(a.ride.driver.rating),
    ARRIVAL: (a, b) => a.ride.departAt.getTime() - b.ride.departAt.getTime(),
  };
  scored.sort((a, b) => b.score - a.score || sorters[input.sort](a, b));

  return scored.map((s) => ({
    id: s.ride.id,
    driver: s.ride.driver,
    vehicle: s.ride.vehicle,
    origin: {
      label: s.ride.originLabel,
      lat: Number(s.ride.originLat),
      lng: Number(s.ride.originLng),
    },
    destination: {
      label: s.ride.destLabel,
      lat: Number(s.ride.destLat),
      lng: Number(s.ride.destLng),
    },
    departAt: s.ride.departAt,
    seatsAvailable: s.ride.seatsAvailable,
    totalSeats: s.ride.totalSeats,
    farePerSeat: s.ride.farePerSeat,
    distanceM: s.ride.distanceM,
    rules: s.ride.rules,
    match: {
      score: s.score,
      pickupDistanceM: s.pickupDistanceM,
      dropDistanceM: s.dropDistanceM,
      detourFactor: s.detourFactor,
      reason: s.reason,
    },
  }));
}

function buildReason(pickupM: number, timeScore: number, rating: number): string {
  const bits: string[] = [];
  if (pickupM < 500) bits.push('pickup on your doorstep');
  else if (pickupM < 1500) bits.push('pickup nearby');
  if (timeScore > 85) bits.push('departs right on time');
  if (rating >= 4.5) bits.push('top-rated driver');
  return bits.length ? bits.join(' · ') : 'matches your route';
}

export async function getRide(orgId: string, id: string) {
  const ride = await prisma.ride.findFirst({
    where: { id, organizationId: orgId },
    include: {
      driver: { select: { id: true, fullName: true, photoUrl: true, rating: true } },
      vehicle: true,
      bookings: { select: { id: true, status: true, seats: true } },
    },
  });
  if (!ride) throw NotFound('Ride not found');
  return ride;
}

const ROAD_FACTOR = 1.4; // straight-line → approx road distance

/**
 * Browse rides that are ON THE WAY for a given pickup — the detour-based
 * corridor match. Two stages:
 *   1. PostGIS prefilter (GIST-indexed): keep rides whose route LineString passes
 *      within the driver's detour tolerance of the pickup (ST_DWithin), and whose
 *      pickup falls BEFORE the destination along the route (ST_LineLocatePoint).
 *   2. Detour estimate: extra distance ≈ (corridor offset × 2 × road factor). Keep
 *      only rides where that fits the driver's maxDetour, ranked by smallest detour.
 * This prevents "book a ride that drags the driver 15 km out of the way".
 */
export async function availableRides(orgId: string, userId: string, pickup: LL) {
  const cutoff = new Date(Date.now() - 60 * 60_000);
  const rows = await prisma.$queryRaw<Array<{ id: string; corridorM: number; frac: number }>>`
    SELECT r.id,
      ST_Distance(r."routeGeo", ST_SetSRID(ST_MakePoint(${pickup.lng}, ${pickup.lat}), 4326)::geography) AS "corridorM",
      ST_LineLocatePoint(r."routeGeo"::geometry, ST_SetSRID(ST_MakePoint(${pickup.lng}, ${pickup.lat}), 4326)) AS "frac"
    FROM "Ride" r
    WHERE r."organizationId" = ${orgId}
      AND r.status = 'PUBLISHED'::"RideStatus"
      AND r."seatsAvailable" > 0
      AND r."departAt" >= ${cutoff}
      AND r."driverId" <> ${userId}
      AND r."routeGeo" IS NOT NULL
      -- pickup must be within HALF the detour budget of the route (round-trip ≈ full budget)
      AND ST_DWithin(r."routeGeo", ST_SetSRID(ST_MakePoint(${pickup.lng}, ${pickup.lat}), 4326)::geography, r."maxDetourM" / 2.0)
      -- and it must be on the way, not essentially at/after the destination
      AND ST_LineLocatePoint(r."routeGeo"::geometry, ST_SetSRID(ST_MakePoint(${pickup.lng}, ${pickup.lat}), 4326)) < 0.95
    ORDER BY "corridorM" ASC
    LIMIT 50`;

  if (rows.length === 0) return [];
  const meta = new Map(
    rows.map((r) => [r.id, { corridorM: Number(r.corridorM), frac: Number(r.frac) }])
  );

  const viewer = await prisma.user.findUnique({ where: { id: userId }, select: { gender: true } });
  const isWoman = viewer?.gender === 'FEMALE';

  const rides = await prisma.ride.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    include: {
      driver: { select: { id: true, fullName: true, photoUrl: true, rating: true } },
      vehicle: { select: { brand: true, model: true, type: true, fuelType: true, isAc: true } },
    },
  });

  return (
    rides
      // Men never see women-only rides.
      .filter((r) => isWoman || !(r.rules as { womenOnly?: boolean } | null)?.womenOnly)
      .map((r) => {
        const m = meta.get(r.id)!;
        const detourM = Math.round(m.corridorM * 2 * ROAD_FACTOR);
        return {
          id: r.id,
          driver: r.driver,
          vehicle: r.vehicle,
          origin: { label: r.originLabel, lat: Number(r.originLat), lng: Number(r.originLng) },
          destination: { label: r.destLabel, lat: Number(r.destLat), lng: Number(r.destLng) },
          departAt: r.departAt,
          totalSeats: r.totalSeats,
          seatsAvailable: r.seatsAvailable,
          farePerSeat: r.farePerSeat,
          distanceM: r.distanceM,
          rules: r.rules,
          maxDetourM: r.maxDetourM,
          detourM, // extra distance this pickup adds to the driver's route
        };
      })
      .sort((a, b) => a.detourM - b.detourM)
  );
}

export async function myRides(driverId: string) {
  return prisma.ride.findMany({
    where: { driverId },
    include: {
      vehicle: { select: { brand: true, model: true, type: true, fuelType: true, isAc: true } },
      trip: { select: { id: true, status: true } },
      bookings: {
        where: { status: { in: ['REQUESTED', 'CONFIRMED', 'COMPLETED'] } },
        select: {
          id: true,
          status: true,
          seats: true,
          passenger: { select: { fullName: true, photoUrl: true } },
        },
      },
    },
    orderBy: { departAt: 'desc' },
  });
}

export async function cancelRide(orgId: string, driverId: string, id: string) {
  const ride = await prisma.ride.findFirst({ where: { id, driverId, organizationId: orgId } });
  if (!ride) throw NotFound('Ride not found');
  return prisma.ride.update({ where: { id }, data: { status: 'CANCELLED' } });
}
