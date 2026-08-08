import { Router } from 'express';

import { asyncHandler } from '../../lib/http';
import { authLimiter } from '../../middleware/rateLimit';

const authRoute = Router();

const REFRESH_COOKIE = 'rideloop_rt';
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/api/v1/auth',
  maxAge: 30 * 24 * 60 * 60_000,
};
authRoute.post('/register', authLimiter, asyncHandler(authController.register));
