import { Router } from 'express';

import { flags } from './config/flags.js';
import authRoutes from './modules/auth/auth.route.ts';
import companiesRoutes from './modules/companies/companies.route.ts';
import organizationsRoutes from './modules/organizations/organizations.route.ts';
import { bookingsRouter, tripsRouter } from './modules/trips/trips.route.ts';
import userRoutes from './modules/user/user.route.ts';

export const api = Router();
api.get('/health', (_req, res) => res.json({ data: { status: 'ok', flags } }));
api.use('/auth', authRoutes);
api.use('/users', userRoutes);
api.use('/companies', companiesRoutes);
api.use('/admin/organizations', organizationsRoutes);
api.use('/admin', (_req, res) => {
  res.json({ data: { status: 'ok' } });
});
api.use('/trips', tripsRouter);
api.use('/bookings', bookingsRouter);
