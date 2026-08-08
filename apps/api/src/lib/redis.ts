import { Redis } from 'ioredis';

import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Redis is used for the RBAC permission cache, rate limiting, and the socket
 * adapter. If Redis is unavailable the app still boots — RBAC falls back to a
 * DB read (see rbac service), so local dev without Redis is possible.
 */
export const redis = new Redis(env.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
});

redis.on('error', (err) => logger.warn({ err: err.message }, 'redis error'));

export async function connectRedis(): Promise<boolean> {
  try {
    await redis.connect();
    logger.info('redis connected');
    return true;
  } catch (err) {
    logger.warn({ err }, 'redis unavailable — continuing without cache');
    return false;
  }
}
