import { Router } from 'express';

import { flags } from './config/flags.js';
import authRoutes from './modules/auth/auth.route.js';

export const api = Router();
api.get('/health', (_req, res) => res.json({ data: { status: 'ok', flags } }));
api.use('/auth', authRoutes);
