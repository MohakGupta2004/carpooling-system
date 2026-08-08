import argon2 from 'argon2';
import crypto from 'node:crypto';

export const hashPassword = (plain: string) => argon2.hash(plain);
export const verifyPassword = (hash: string, plain: string) => argon2.verify(hash, plain);

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));
