import {
  assignRoleSchema,
  createRoleSchema,
  setOverridesSchema,
  setRolePermissionsSchema,
} from '@ridebuddy/types';
import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, created, ok } from '../../lib/http.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate, vbody, vparams } from '../../middleware/validate.js';
import * as rbac from './rbac.service.js';

const router = Router();
router.use(authenticate);

router.get(
  '/permissions',
  requirePermission('permission:read'),
  asyncHandler(async (req, res) => {
    const perms = await rbac.getEffectivePermissions(req.user!.id, req.user!.organizationId);
    ok(res, await rbac.listPermissions(perms.has('org:manage')));
  })
);

router.get(
  '/roles',
  requirePermission('rbac:manage'),
  asyncHandler(async (req, res) => {
    const perms = await rbac.getEffectivePermissions(req.user!.id, req.user!.organizationId);
    ok(res, await rbac.listRoles(req.user!.organizationId, perms.has('org:manage')));
  })
);

router.post(
  '/roles',
  requirePermission('role:create'),
  validate({ body: createRoleSchema }),
  asyncHandler(async (req, res) =>
    created(res, await rbac.createRole(req.user!.organizationId, vbody(req)))
  )
);

const idParam = z.object({ id: z.string() });

router.patch(
  '/roles/:id',
  requirePermission('role:update'),
  validate({ params: idParam, body: createRoleSchema.partial().omit({ key: true }) }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await rbac.updateRole(req.user!.organizationId, vparams<{ id: string }>(req).id, vbody(req))
    )
  )
);

router.delete(
  '/roles/:id',
  requirePermission('role:delete'),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await rbac.deleteRole(req.user!.organizationId, vparams<{ id: string }>(req).id);
    ok(res, { deleted: true });
  })
);

// The star of the RBAC demo: change a role's permissions → live effect next request.
router.put(
  '/roles/:id/permissions',
  requirePermission('rbac:manage'),
  validate({ params: idParam, body: setRolePermissionsSchema }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await rbac.setRolePermissions(
        req.user!.organizationId,
        req.user!.id,
        vparams<{ id: string }>(req).id,
        vbody<{ permissionKeys: string[] }>(req).permissionKeys
      )
    )
  )
);

const userIdParam = z.object({ userId: z.string() });

router.post(
  '/users/:userId/roles',
  requirePermission('rbac:manage'),
  validate({ params: userIdParam, body: assignRoleSchema }),
  asyncHandler(async (req, res) => {
    await rbac.assignRole(
      req.user!.organizationId,
      req.user!.id,
      vparams<{ userId: string }>(req).userId,
      vbody<{ roleId: string }>(req).roleId
    );
    ok(res, { assigned: true });
  })
);

router.delete(
  '/users/:userId/roles/:roleId',
  requirePermission('rbac:manage'),
  validate({ params: z.object({ userId: z.string(), roleId: z.string() }) }),
  asyncHandler(async (req, res) => {
    const p = vparams<{ userId: string; roleId: string }>(req);
    await rbac.removeRole(req.user!.organizationId, req.user!.id, p.userId, p.roleId);
    ok(res, { removed: true });
  })
);

router.put(
  '/users/:userId/overrides',
  requirePermission('rbac:manage'),
  validate({ params: userIdParam, body: setOverridesSchema }),
  asyncHandler(async (req, res) => {
    await rbac.setUserOverrides(
      req.user!.organizationId,
      req.user!.id,
      vparams<{ userId: string }>(req).userId,
      vbody<{ overrides: { permissionKey: string; effect: 'ALLOW' | 'DENY' }[] }>(req).overrides
    );
    ok(res, { updated: true });
  })
);

router.get(
  '/audit',
  requirePermission('rbac:manage'),
  asyncHandler(async (req, res) => ok(res, await rbac.getAuditLog(req.user!.organizationId)))
);

export default router;
