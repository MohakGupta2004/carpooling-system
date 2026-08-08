import type { NextFunction, Request, Response } from 'express';

import { Unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(Unauthorized());
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = { id: payload.sub, organizationId: payload.orgId, email: payload.email };
    next();
  } catch {
    next(Unauthorized('Invalid or expired token'));
  }
}
