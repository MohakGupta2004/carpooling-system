import crypto from 'node:crypto';

import { env } from '../config/env.js';
import { AppError } from './errors.js';
import { logger } from './logger.js';

const BASE = 'https://api.razorpay.com/v1';

export function isRazorpayConfigured(): boolean {
  return Boolean(env.razorpay.keyId && env.razorpay.keySecret);
}

function authHeader(): string {
  const token = Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`).toString('base64');
  return `Basic ${token}`;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt: string | null;
}

/** Create a Razorpay order (amount in paise). */
export async function createOrder(
  amountPaise: number,
  receipt: string,
  notes: Record<string, string> = {}
): Promise<RazorpayOrder> {
  if (!isRazorpayConfigured())
    throw new AppError(503, 'PAYMENTS_UNAVAILABLE', 'Razorpay is not configured');

  const res = await fetch(`${BASE}/orders`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
  });

  const json = (await res.json()) as RazorpayOrder & { error?: { description?: string } };
  if (!res.ok) {
    logger.error({ status: res.status, body: json }, 'razorpay order failed');
    throw new AppError(502, 'PAYMENT_GATEWAY', json.error?.description ?? 'Failed to create order');
  }
  return json;
}

/** Fetch an order (authoritative amount/status) — used during verification. */
export async function fetchOrder(
  orderId: string
): Promise<RazorpayOrder & { amount_paid: number }> {
  const res = await fetch(`${BASE}/orders/${orderId}`, {
    headers: { Authorization: authHeader() },
  });
  const json = (await res.json()) as RazorpayOrder & {
    amount_paid: number;
    error?: { description?: string };
  };
  if (!res.ok)
    throw new AppError(502, 'PAYMENT_GATEWAY', json.error?.description ?? 'Failed to fetch order');
  return json;
}

/** Verify the checkout callback signature: HMAC_SHA256(order_id|payment_id). */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeEqual(expected, signature);
}

/** Verify a webhook payload signature against the raw request body. */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
  const secret = env.razorpay.webhookSecret || env.razorpay.keySecret;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export const razorpayKeyId = () => env.razorpay.keyId;
