import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';

import { env, isAllowedOrigin } from './env.js';
import { logger } from './logger.js';
import { initRealtime } from './server.js';

async function main() {
  const app = express();
  app.use(cors({ origin: (origin, cb) => cb(null, isAllowedOrigin(origin)), credentials: true }));
  app.get('/health', (_req, res) => res.json({ data: { status: 'ok', service: 'realtime' } }));

  const httpServer = createServer(app);
  initRealtime(httpServer);

  httpServer.listen(env.port, () => {
    logger.info(`📡 RideBuddy Realtime on http://localhost:${env.port} (${env.nodeEnv})`);
    logger.info(`   Socket.IO tracking · chat · notifications`);
  });

  const shutdown = (sig: string) => {
    logger.info({ sig }, 'shutting down');
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'fatal boot error');
  process.exit(1);
});
