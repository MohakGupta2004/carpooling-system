import { loginSchema, registerSchema, verifyEmailSchema } from '@carpool/types';
import { Router } from 'express';

import { Unauthorized } from '../../lib/errors.js';
import { asyncHandler, created, ok } from '../../lib/http';
import { verifyRefreshToken } from '../../lib/jwt.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authLimiter } from '../../middleware/rateLimit';
import { validate, vbody } from '../../middleware/validate.js';
import { getEffectivePermissions } from '../rbac/rbac.service.js';
import * as auth from './auth.service.js';

const authRouter = Router();

const REFRESH_COOKIE = 'rideloop_rt';
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/api/v1/auth',
  maxAge: 30 * 24 * 60 * 60_000,
};
authRouter.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => created(res, await auth.register(vbody(req))))
);
authRouter.post(
  '/verify-email',
  authLimiter,
  validate({ body: verifyEmailSchema }),
  asyncHandler(async (req, res) => {
    const { email, otp } = vbody<{ email: string; otp: string }>(req);
    ok(res, await auth.verifyEmail(email, otp));
  })
);

authRouter.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = vbody<{ email: string; password: string }>(req);
    const result = await auth.login(email, password, {
      ua: req.headers['user-agent'],
      ip: req.ip,
    });
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOpts);
    ok(res, {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    });
  })
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const rt = req.cookies?.[REFRESH_COOKIE];
    if (!rt) throw Unauthorized('Missing refresh token');
    let userId: string;
    try {
      userId = verifyRefreshToken(rt).sub;
    } catch {
      throw Unauthorized('Invalid refresh token');
    }
    const result = await auth.refresh(rt, userId);
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOpts);
    ok(res, { accessToken: result.accessToken, expiresIn: result.expiresIn });
  })
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => ok(res, await auth.getMe(req.user!.id)))
);

authRouter.get(
  '/me/permissions',
  authenticate,
  asyncHandler(async (req, res) => {
    const perms = await getEffectivePermissions(req.user!.id, req.user!.organizationId);
    ok(res, { permissions: [...perms] });
  })
);
authRouter.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    const rt = req.cookies?.[REFRESH_COOKIE];
    if (rt) await auth.logout(rt, req.user!.id);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    ok(res, { loggedOut: true });
  })
);

export default authRouter;
