import dotenv from 'dotenv';
import path from 'node:path';

// load root .env (monorepo) then local overrides
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing env var: ${key}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.API_PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', 'postgresql://rideloop:rideloop@localhost:5432/rideloop'),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev_access_secret_change_me'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_me'),
    accessTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
    refreshTtl: process.env.REFRESH_TOKEN_TTL ?? '30d',
  },
  googleMapsKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? '',
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
    url: process.env.CLOUDINARY_URL ?? '',
  },
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'RideBuddy <no-reply@rideloop.app>',
  },
} as const;
