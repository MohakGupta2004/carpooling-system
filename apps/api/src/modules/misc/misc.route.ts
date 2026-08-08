import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, created, ok } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate, vbody } from '../../middleware/validate.js';

// ---- Ride history ----
export const historyRouter = Router();
historyRouter.use(authenticate);
historyRouter.get(
  '/',
  requirePermission('trip:read'),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const bookings = await prisma.booking.findMany({
      where: { passengerId: userId, status: { in: ['COMPLETED', 'CANCELLED'] } },
      include: {
        payment: true,
        ride: {
          include: {
            driver: { select: { fullName: true, photoUrl: true } },
            vehicle: { select: { brand: true, model: true } },
            trip: { select: { id: true, status: true, completedAt: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, bookings);
  })
);

// ---- Notifications ----
export const notificationsRouter = Router();
notificationsRouter.use(authenticate);
notificationsRouter.get(
  '/',
  requirePermission('notification:read'),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    )
  )
);
notificationsRouter.post(
  '/read',
  requirePermission('notification:read'),
  validate({ body: z.object({ ids: z.array(z.string()).optional() }) }),
  asyncHandler(async (req, res) => {
    const { ids } = vbody<{ ids?: string[] }>(req);
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, ...(ids ? { id: { in: ids } } : {}), readAt: null },
      data: { readAt: new Date() },
    });
    ok(res, { read: true });
  })
);

// ---- Reviews ----
export const reviewsRouter = Router();
reviewsRouter.use(authenticate);
reviewsRouter.post(
  '/',
  requirePermission('booking:read'),
  validate({
    body: z.object({
      bookingId: z.string(),
      rateeId: z.string(),
      role: z.enum(['DRIVER', 'PASSENGER']),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(500).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const b = vbody<{
      bookingId: string;
      rateeId: string;
      role: 'DRIVER' | 'PASSENGER';
      rating: number;
      comment?: string;
    }>(req);
    // Idempotent per direction — re-rating the same booking updates instead of 409'ing.
    const review = await prisma.review.upsert({
      where: { bookingId_role: { bookingId: b.bookingId, role: b.role } },
      create: { ...b, raterId: req.user!.id },
      update: { rating: b.rating, comment: b.comment, rateeId: b.rateeId, raterId: req.user!.id },
    });
    // recompute ratee avg rating
    const agg = await prisma.review.aggregate({
      where: { rateeId: b.rateeId },
      _avg: { rating: true },
    });
    await prisma.user.update({ where: { id: b.rateeId }, data: { rating: agg._avg.rating ?? 0 } });
    created(res, review);
  })
);

// ---- SOS ----
export const sosRouter = Router();
sosRouter.use(authenticate);
sosRouter.post(
  '/',
  requirePermission('sos:trigger'),
  validate({
    body: z.object({
      tripId: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    }),
  }),
  asyncHandler(async (req, res) =>
    created(
      res,
      await prisma.sosEvent.create({
        data: {
          userId: req.user!.id,
          ...vbody<{ tripId?: string; lat?: number; lng?: number }>(req),
        },
      })
    )
  )
);
