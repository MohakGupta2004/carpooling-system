import { Router } from 'express';

import { flags } from './config/flags.js';
import adminRoutes from './modules/admin/admin.route.ts';
import authRoutes from './modules/auth/auth.route.ts';
import companiesRoutes from './modules/companies/companies.route.ts';
import mapsRoutes from './modules/maps/map.route.ts';
import {
  historyRouter,
  notificationsRouter,
  reviewsRouter,
  sosRouter,
} from './modules/misc/misc.route.ts';
import organizationsRoutes from './modules/organizations/organizations.route.ts';
import reportsRoutes from './modules/reports/reports.routes.js';
import { bookingsRouter, tripsRouter } from './modules/trips/trips.route.ts';
import userRoutes from './modules/user/user.route.ts';

export const api = Router();
api.get('/health', (_req, res) => res.json({ data: { status: 'ok', flags } }));
api.use('/auth', authRoutes);
api.use('/users', userRoutes);
api.use('/companies', companiesRoutes);
api.use('/admin/organizations', organizationsRoutes);
api.use('/admin', adminRoutes);
api.use('/trips', tripsRouter);
api.use('/bookings', bookingsRouter);
api.use('/reports', reportsRoutes);

api.use('/maps', mapsRoutes);
api.use('/history', historyRouter);
api.use('/notifications', notificationsRouter);
api.use('/reviews', reviewsRouter);
api.use('/sos', sosRouter);
