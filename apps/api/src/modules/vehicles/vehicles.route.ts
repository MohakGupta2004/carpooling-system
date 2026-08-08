import { createVehicleSchema, updateVehicleSchema } from '@carpool/types';
import { Router } from 'express';
import { z } from 'zod';

import { BadRequest, NotFound } from '../../lib/errors.js';
import { asyncHandler, created, ok } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate, vbody, vparams } from '../../middleware/validate.js';
import { notifyUser } from '../../realtime/emit.js';

const router = Router();
router.use(authenticate);
const idParam = z.object({ id: z.string() });

/** Notify every Company/Super Admin in the org (e.g. a vehicle edit to review). */
async function notifyOrgAdmins(
  orgId: string,
  n: { type: string; title: string; body: string; link?: string }
) {
  const admins = await prisma.user.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      roles: { some: { role: { key: { in: ['COMPANY_ADMIN', 'SUPER_ADMIN'] } } } },
    },
    select: { id: true },
  });
  for (const a of admins) void notifyUser(a.id, n);
}

router.get(
  '/',
  requirePermission('vehicle:read'),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await prisma.vehicle.findMany({
        where: { ownerId: req.user!.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      })
    )
  )
);

router.post(
  '/',
  requirePermission('vehicle:create'),
  validate({ body: createVehicleSchema }),
  asyncHandler(async (req, res) => {
    const body = vbody<z.infer<typeof createVehicleSchema>>(req);
    const vehicle = await prisma.vehicle.create({
      data: {
        organizationId: req.user!.organizationId,
        ownerId: req.user!.id,
        ...body,
        isAc: body.type === 'BIKE' ? false : (body.isAc ?? false),
        pucValidTill: body.pucValidTill ? new Date(body.pucValidTill) : undefined,
        photos: body.photos ?? [],
      },
    });
    created(res, vehicle);
  })
);

router.patch(
  '/:id',
  requirePermission('vehicle:update'),
  validate({ params: idParam, body: updateVehicleSchema }),
  asyncHandler(async (req, res) => {
    const { id } = vparams<{ id: string }>(req);
    const owned = await prisma.vehicle.findFirst({
      where: { id, ownerId: req.user!.id, deletedAt: null },
    });
    if (!owned) throw NotFound('Vehicle not found');
    const body = vbody<z.infer<typeof updateVehicleSchema>>(req);
    const nextType = body.type ?? owned.type;

    // A VERIFIED vehicle stays live with its approved values; the owner's edit is
    // queued as a change request for the admin to review (old → new).
    if (owned.verification === 'VERIFIED') {
      const vehicle = await prisma.vehicle.update({
        where: { id },
        data: { pendingChanges: body as object },
      });
      await notifyOrgAdmins(req.user!.organizationId, {
        type: 'VEHICLE_CHANGE_REQUEST',
        title: 'Vehicle edit to review',
        body: `${req.user!.email} proposed changes to ${owned.brand} ${owned.model}.`,
        link: '/admin/vehicles',
      });
      return ok(res, vehicle);
    }

    // Not yet verified — apply directly; it still awaits initial verification.
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        ...body,
        isAc: nextType === 'BIKE' ? false : (body.isAc ?? owned.isAc ?? false),
        pucValidTill: body.pucValidTill ? new Date(body.pucValidTill) : undefined,
        verification: 'PENDING',
      },
    });
    ok(res, vehicle);
  })
);

router.delete(
  '/:id',
  requirePermission('vehicle:delete'),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { id } = vparams<{ id: string }>(req);
    const owned = await prisma.vehicle.findFirst({
      where: { id, ownerId: req.user!.id, deletedAt: null },
    });
    if (!owned) throw NotFound('Vehicle not found');

    // A vehicle is referenced by every ride it ever ran, so we never hard-delete
    // (that would break ride history). We soft-delete (archive) — the row stays,
    // so past trips/receipts still resolve — but block it while rides are live.
    const activeRides = await prisma.ride.count({
      where: { vehicleId: id, status: { in: ['PUBLISHED', 'FULL', 'STARTED'] } },
    });
    if (activeRides > 0) {
      throw BadRequest(
        'This vehicle has active or upcoming rides. Cancel them before deleting it.'
      );
    }

    await prisma.vehicle.update({ where: { id }, data: { deletedAt: new Date() } });
    ok(res, { deleted: true });
  })
);

export default router;
