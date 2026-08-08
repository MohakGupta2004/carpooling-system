import type { NextFunction, Request, Response } from 'express';

import { Forbidden, Unauthorized } from '../lib/errors.js';
import { getEffectivePermissions } from '../modules/rbac/rbac.service.js';

/**
 * Dynamic RBAC guard. Loads the user's effective permission set (Redis-cached,
 * invalidated by the org's permVersion) and requires ALL listed permissions.
 * Because permissions are data, an admin toggling a role's permissions changes
 * behaviour here on the next request — no redeploy.
 */
export function requirePermission(...needed: string[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    try {
      const perms = await getEffectivePermissions(req.user.id, req.user.organizationId);
      const missing = needed.filter((p) => !perms.has(p));
      if (missing.length > 0) return next(Forbidden('Missing permission', { missing }));
      next();
    } catch (err) {
      next(err);
    }
  };
}
