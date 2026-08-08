import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env.js';

export interface AccessTokenPayload {
  sub: string; // userId
  orgId: string;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): { token: string; expiresIn: number } {
  const token = jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessTtl as SignOptions['expiresIn'],
  });
  const decoded = jwt.decode(token) as { exp: number; iat: number };
  return { token, expiresIn: decoded.exp - decoded.iat };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTtl as SignOptions['expiresIn'],
  });
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.jwt.refreshSecret) as { sub: string };
}
