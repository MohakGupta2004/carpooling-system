import type { Request, Response } from 'express';
import { Router } from 'express';

import { SUSTAINABILITY } from '../../config/sustainability.js';
import { Forbidden } from '../../lib/errors.js';
import { asyncHandler, ok } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { getEffectivePermissions } from '../rbac/rbac.service.js';
import { generateAnalyticsPdf, generateMyReportPdf } from './report-pdf.service.js';
import {
  computeMyReport,
  computeOrgAnalytics,
  gramsToKg,
  mlToLitres,
  paiseToRupees,
  parseDateParam,
  round1,
  round2,
  sum,
  treesFromCo2Grams,
} from './reports.service.js';

const router = Router();
router.use(authenticate);

// ============================================================
// Small helpers shared by the routes below
// ============================================================

/**
 * Which organization's report to build. Everyone gets their own organization;
 * a Super Admin (the `org:manage` permission) may pass `?orgId=` to look at
 * another company.
 */
async function resolveOrgId(req: Request): Promise<string> {
  const myOrgId = req.user!.organizationId;
  const requestedOrgId = req.query.orgId ? String(req.query.orgId) : null;
  if (!requestedOrgId || requestedOrgId === myOrgId) return myOrgId;

  const permissions = await getEffectivePermissions(req.user!.id, myOrgId);
  if (!permissions.has('org:manage')) throw Forbidden('Not allowed to view another organization');
  return requestedOrgId;
}

/**
 * Download the company logo so pdfkit can draw it.
 * pdfkit only understands PNG and JPEG, so Cloudinary URLs are rewritten to
 * ask for a small PNG (the upload itself may be webp/svg/avif).
 * If anything goes wrong we return null and the report renders without a logo.
 */
async function fetchCompanyLogo(logoUrl: string | null | undefined): Promise<Buffer | null> {
  if (!logoUrl) return null;

  const url = logoUrl.includes('/upload/')
    ? logoUrl.replace('/upload/', '/upload/f_png,w_200,h_200,c_limit/')
    : logoUrl;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

/** "2025-03-14" — used in downloaded file names. */
const today = () => new Date().toISOString().slice(0, 10);

/** Send a PDF as a file download. */
function sendPdf(res: Response, fileName: string, pdf: Buffer) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(pdf);
}

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// ============================================================
// Employee: my own report
// ============================================================

/** GET /reports/me — trips, distance, savings, spend for the signed-in user. */
router.get(
  '/me',
  requirePermission('report:view:self'),
  asyncHandler(async (req, res) => {
    ok(res, await computeMyReport(req.user!.id));
  })
);

/** GET /reports/me/pdf — the same numbers as a branded PDF. */
router.get(
  '/me/pdf',
  requirePermission('report:view:self'),
  asyncHandler(async (req, res) => {
    const [report, me] = await Promise.all([
      computeMyReport(req.user!.id),
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { fullName: true, organization: { select: { name: true, logoUrl: true } } },
      }),
    ]);

    const pdf = await generateMyReportPdf(report, {
      userName: me?.fullName ?? 'Employee',
      companyName: me?.organization?.name ?? 'Workway',
      companyLogo: await fetchCompanyLogo(me?.organization?.logoUrl),
    });

    sendPdf(res, `workway-my-report-${today()}.pdf`, pdf);
  })
);

// ============================================================
// Organization: quick numbers
// ============================================================

/** GET /reports/org — a short summary of one organization. */
router.get(
  '/org',
  requirePermission('report:view:org'),
  asyncHandler(async (req, res) => {
    const orgId = await resolveOrgId(req);

    const [employees, vehicles, activeTrips, completedTrips, cancelledTrips, metrics, topDrivers] =
      await Promise.all([
        prisma.user.count({ where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null } }),
        prisma.vehicle.count({ where: { organizationId: orgId, deletedAt: null } }),
        prisma.trip.count({
          where: {
            ride: { organizationId: orgId },
            status: { in: ['DRIVER_STARTED', 'IN_PROGRESS', 'PASSENGER_PICKED'] },
          },
        }),
        prisma.trip.count({
          where: {
            ride: { organizationId: orgId },
            status: { in: ['COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED'] },
          },
        }),
        prisma.trip.count({ where: { ride: { organizationId: orgId }, status: 'CANCELLED' } }),
        prisma.tripMetric.findMany({ where: { organizationId: orgId } }),
        prisma.ride.groupBy({
          by: ['driverId'],
          where: { organizationId: orgId, status: 'COMPLETED' },
          _count: true,
          orderBy: { _count: { driverId: 'desc' } },
          take: 5,
        }),
      ]);

    const co2SavedG = sum(metrics, (m) => m.co2SavedG);
    const seatsFilled = sum(metrics, (m) => m.seatsFilled);

    ok(res, {
      kpis: { employees, vehicles, activeTrips, completedTrips, cancelledTrips },
      sustainability: {
        co2SavedKg: gramsToKg(co2SavedG),
        fuelSavedL: mlToLitres(sum(metrics, (m) => m.fuelSavedMl)),
        treesEquivalent: round2(treesFromCo2Grams(co2SavedG)),
      },
      // Average number of seats used per trip.
      occupancyRate: metrics.length ? round2(seatsFilled / metrics.length) : 0,
      topDrivers,
    });
  })
);

// ============================================================
// Organization: sustainability dashboard
// ============================================================

/** GET /reports/sustainability — CO2 and fuel saved, plus a monthly trend. */
router.get(
  '/sustainability',
  requirePermission('sustainability:view'),
  asyncHandler(async (req, res) => {
    const orgId = await resolveOrgId(req);
    const metrics = await prisma.tripMetric.findMany({ where: { organizationId: orgId } });

    const co2SavedG = sum(metrics, (m) => m.co2SavedG);
    const fuelSavedMl = sum(metrics, (m) => m.fuelSavedMl);

    // How much CO2 was saved each month, e.g. "2025-03" -> 42000 grams.
    const co2PerMonth = new Map<string, number>();
    for (const metric of metrics) {
      const month = metric.createdAt.toISOString().slice(0, 7);
      co2PerMonth.set(month, (co2PerMonth.get(month) ?? 0) + metric.co2SavedG);
    }

    ok(res, {
      co2SavedKg: gramsToKg(co2SavedG),
      fuelSavedL: mlToLitres(fuelSavedMl),
      petrolCostSaved: Math.round((fuelSavedMl / 1000) * SUSTAINABILITY.PETROL_PRICE_PER_L),
      treesEquivalent: round2(treesFromCo2Grams(co2SavedG)),
      // A friendly 0-100 score: 3 points per shared trip + 1 point per 5 kg of CO2.
      greenScore: Math.min(100, Math.round(metrics.length * 3 + co2SavedG / 5000)),
      monthlyTrend: [...co2PerMonth]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, grams]) => ({ month, co2SavedKg: gramsToKg(grams) })),
    });
  })
);

// ============================================================
// Organization: full analytics (JSON + PDF)
// ============================================================

/** GET /reports/analytics — every chart the admin dashboard draws. */
router.get(
  '/analytics',
  requirePermission('analytics:view'),
  asyncHandler(async (req, res) => {
    const orgId = await resolveOrgId(req);
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    ok(res, await computeOrgAnalytics(orgId, from, to));
  })
);

/** GET /reports/analytics/pdf — the same analytics as a branded PDF. */
router.get(
  '/analytics/pdf',
  requirePermission('analytics:view'),
  asyncHandler(async (req, res) => {
    const orgId = await resolveOrgId(req);
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);

    const [analytics, org, me] = await Promise.all([
      computeOrgAnalytics(orgId, from, to),
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, logoUrl: true },
      }),
      prisma.user.findUnique({ where: { id: req.user!.id }, select: { fullName: true } }),
    ]);

    const pdf = await generateAnalyticsPdf(analytics, {
      companyName: org?.name ?? 'Workway',
      companyLogo: await fetchCompanyLogo(org?.logoUrl),
      rangeLabel: from && to ? `${formatDate(from)} - ${formatDate(to)}` : 'All time',
      generatedBy: me?.fullName ?? 'Administrator',
    });

    sendPdf(res, `workway-analytics-${today()}.pdf`, pdf);
  })
);

// ============================================================
// Platform: compare every organization (Super Admin only)
// ============================================================

/** Prisma `groupBy` gives rows like `{ organizationId, _count }` — turn them into a lookup. */
function toCountMap(rows: { organizationId: string; _count: number }[]): Map<string, number> {
  return new Map(rows.map((row) => [row.organizationId, row._count]));
}

/** GET /reports/org-comparison — headline numbers for every company. */
router.get(
  '/org-comparison',
  requirePermission('analytics:view'),
  asyncHandler(async (req, res) => {
    const permissions = await getEffectivePermissions(req.user!.id, req.user!.organizationId);
    if (!permissions.has('org:manage')) throw Forbidden('Cross-org comparison is Super Admin only');

    const [orgs, userRows, vehicleRows, rideRows, completedRideRows, metricRows, paymentRows] =
      await Promise.all([
        prisma.organization.findMany({
          select: { id: true, name: true, slug: true, status: true },
        }),
        prisma.user.groupBy({
          by: ['organizationId'],
          where: { deletedAt: null, status: 'ACTIVE' },
          _count: true,
        }),
        prisma.vehicle.groupBy({
          by: ['organizationId'],
          where: { deletedAt: null },
          _count: true,
        }),
        prisma.ride.groupBy({ by: ['organizationId'], _count: true }),
        prisma.ride.groupBy({
          by: ['organizationId'],
          where: { status: 'COMPLETED' },
          _count: true,
        }),
        prisma.tripMetric.groupBy({
          by: ['organizationId'],
          _sum: { co2SavedG: true, seatsFilled: true },
          _count: true,
        }),
        prisma.payment.groupBy({
          by: ['organizationId'],
          where: { status: 'PAID' },
          _sum: { amount: true },
        }),
      ]);

    const activeUsers = toCountMap(userRows);
    const vehicles = toCountMap(vehicleRows);
    const rides = toCountMap(rideRows);
    const completedTrips = toCountMap(completedRideRows);
    const metrics = new Map(metricRows.map((row) => [row.organizationId, row]));
    const revenue = new Map(paymentRows.map((row) => [row.organizationId, row._sum.amount ?? 0]));

    const organizations = orgs.map((org) => {
      const metric = metrics.get(org.id);
      const trips = metric?._count ?? 0;
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        activeUsers: activeUsers.get(org.id) ?? 0,
        vehicles: vehicles.get(org.id) ?? 0,
        rides: rides.get(org.id) ?? 0,
        completedTrips: completedTrips.get(org.id) ?? 0,
        co2SavedKg: gramsToKg(metric?._sum.co2SavedG ?? 0),
        avgOccupancy: trips ? round1((metric?._sum.seatsFilled ?? 0) / trips) : 0,
        revenue: paiseToRupees(revenue.get(org.id) ?? 0),
      };
    });

    ok(res, {
      organizations,
      totals: {
        organizations: orgs.length,
        activeUsers: sum(organizations, (o) => o.activeUsers),
        vehicles: sum(organizations, (o) => o.vehicles),
        completedTrips: sum(organizations, (o) => o.completedTrips),
        co2SavedKg: round1(sum(organizations, (o) => o.co2SavedKg)),
        revenue: sum(organizations, (o) => o.revenue),
      },
    });
  })
);

export default router;
