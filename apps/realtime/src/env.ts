import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.REALTIME_PORT ?? 4001),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret_change_me',
  googleMapsKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
} as const;

// Cloudflare / ngrok tunnel hosts (random subdomains → match by suffix).
const TUNNEL_RE = /\.(trycloudflare\.com|ngrok\.io|ngrok-free\.app|ngrok\.app|ngrok\.dev)$/i;
export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true; // non-browser clients
  if (env.corsOrigin.includes(origin)) return true;
  try {
    return TUNNEL_RE.test(new URL(origin).hostname);
  } catch {
    return false;
  }
}
