import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { api } from './routes.js';

// Cloudflare / ngrok tunnel hosts (subdomains are random, so match by suffix).
const TUNNEL_RE = /\.(trycloudflare\.com|ngrok\.io|ngrok-free\.app|ngrok\.app|ngrok\.dev)$/i;
function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true; // non-browser clients (curl, mobile, server-to-server)
  if (env.corsOrigin.includes(origin)) return true;
  try {
    return TUNNEL_RE.test(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: (origin, cb) => cb(null, isAllowedOrigin(origin)), credentials: true }));
  app.use(
    express.json({
      limit: '2mb',
      // stash the raw body so the Razorpay webhook can verify its signature
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/v1/health' } }));
  app.use(globalLimiter);

  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
