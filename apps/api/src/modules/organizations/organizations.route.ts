import { createOrgSchema, updateOrgSchema } from '@carpool/types';
import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, created, ok } from '../../lib/http.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate, vbody, vparams } from '../../middleware/validate.js';
import * as orgs from './organizations.service.js';

// Super-admin only (org:manage). Operates across ALL organizations.
const router = Router();
router.use(authenticate);
const idParam = z.object({ id: z.string() });

router.get(
  '/',
  requirePermission('org:manage'),
  asyncHandler(async (_req, res) => ok(res, await orgs.listOrganizations()))
);

router.get(
  '/:id',
  requirePermission('org:manage'),
  validate({ params: idParam }),
  asyncHandler(async (req, res) =>
    ok(res, await orgs.getOrganization(vparams<{ id: string }>(req).id))
  )
);

router.post(
  '/',
  requirePermission('org:manage'),
  validate({ body: createOrgSchema }),
  asyncHandler(async (req, res) => created(res, await orgs.createOrganization(vbody(req))))
);

router.patch(
  '/:id',
  requirePermission('org:manage'),
  validate({ params: idParam, body: updateOrgSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await orgs.updateOrganization(vparams<{ id: string }>(req).id, vbody(req)))
  )
);

router.delete(
  '/:id',
  requirePermission('org:manage'),
  validate({ params: idParam }),
  asyncHandler(async (req, res) =>
    ok(res, await orgs.archiveOrganization(vparams<{ id: string }>(req).id))
  )
);

export default router;
