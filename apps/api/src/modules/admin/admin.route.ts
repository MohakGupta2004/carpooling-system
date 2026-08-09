import {
  type CreateUserInput,
  createUserSchema,
  createVehicleSchema,
  updateVehicleSchema,
} from '@carpool/types';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../../lib/errors.js';
import { asyncHandler, created, ok } from '../../lib/http.js';
import { sendMail, welcomeAccountEmail } from '../../lib/mailer.js';
import { hashPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate, vbody, vparams, vquery } from '../../middleware/validate.js';
import { notifyUser } from '../../realtime/emit.ts';
import { getEffectivePermissions } from '../rbac/rbac.service.js';

const router = Router();
router.use(authenticate);
const idParam = z.object({ id: z.string() });

/**
 * Whose people to operate on. A Company Admin is always pinned to their own
 * organization; a Super Admin (the `org:manage` permission) may pass `?orgId=`
 * to work inside a specific company. Mirrors `resolveOrgId` in the reports module.
 */
async function resolveOrgId(req: Request): Promise<string> {
  const myOrgId = req.user!.organizationId;
  const requestedOrgId = req.query.orgId ? String(req.query.orgId) : null;
  if (!requestedOrgId || requestedOrgId === myOrgId) return myOrgId;

  const permissions = await getEffectivePermissions(req.user!.id, myOrgId);
  if (!permissions.has('org:manage')) throw Forbidden('Not allowed to view another organization');
  return requestedOrgId;
}

// ---- Create an account (Super Admin adds a Company Admin, etc.) ----
router.post(
  '/users',
  requirePermission('user:create'),
  validate({ body: createUserSchema, query: z.object({ orgId: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const { fullName, email, password, role, departmentId } = vbody<CreateUserInput>(req);
    const orgId = await resolveOrgId(req);

    const exists = await prisma.user.findUnique({
      where: { organizationId_email: { organizationId: orgId, email } },
    });
    if (exists) throw Conflict('An account with this email already exists');

    const roleRow = await prisma.role.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: role } },
    });
    if (!roleRow) throw NotFound(`Role ${role} not found in this organization`);

    // Admin-created accounts are active immediately (no email verification step).
    const user = await prisma.user.create({
      data: {
        organizationId: orgId,
        email,
        fullName,
        passwordHash: await hashPassword(password),
        status: 'ACTIVE',
        emailVerified: true,
        departmentId: departmentId ?? undefined,
        roles: { create: { roleId: roleRow.id } },
        wallet: { create: {} },
      },
      select: { id: true, fullName: true, email: true, status: true },
    });

    const { subject, html } = welcomeAccountEmail({
      fullName,
      email,
      password,
      loginUrl: `${env.corsOrigin[0]}/login`,
    });
    const emailSent = await sendMail(email, subject, html);

    created(res, { ...user, emailSent });
  })
);

// ---- Employee roster + approval ----
router.get(
  '/employees',
  // Admin-only roster (Company Admin / Super Admin) — regular employees hold
  // `user:read` for co-worker profiles but not `user:approve`, so they can't list here.
  requirePermission('user:approve'),
  validate({
    query: z.object({
      status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
      orgId: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { status } = vquery<{ status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' }>(req);
    const orgId = await resolveOrgId(req);
    ok(
      res,
      await prisma.user.findMany({
        // Super Admins are platform operators, not company employees — never list them.
        where: {
          organizationId: orgId,
          deletedAt: null,
          ...(status ? { status } : {}),
          NOT: { roles: { some: { role: { key: 'SUPER_ADMIN' } } } },
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          status: true,
          emailVerified: true,
          photoUrl: true,
          createdAt: true,
          department: { select: { name: true } },
          roles: { select: { role: { select: { key: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      })
    );
  })
);

// ---- Employee detail (profile + vehicles + activity stats) ----
router.get(
  '/employees/:id',
  requirePermission('user:approve'),
  validate({ params: idParam, query: z.object({ orgId: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    const id = vparams<{ id: string }>(req).id;
    const orgId = await resolveOrgId(req);
    const user = await prisma.user.findFirst({
      // Super Admins are never viewable as company employees.
      where: {
        id,
        organizationId: orgId,
        deletedAt: null,
        NOT: { roles: { some: { role: { key: 'SUPER_ADMIN' } } } },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        gender: true,
        status: true,
        emailVerified: true,
        employeeCode: true,
        homeAddress: true,
        photoUrl: true,
        ecoPoints: true,
        rating: true,
        createdAt: true,
        department: { select: { name: true } },
        roles: { select: { role: { select: { key: true, name: true } } } },
        vehicles: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            brand: true,
            model: true,
            registrationNo: true,
            licenseNo: true,
            isAc: true,
            color: true,
            fuelType: true,
            seats: true,
            verification: true,
            insuranceNo: true,
            pucValidTill: true,
            pendingChanges: true,
            createdAt: true,
          },
        },
        wallet: { select: { balance: true } },
      },
    });
    if (!user) throw NotFound('Employee not found');

    const [ridesOffered, completedAsDriver, completedAsPassenger, distanceAgg, co2Agg] =
      await Promise.all([
        prisma.ride.count({ where: { driverId: id } }),
        prisma.ride.count({ where: { driverId: id, status: 'COMPLETED' } }),
        prisma.booking.count({ where: { passengerId: id, status: 'COMPLETED' } }),
        prisma.ride.aggregate({
          where: { driverId: id, status: 'COMPLETED' },
          _sum: { distanceM: true },
        }),
        prisma.tripMetric.aggregate({
          where: { trip: { ride: { driverId: id } } },
          _sum: { co2SavedG: true },
        }),
      ]);

    ok(res, {
      ...user,
      stats: {
        ridesOffered,
        completedAsDriver,
        completedAsPassenger,
        distanceKm: Math.round((distanceAgg._sum.distanceM ?? 0) / 100) / 10,
        co2SavedKg: Math.round((co2Agg._sum.co2SavedG ?? 0) / 100) / 10,
        walletBalance: user.wallet?.balance ?? 0,
      },
    });
  })
);

router.post(
  '/employees/:id/approve',
  requirePermission('user:approve'),
  validate({ params: idParam, query: z.object({ orgId: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    await prisma.user.updateMany({
      where: { id: vparams<{ id: string }>(req).id, organizationId: await resolveOrgId(req) },
      data: { status: 'ACTIVE' },
    });
    ok(res, { approved: true });
  })
);

router.post(
  '/employees/:id/suspend',
  requirePermission('user:suspend'),
  validate({ params: idParam, query: z.object({ orgId: z.string().optional() }) }),
  asyncHandler(async (req, res) => {
    await prisma.user.updateMany({
      where: { id: vparams<{ id: string }>(req).id, organizationId: await resolveOrgId(req) },
      data: { status: 'SUSPENDED' },
    });
    ok(res, { suspended: true });
  })
);

// ---- Vehicle verification ----
router.get(
  '/vehicles',
  requirePermission('vehicle:verify'),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await prisma.vehicle.findMany({
        where: { organizationId: req.user!.organizationId, deletedAt: null },
        include: { owner: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      })
    )
  )
);

router.post(
  '/vehicles/:id/verify',
  requirePermission('vehicle:verify'),
  validate({ params: idParam, body: z.object({ decision: z.enum(['VERIFIED', 'REJECTED']) }) }),
  asyncHandler(async (req, res) => {
    const decision = (req.valid?.body as { decision: 'VERIFIED' | 'REJECTED' }).decision;
    await prisma.vehicle.updateMany({
      where: { id: vparams<{ id: string }>(req).id, organizationId: req.user!.organizationId },
      data: { verification: decision },
    });
    ok(res, { verification: decision });
  })
);

// ---- Admin vehicle CRUD (manage any vehicle in the org) ----
// createVehicleSchema is a transform (ZodEffects), so intersect rather than extend.
const adminCreateVehicle = createVehicleSchema.and(z.object({ ownerId: z.string() }));

router.post(
  '/vehicles',
  requirePermission('vehicle:verify'),
  validate({ body: adminCreateVehicle }),
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const { ownerId, pucValidTill, photos, ...rest } =
      vbody<z.infer<typeof adminCreateVehicle>>(req);
    const owner = await prisma.user.findFirst({ where: { id: ownerId, organizationId: orgId } });
    if (!owner) throw NotFound('Owner not found in your organization');
    const vehicle = await prisma.vehicle.create({
      data: {
        organizationId: orgId,
        ownerId,
        ...rest,
        pucValidTill: pucValidTill ? new Date(pucValidTill) : undefined,
        photos: photos ?? [],
        verification: 'VERIFIED', // admin-added vehicles are trusted
      },
    });
    created(res, vehicle);
  })
);

router.patch(
  '/vehicles/:id',
  requirePermission('vehicle:verify'),
  validate({ params: idParam, body: updateVehicleSchema }),
  asyncHandler(async (req, res) => {
    const { pucValidTill, ...rest } = vbody<z.infer<typeof updateVehicleSchema>>(req);
    const result = await prisma.vehicle.updateMany({
      where: {
        id: vparams<{ id: string }>(req).id,
        organizationId: req.user!.organizationId,
        deletedAt: null,
      },
      data: { ...rest, ...(pucValidTill ? { pucValidTill: new Date(pucValidTill) } : {}) },
    });
    if (result.count === 0) throw NotFound('Vehicle not found');
    ok(res, { updated: true });
  })
);

router.delete(
  '/vehicles/:id',
  requirePermission('vehicle:verify'),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const result = await prisma.vehicle.updateMany({
      where: {
        id: vparams<{ id: string }>(req).id,
        organizationId: req.user!.organizationId,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) throw NotFound('Vehicle not found');
    ok(res, { deleted: true });
  })
);

// Review an owner's proposed edit to a verified vehicle: apply it or discard it.
router.post(
  '/vehicles/:id/review-changes',
  requirePermission('vehicle:verify'),
  validate({ params: idParam, body: z.object({ decision: z.enum(['APPROVE', 'REJECT']) }) }),
  asyncHandler(async (req, res) => {
    const { decision } = vbody<{ decision: 'APPROVE' | 'REJECT' }>(req);
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vparams<{ id: string }>(req).id,
        organizationId: req.user!.organizationId,
        deletedAt: null,
      },
    });
    if (!vehicle) throw NotFound('Vehicle not found');
    if (!vehicle.pendingChanges) throw BadRequest('No pending changes to review');

    if (decision === 'APPROVE') {
      const c = vehicle.pendingChanges as Record<string, unknown>;
      const { pucValidTill, ...rest } = c;
      const data: Record<string, unknown> = { ...rest, pendingChanges: Prisma.DbNull };
      if (pucValidTill) data.pucValidTill = new Date(pucValidTill as string);
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: data as Prisma.VehicleUpdateInput,
      });
    } else {
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { pendingChanges: Prisma.DbNull },
      });
    }

    void notifyUser(vehicle.ownerId, {
      type: 'VEHICLE_CHANGES_REVIEWED',
      title: decision === 'APPROVE' ? 'Vehicle changes approved' : 'Vehicle changes rejected',
      body: `Your edit to ${vehicle.brand} ${vehicle.model} was ${decision === 'APPROVE' ? 'applied' : 'rejected'}.`,
      link: '/vehicles',
    });
    ok(res, { reviewed: decision });
  })
);

export default router;
