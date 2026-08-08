import { Router } from 'express';

import { flags } from './config/flags';

const api = Router();
api.get('/health', (_req, res) => res.json({ data: { status: 'ok', flags } }));
api.use('/auth', (_req, res) => {
  res.send('Auth route');
});
