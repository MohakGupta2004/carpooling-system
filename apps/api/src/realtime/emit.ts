import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

/**
 * The core API is HTTP-only — it does NOT host WebSocket connections. When
 * business logic needs to push a realtime event (e.g. "booking accepted"), it
 * publishes to Redis; the standalone realtime microservice subscribes and
 * fans the event out to the right socket rooms. This keeps socket load off the
 * core backend.
 */
export const RT_CHANNEL = 'rt:emit';

interface RtMessage {
  room: string;
  event: string;
  payload: unknown;
}

async function publish(msg: RtMessage) {
  try {
    await redis.publish(RT_CHANNEL, JSON.stringify(msg));
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'rt publish failed');
  }
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  void publish({ room: `user:${userId}`, event, payload });
}

/**
 * Persist a notification AND push it live over the socket in one call. Persisting
 * gives it a stable id + survives reloads; the socket payload carries that same
 * id so the client can dedupe and mark it read. Fire-and-forget — errors logged.
 */
export async function notifyUser(
  userId: string,
  n: { type: string; title: string; body: string; link?: string }
) {
  try {
    const row = await prisma.notification.create({
      data: {
        userId,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.link ? { link: n.link } : undefined,
      },
    });
    emitToUser(userId, 'notify:new', {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: row.data,
      readAt: null,
      createdAt: row.createdAt,
    });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'notifyUser failed');
  }
}

export function emitToTrip(tripId: string, event: string, payload: unknown) {
  void publish({ room: `trip:${tripId}`, event, payload });
}

export function emitToOrg(orgId: string, event: string, payload: unknown) {
  void publish({ room: `org:${orgId}`, event, payload });
}
