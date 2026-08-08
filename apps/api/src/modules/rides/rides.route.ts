import {
  availableRidesSchema,
  createRideSchema,
  routePreviewSchema,
  searchRideSchema,
} from '@carpool/types';
import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, created, ok } from '../../lib/http.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate, vbody, vparams } from '../../middleware/validate.js';
import * as rides from './rides.service.js';

const router = Router();
router.use(authenticate);
const idParam = z.object({ id: z.string() });

router.post(
  '/preview-route',
  requirePermission('ride:read'),
  validate({ body: routePreviewSchema }),
  asyncHandler(async (req, res) => {
    const b = vbody<z.infer<typeof routePreviewSchema>>(req);
    ok(res, await rides.routePreview(b.origin, b.destination, b.stops));
  })
);

router.post(
  '/',
  requirePermission('ride:create'),
  validate({ body: createRideSchema }),
  asyncHandler(async (req, res) =>
    created(res, await rides.createRide(req.user!.organizationId, req.user!.id, vbody(req)))
  )
);

router.post(
  '/search',
  requirePermission('ride:search'),
  validate({ body: searchRideSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await rides.searchRides(req.user!.organizationId, req.user!.id, vbody(req)))
  )
);

router.get(
  '/mine',
  requirePermission('ride:read'),
  asyncHandler(async (req, res) => ok(res, await rides.myRides(req.user!.id)))
);

router.post(
  '/available',
  requirePermission('ride:read'),
  validate({ body: availableRidesSchema }),
  asyncHandler(async (req, res) => {
    const { pickup } = vbody<{ pickup: { lat: number; lng: number } }>(req);
    ok(res, await rides.availableRides(req.user!.organizationId, req.user!.id, pickup));
  })
);

router.get(
  '/:id',
  requirePermission('ride:read'),
  validate({ params: idParam }),
  asyncHandler(async (req, res) =>
    ok(res, await rides.getRide(req.user!.organizationId, vparams<{ id: string }>(req).id))
  )
);

router.post(
  '/:id/cancel',
  requirePermission('ride:cancel'),
  validate({ params: idParam }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await rides.cancelRide(
        req.user!.organizationId,
        req.user!.id,
        vparams<{ id: string }>(req).id
      )
    )
  )
);

export default router;
