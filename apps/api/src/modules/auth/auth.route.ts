import { registerSchema } from '@carpool/types';
import { Router } from 'express';

import { asyncHandler, created } from '../../lib/http';
import { authLimiter } from '../../middleware/rateLimit';
import { validate, vbody } from '../../middleware/validate.js';
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
