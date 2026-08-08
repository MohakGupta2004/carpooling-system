import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';

import { env, isAllowedOrigin } from './env.js';
import { etaSeconds, haversine } from './geo.js';
import { logger } from './logger.js';
import { prisma } from './prisma.js';

const RT_CHANNEL = 'rt:emit';

interface SocketUser {
  id: string;
  organizationId: string;
}

export function initRealtime(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: (origin, cb) => cb(null, isAllowedOrigin(origin)), credentials: true },
    path: '/socket.io',
  });

  // --- Redis: adapter (scale) + subscriber bridge (events from core API) ---
  const pubClient = new Redis(env.redisUrl, { maxRetriesPerRequest: null });
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  const bridge = new Redis(env.redisUrl, { maxRetriesPerRequest: null });
  bridge.subscribe(RT_CHANNEL, (err) => {
    if (err) logger.error({ err }, 'failed to subscribe to rt bridge');
    else logger.info('subscribed to core-API event bridge');
  });
  bridge.on('message', (_channel, raw) => {
    try {
      const { room, event, payload } = JSON.parse(raw) as {
        room: string;
        event: string;
        payload: unknown;
      };
      io.to(room).emit(event, payload);
    } catch (err) {
      logger.warn({ err }, 'bad bridge message');
    }
  });

  // --- Auth handshake ---
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('unauthorized'));
    try {
      const p = jwt.verify(token, env.jwtAccessSecret) as { sub: string; orgId: string };
      socket.data.user = { id: p.sub, organizationId: p.orgId } satisfies SocketUser;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as SocketUser;
    socket.join(`user:${user.id}`);
    socket.join(`org:${user.organizationId}`);
    logger.debug({ userId: user.id }, 'socket connected');

    // ---- Live tracking ----
    socket.on('trip:join', async ({ tripId }: { tripId: string }) => {
      if (await isParticipant(tripId, user.id)) {
        socket.join(`trip:${tripId}`);
        const trip = await prisma.trip.findUnique({ where: { id: tripId } });
        if (trip?.lastLat && trip?.lastLng) {
          socket.emit('location:update', {
            tripId,
            lat: Number(trip.lastLat),
            lng: Number(trip.lastLng),
            eta: trip.etaSeconds,
            at: Date.now(),
          });
        }
      }
    });

    socket.on(
      'location:publish',
      async (p: { tripId: string; lat: number; lng: number; speed?: number; heading?: number }) => {
        const trip = await prisma.trip.findUnique({
          where: { id: p.tripId },
          include: { ride: { select: { driverId: true, destLat: true, destLng: true } } },
        });
        // only the driver, and only while the trip is active (PS requirement)
        if (!trip || trip.ride.driverId !== user.id) return;
        if (!['DRIVER_STARTED', 'PASSENGER_PICKED', 'IN_PROGRESS'].includes(trip.status)) return;

        const remaining = haversine(
          { lat: p.lat, lng: p.lng },
          { lat: Number(trip.ride.destLat), lng: Number(trip.ride.destLng) }
        );
        const eta = etaSeconds(remaining, p.speed);

        await Promise.all([
          prisma.tripLocation.create({
            data: { tripId: p.tripId, lat: p.lat, lng: p.lng, speed: p.speed, heading: p.heading },
          }),
          prisma.trip.update({
            where: { id: p.tripId },
            data: { lastLat: p.lat, lastLng: p.lng, lastSpeed: p.speed, etaSeconds: eta },
          }),
        ]);

        io.to(`trip:${p.tripId}`).emit('location:update', {
          ...p,
          eta,
          remainingM: Math.round(remaining),
          at: Date.now(),
        });
        if (remaining < 200) io.to(`trip:${p.tripId}`).emit('arrival:alert', { tripId: p.tripId });
      }
    );

    // ---- Chat ----
    socket.on(
      'message:send',
      async (m: {
        tripId: string;
        body?: string;
        type?: string;
        mediaUrl?: string;
        lat?: number;
        lng?: number;
      }) => {
        if (!(await isParticipant(m.tripId, user.id))) return;
        const convo = await prisma.conversation.upsert({
          where: { tripId: m.tripId },
          create: { tripId: m.tripId },
          update: {},
        });
        const saved = await prisma.message.create({
          data: {
            conversationId: convo.id,
            senderId: user.id,
            type: (m.type as 'TEXT' | 'IMAGE' | 'LOCATION' | 'RIDE_INFO') ?? 'TEXT',
            body: m.body,
            mediaUrl: m.mediaUrl,
            lat: m.lat,
            lng: m.lng,
            readBy: [user.id],
          },
        });
        io.to(`trip:${m.tripId}`).emit('message:new', saved);
      }
    );

    socket.on('typing:start', ({ tripId }: { tripId: string }) =>
      socket.to(`trip:${tripId}`).emit('typing:start', { userId: user.id })
    );
    socket.on('typing:stop', ({ tripId }: { tripId: string }) =>
      socket.to(`trip:${tripId}`).emit('typing:stop', { userId: user.id })
    );

    socket.on('disconnect', () => logger.debug({ userId: user.id }, 'socket disconnected'));
  });

  return io;
}

async function isParticipant(tripId: string, userId: string): Promise<boolean> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { ride: { select: { driverId: true, bookings: { select: { passengerId: true } } } } },
  });
  if (!trip) return false;
  return trip.ride.driverId === userId || trip.ride.bookings.some((b) => b.passengerId === userId);
}
