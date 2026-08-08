import { cancelSchema, createBookingSchema } from '@carpool/types';
import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, created, ok } from '../../lib/http.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate, vbody, vparams } from '../../middleware/validate.js';
import * as trips from './trips.service.js';

// ---- Bookings ----
export const bookingsRouter = Router();
bookingsRouter.use(authenticate);
const bId = z.object({ id: z.string() });

bookingsRouter.post(
  '/',
  requirePermission('booking:create'),
  validate({ body: createBookingSchema }),
  asyncHandler(async (req, res) =>
    created(res, await trips.createBooking(req.user!.organizationId, req.user!.id, vbody(req)))
  )
);

bookingsRouter.post(
  '/:id/approve',
  requirePermission('booking:approve'),
  validate({ params: bId }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await trips.approveBooking(
        req.user!.organizationId,
        req.user!.id,
        vparams<{ id: string }>(req).id,
        true
      )
    )
  )
);

bookingsRouter.post(
  '/:id/reject',
  requirePermission('booking:approve'),
  validate({ params: bId }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await trips.approveBooking(
        req.user!.organizationId,
        req.user!.id,
        vparams<{ id: string }>(req).id,
        false
      )
    )
  )
);

bookingsRouter.post(
  '/:id/cancel',
  requirePermission('booking:cancel'),
  validate({ params: bId }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await trips.cancelBooking(
        req.user!.organizationId,
        req.user!.id,
        vparams<{ id: string }>(req).id
      )
    )
  )
);

// ---- Trips ----
export const tripsRouter = Router();
tripsRouter.use(authenticate);
const tId = z.object({ id: z.string() });

tripsRouter.get(
  '/mine',
  requirePermission('trip:read'),
  asyncHandler(async (req, res) => ok(res, await trips.myTrips(req.user!.id)))
);

tripsRouter.get(
  '/:id',
  requirePermission('trip:read'),
  validate({ params: tId }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await trips.getTrip(req.user!.organizationId, req.user!.id, vparams<{ id: string }>(req).id)
    )
  )
);

tripsRouter.get(
  '/:id/messages',
  requirePermission('chat:use'),
  validate({ params: tId }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await trips.getMessages(
        req.user!.organizationId,
        req.user!.id,
        vparams<{ id: string }>(req).id
      )
    )
  )
);

tripsRouter.post(
  '/:id/start',
  requirePermission('trip:start'),
  validate({ params: tId }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await trips.startTrip(req.user!.organizationId, req.user!.id, vparams<{ id: string }>(req).id)
    )
  )
);

tripsRouter.post(
  '/:id/progress',
  requirePermission('trip:start'),
  validate({ params: tId }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await trips.progressTrip(
        req.user!.organizationId,
        req.user!.id,
        vparams<{ id: string }>(req).id
      )
    )
  )
);

tripsRouter.post(
  '/:id/verify-pickup',
  requirePermission('trip:start'),
  validate({ params: tId, body: z.object({ bookingId: z.string(), otp: z.string().length(4) }) }),
  asyncHandler(async (req, res) => {
    const b = vbody<{ bookingId: string; otp: string }>(req);
    ok(
      res,
      await trips.verifyPickup(
        req.user!.organizationId,
        req.user!.id,
        vparams<{ id: string }>(req).id,
        b.bookingId,
        b.otp
      )
    );
  })
);

tripsRouter.post(
  '/:id/complete',
  requirePermission('trip:complete'),
  validate({ params: tId }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await trips.completeTrip(
        req.user!.organizationId,
        req.user!.id,
        vparams<{ id: string }>(req).id
      )
    )
  )
);

tripsRouter.post(
  '/:id/cancel',
  requirePermission('trip:cancel'),
  validate({ params: tId, body: cancelSchema }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await trips.cancelTrip(
        req.user!.organizationId,
        req.user!.id,
        vparams<{ id: string }>(req).id,
        vbody<{ reason?: string }>(req).reason
      )
    )
  )
);
