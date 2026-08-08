import type { TripStatus } from '@prisma/client';

import { SUSTAINABILITY } from '../../config/sustainability.js';
import { prisma } from '../../lib/prisma.js';

// ============================================================
// Tiny helpers — used by every report below (and by reports.routes.ts)
// ============================================================

/** 12.345 -> 12.3 */
export const round1 = (n: number) => Math.round(n * 10) / 10;

/** 12.345 -> 12.35 */
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Distances are stored in metres, shown in kilometres. */
export const metresToKm = (metres: number) => round1(metres / 1000);

/** CO2 is stored in grams, shown in kilograms. */
export const gramsToKg = (grams: number) => round1(grams / 1000);

/** Fuel is stored in millilitres, shown in litres. */
export const mlToLitres = (ml: number) => round1(ml / 1000);

/** Money is stored in paise, shown in rupees. */
export const paiseToRupees = (paise: number) => Math.round(paise / 100);

/** How many trees would absorb this much CO2 in a year. */
export const treesFromCo2Grams = (grams: number) => grams / SUSTAINABILITY.CO2_PER_TREE_YEAR_G;

/** Add up one number from every item in a list. */
export function sum<T>(items: T[], pick: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += pick(item);
  return total;
}

/**
 * Count how many items share the same key, e.g. how many trips per status.
 * Items whose key is empty/null are skipped.
 */
function countBy<T>(
  items: T[],
  keyOf: (item: T) => string | null | undefined
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** All dates below are bucketed in UTC so the keys always line up. */
const dayKey = (date: Date) => date.toISOString().slice(0, 10); // "2025-03-14"
const monthKey = (date: Date) => date.toISOString().slice(0, 7); // "2025-03"

/** "Andheri West, Mumbai" -> "Andheri West" */
const shortPlace = (label: string) => label.split(',')[0] ?? label;
const routeLabel = (from: string, to: string) => `${shortPlace(from)} -> ${shortPlace(to)}`;

/** A trip that actually happened (the payment step is just book-keeping). */
const FINISHED_TRIP_STATUSES: TripStatus[] = ['COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED'];
/** A trip that is booked or on the road right now. */
const ONGOING_TRIP_STATUSES: TripStatus[] = [
  'BOOKED',
  'DRIVER_STARTED',
  'PASSENGER_PICKED',
  'IN_PROGRESS',
];

// ============================================================
// Organization analytics
// ============================================================

export interface OrgAnalytics {
  kpis: {
    employees: number;
    activeEmployees: number;
    adoptionRate: number;
    vehicles: number;
    verifiedVehicles: number;
    totalTrips: number;
    activeTrips: number;
    cancelledTrips: number;
    cancellationRate: number;
    revenue: number;
    monthRevenue: number;
    avgOccupancy: number;
    totalDistanceKm: number;
    co2SavedKg: number;
    fuelSavedL: number;
    treesEquivalent: number;
    ecoPoints: number;
  };
  tripsPerDay: { date: string; trips: number }[];
  tripsByStatus: { status: string; count: number }[];
  peakHours: { hour: number; count: number }[];
  popularRoutes: { route: string; count: number }[];
  paymentMethods: { method: string; count: number; amount: number }[];
  monthlyTrend: { month: string; revenue: number; co2Kg: number }[];
  topDrivers: { name: string; trips: number; distanceKm: number }[];
  departmentAdoption: { department: string; trips: number; employees: number }[];
  vehicleTypes: { type: string; count: number }[];
}

/** Never draw more than half a year of daily bars — the chart becomes unreadable. */
const MAX_CHART_DAYS = 180;

/**
 * Build one entry per day between `start` and `end`, each starting at 0.
 * Days are stepped in UTC because `dayKey()` also reads the date in UTC —
 * mixing the two would shift every bar by a day.
 */
function emptyDayCounts(start: Date, end: Date): Map<string, number> {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const startMs = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endMs = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());

  const days = new Map<string, number>();
  for (let ms = startMs; ms <= endMs && days.size < MAX_CHART_DAYS; ms += ONE_DAY_MS) {
    days.set(dayKey(new Date(ms)), 0);
  }
  return days;
}

/**
 * Everything the admin dashboard and the analytics PDF show, computed live
 * from the database.
 *
 * `from`/`to` filter things that *happened* (rides, trips, payments, metrics).
 * Head-counts (employees, vehicles) are always "as of now", because "how many
 * employees did we have last March" is not a question the dashboard asks.
 */
export async function computeOrgAnalytics(
  orgId: string,
  from: Date | null,
  to: Date | null
): Promise<OrgAnalytics> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  // `undefined` means "no date filter at all" — Prisma ignores undefined values.
  const range = from && to ? { gte: from, lte: to } : undefined;
  const rideRange = range ? { departAt: range } : {};
  const createdRange = range ? { createdAt: range } : {};

  // ---- 1. Read everything we need, all queries at the same time ----
  const [users, vehicles, rides, completedRides, trips, metrics, payments, departments, orgUsers] =
    await Promise.all([
      prisma.user.findMany({
        where: { organizationId: orgId, deletedAt: null },
        select: { id: true, status: true, departmentId: true, ecoPoints: true },
      }),
      prisma.vehicle.findMany({
        where: { organizationId: orgId, deletedAt: null },
        select: { type: true, verification: true },
      }),
      prisma.ride.findMany({
        where: { organizationId: orgId, ...rideRange },
        select: { originLabel: true, destLabel: true },
      }),
      prisma.ride.findMany({
        where: { organizationId: orgId, status: 'COMPLETED', ...rideRange },
        select: { driverId: true, distanceM: true, departAt: true },
      }),
      prisma.trip.findMany({
        where: { ride: { organizationId: orgId, ...rideRange } },
        select: { status: true },
      }),
      prisma.tripMetric.findMany({
        where: { organizationId: orgId, ...createdRange },
        select: {
          departmentId: true,
          seatsFilled: true,
          distanceM: true,
          co2SavedG: true,
          fuelSavedMl: true,
          createdAt: true,
        },
      }),
      prisma.payment.findMany({
        where: { organizationId: orgId, status: 'PAID', ...createdRange },
        select: { amount: true, method: true, createdAt: true },
      }),
      prisma.department.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true },
      }),
      // Used only to turn a driverId into a name (deleted users included, so
      // their past trips still show a name instead of a dash).
      prisma.user.findMany({
        where: { organizationId: orgId },
        select: { id: true, fullName: true },
      }),
    ]);

  // ---- 2. Headline numbers (KPIs) ----
  const activeEmployees = users.filter((u) => u.status === 'ACTIVE').length;
  const driversWhoDrove = new Set(completedRides.map((r) => r.driverId));

  const totalRevenue = sum(payments, (p) => p.amount);
  const monthRevenue = sum(
    payments.filter((p) => p.createdAt >= monthStart),
    (p) => p.amount
  );

  const totalDistanceM = sum(metrics, (m) => m.distanceM);
  const co2SavedG = sum(metrics, (m) => m.co2SavedG);
  const fuelSavedMl = sum(metrics, (m) => m.fuelSavedMl);

  const completedTrips = trips.filter((t) => FINISHED_TRIP_STATUSES.includes(t.status)).length;
  const activeTrips = trips.filter((t) => ONGOING_TRIP_STATUSES.includes(t.status)).length;
  const cancelledTrips = trips.filter((t) => t.status === 'CANCELLED').length;
  const finishedOrCancelled = completedTrips + cancelledTrips;

  const avgOccupancy = metrics.length
    ? round1(sum(metrics, (m) => m.seatsFilled) / metrics.length)
    : 0;

  // ---- 3. Trips per day (line chart) ----
  const seriesStart = from ?? new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000); // last 30 days
  const seriesEnd = to ?? now;
  const dayCounts = emptyDayCounts(seriesStart, seriesEnd);
  for (const ride of completedRides) {
    const key = dayKey(ride.departAt);
    if (dayCounts.has(key)) dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }
  const tripsPerDay = [...dayCounts].map(([date, count]) => ({ date, trips: count }));

  // ---- 4. Trips by status (bar chart) ----
  const tripsByStatus = [...countBy(trips, (t) => t.status)].map(([status, count]) => ({
    status,
    count,
  }));

  // ---- 5. Busiest departure hours (only the 05:00-22:00 commute window) ----
  const ridesPerHour = countBy(completedRides, (r) => String(r.departAt.getHours()));
  const peakHours: { hour: number; count: number }[] = [];
  for (let hour = 5; hour <= 22; hour++) {
    peakHours.push({ hour, count: ridesPerHour.get(String(hour)) ?? 0 });
  }

  // ---- 6. Most used routes (top 6) ----
  const popularRoutes = [...countBy(rides, (r) => routeLabel(r.originLabel, r.destLabel))]
    .map(([route, count]) => ({ route, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // ---- 7. Payment methods ----
  const paymentMethods = [...countBy(payments, (p) => p.method)].map(([method, count]) => ({
    method,
    count,
    amount: sum(
      payments.filter((p) => p.method === method),
      (p) => p.amount
    ),
  }));

  // ---- 8. Month by month: revenue + CO2 saved ----
  const months = new Map<string, { revenue: number; co2G: number }>();
  const monthEntry = (key: string) => {
    let entry = months.get(key);
    if (!entry) {
      entry = { revenue: 0, co2G: 0 };
      months.set(key, entry);
    }
    return entry;
  };
  for (const payment of payments) monthEntry(monthKey(payment.createdAt)).revenue += payment.amount;
  for (const metric of metrics) monthEntry(monthKey(metric.createdAt)).co2G += metric.co2SavedG;
  const monthlyTrend = [...months]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, revenue: paiseToRupees(v.revenue), co2Kg: gramsToKg(v.co2G) }));

  // ---- 9. Top drivers (most completed rides) ----
  const nameOf = new Map(orgUsers.map((u) => [u.id, u.fullName]));
  const perDriver = new Map<string, { trips: number; distanceM: number }>();
  for (const ride of completedRides) {
    const entry = perDriver.get(ride.driverId) ?? { trips: 0, distanceM: 0 };
    entry.trips += 1;
    entry.distanceM += ride.distanceM ?? 0;
    perDriver.set(ride.driverId, entry);
  }
  const topDrivers = [...perDriver]
    .map(([driverId, v]) => ({
      name: nameOf.get(driverId) ?? '-',
      trips: v.trips,
      distanceKm: metresToKm(v.distanceM),
    }))
    .sort((a, b) => b.trips - a.trips)
    .slice(0, 6);

  // ---- 10. Department adoption & fleet mix ----
  const tripsPerDept = countBy(metrics, (m) => m.departmentId);
  const employeesPerDept = countBy(users, (u) => u.departmentId);
  const departmentAdoption = departments.map((d) => ({
    department: d.name,
    trips: tripsPerDept.get(d.id) ?? 0,
    employees: employeesPerDept.get(d.id) ?? 0,
  }));

  const vehicleTypes = [...countBy(vehicles, (v) => v.type)].map(([type, count]) => ({
    type,
    count,
  }));

  return {
    kpis: {
      employees: users.length,
      activeEmployees,
      adoptionRate: activeEmployees
        ? Math.round((driversWhoDrove.size / activeEmployees) * 100)
        : 0,
      vehicles: vehicles.length,
      verifiedVehicles: vehicles.filter((v) => v.verification === 'VERIFIED').length,
      totalTrips: completedTrips,
      activeTrips,
      cancelledTrips,
      cancellationRate: finishedOrCancelled
        ? Math.round((cancelledTrips / finishedOrCancelled) * 100)
        : 0,
      revenue: paiseToRupees(totalRevenue),
      monthRevenue: paiseToRupees(monthRevenue),
      avgOccupancy,
      totalDistanceKm: metresToKm(totalDistanceM),
      co2SavedKg: gramsToKg(co2SavedG),
      fuelSavedL: mlToLitres(fuelSavedMl),
      treesEquivalent: round1(treesFromCo2Grams(co2SavedG)),
      ecoPoints: sum(users, (u) => u.ecoPoints),
    },
    tripsPerDay,
    tripsByStatus,
    peakHours,
    popularRoutes,
    paymentMethods,
    monthlyTrend,
    topDrivers,
    departmentAdoption,
    vehicleTypes,
  };
}

/** Read a `?from=`/`?to=` query value. Returns null when missing or invalid. */
export function parseDateParam(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

// ============================================================
// Personal report ("my trips")
// ============================================================

export interface MyReport {
  // Flat headline numbers — this is what the employee dashboard cards read.
  totalTrips: number;
  totalDistanceKm: number;
  co2SavedKg: number;
  fuelSavedL: number;

  kpis: {
    totalTrips: number;
    tripsAsDriver: number;
    tripsAsPassenger: number;
    distanceKm: number;
    co2SavedKg: number;
    fuelSavedL: number;
    treesEquivalent: number;
    spent: number;
    earned: number;
    ecoPoints: number;
    rating: number;
    costPerKm: number;
  };
  monthly: { month: string; trips: number; co2Kg: number }[];
  roleSplit: { role: string; value: number }[];
  vehicleWise: { name: string; trips: number; distanceKm: number }[];
  recentTrips: {
    date: string;
    route: string;
    role: 'Driver' | 'Passenger';
    amount: number;
    status: string;
  }[];
}

/** One person's travel report: trips driven & ridden, savings, spend, trend. */
export async function computeMyReport(userId: string): Promise<MyReport> {
  // ---- 1. Read this user's data ----
  const [drivenRides, bookedRides, paymentsMade, paymentsReceived, user] = await Promise.all([
    // Rides this user drove.
    prisma.ride.findMany({
      where: { driverId: userId, status: 'COMPLETED' },
      select: {
        distanceM: true,
        departAt: true,
        originLabel: true,
        destLabel: true,
        vehicle: { select: { id: true, brand: true, model: true } },
        trip: {
          select: { status: true, metric: { select: { co2SavedG: true, fuelSavedMl: true } } },
        },
      },
    }),
    // Rides this user took as a passenger.
    prisma.booking.findMany({
      where: { passengerId: userId, status: 'COMPLETED' },
      select: {
        fareAmount: true,
        ride: { select: { originLabel: true, destLabel: true, departAt: true } },
      },
    }),
    prisma.payment.findMany({
      where: { payerId: userId, status: 'PAID' },
      select: { amount: true },
    }),
    prisma.payment.findMany({
      where: { status: 'PAID', booking: { ride: { driverId: userId } } },
      select: { amount: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { ecoPoints: true, rating: true } }),
  ]);

  // Savings are recorded on the trip metric of the ride the user drove.
  const co2SavedG = sum(drivenRides, (r) => r.trip?.metric?.co2SavedG ?? 0);
  const fuelSavedMl = sum(drivenRides, (r) => r.trip?.metric?.fuelSavedMl ?? 0);
  const distanceM = sum(drivenRides, (r) => r.distanceM ?? 0);

  const totalTrips = drivenRides.length + bookedRides.length;
  const totalDistanceKm = metresToKm(distanceM);
  const co2SavedKg = gramsToKg(co2SavedG);
  const fuelSavedL = mlToLitres(fuelSavedMl);

  // ---- 2. One row per vehicle the user drove ----
  const perVehicle = new Map<string, { name: string; trips: number; distanceM: number }>();
  for (const ride of drivenRides) {
    const entry = perVehicle.get(ride.vehicle.id) ?? {
      name: `${ride.vehicle.brand} ${ride.vehicle.model}`,
      trips: 0,
      distanceM: 0,
    };
    entry.trips += 1;
    entry.distanceM += ride.distanceM ?? 0;
    perVehicle.set(ride.vehicle.id, entry);
  }

  // ---- 3. Month by month: trips (both roles) + CO2 saved while driving ----
  const months = new Map<string, { trips: number; co2G: number }>();
  const monthEntry = (key: string) => {
    let entry = months.get(key);
    if (!entry) {
      entry = { trips: 0, co2G: 0 };
      months.set(key, entry);
    }
    return entry;
  };
  for (const ride of drivenRides) {
    const entry = monthEntry(monthKey(ride.departAt));
    entry.trips += 1;
    entry.co2G += ride.trip?.metric?.co2SavedG ?? 0;
  }
  for (const booking of bookedRides) monthEntry(monthKey(booking.ride.departAt)).trips += 1;

  // ---- 4. The 8 most recent trips, driver and passenger mixed together ----
  const recentTrips = [
    ...drivenRides.map((r) => ({
      date: r.departAt,
      route: routeLabel(r.originLabel, r.destLabel),
      role: 'Driver' as const,
      amount: 0,
      status: r.trip?.status ?? 'COMPLETED',
    })),
    ...bookedRides.map((b) => ({
      date: b.ride.departAt,
      route: routeLabel(b.ride.originLabel, b.ride.destLabel),
      role: 'Passenger' as const,
      amount: b.fareAmount,
      status: 'COMPLETED',
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8);

  return {
    totalTrips,
    totalDistanceKm,
    co2SavedKg,
    fuelSavedL,
    kpis: {
      totalTrips,
      tripsAsDriver: drivenRides.length,
      tripsAsPassenger: bookedRides.length,
      distanceKm: totalDistanceKm,
      co2SavedKg,
      fuelSavedL,
      treesEquivalent: round1(treesFromCo2Grams(co2SavedG)),
      spent: paiseToRupees(sum(paymentsMade, (p) => p.amount)),
      earned: paiseToRupees(sum(paymentsReceived, (p) => p.amount)),
      ecoPoints: user?.ecoPoints ?? 0,
      rating: user?.rating ? Number(user.rating) : 0,
      costPerKm: SUSTAINABILITY.PETROL_PRICE_PER_L / SUSTAINABILITY.FUEL_EFFICIENCY_KMPL,
    },
    monthly: [...months]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({ month, trips: v.trips, co2Kg: gramsToKg(v.co2G) })),
    roleSplit: [
      { role: 'As driver', value: drivenRides.length },
      { role: 'As passenger', value: bookedRides.length },
    ],
    vehicleWise: [...perVehicle.values()].map((v) => ({
      name: v.name,
      trips: v.trips,
      distanceKm: metresToKm(v.distanceM),
    })),
    recentTrips: recentTrips.map((t) => ({
      date: t.date.toISOString(),
      route: t.route,
      role: t.role,
      amount: paiseToRupees(t.amount),
      status: t.status,
    })),
  };
}
