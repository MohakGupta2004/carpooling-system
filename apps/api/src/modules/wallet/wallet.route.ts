import { Router } from 'express';
import { z } from 'zod';

import { BadRequest } from '../../lib/errors.js';
import { asyncHandler, ok } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import {
  createOrder,
  fetchOrder,
  isRazorpayConfigured,
  razorpayKeyId,
  verifyPaymentSignature,
} from '../../lib/razorpay.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate, vbody } from '../../middleware/validate.js';

const router = Router();
router.use(authenticate);

async function ensureWallet(userId: string) {
  return prisma.wallet.upsert({ where: { userId }, create: { userId }, update: {} });
}

router.get(
  '/',
  requirePermission('wallet:read'),
  asyncHandler(async (req, res) => ok(res, await ensureWallet(req.user!.id)))
);

router.get(
  '/transactions',
  requirePermission('wallet:read'),
  asyncHandler(async (req, res) => {
    const wallet = await ensureWallet(req.user!.id);
    ok(
      res,
      await prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    );
  })
);

const amountSchema = z.object({ amount: z.number().int().min(100).max(10000000) });

/**
 * Step 1 — create a Razorpay order for a wallet top-up. The client opens
 * Razorpay Checkout with the returned orderId + keyId.
 * If Razorpay is not configured, falls back to an instant dev credit.
 */
router.post(
  '/recharge/order',
  requirePermission('wallet:recharge'),
  validate({ body: amountSchema }),
  asyncHandler(async (req, res) => {
    const { amount } = vbody<{ amount: number }>(req);
    const wallet = await ensureWallet(req.user!.id);

    if (!isRazorpayConfigured()) {
      const updated = await creditWallet(wallet.id, amount, 'Wallet recharge (dev)');
      return ok(res, { fallback: true, wallet: updated });
    }

    const receipt = `wlt_${wallet.id.slice(-10)}_${Date.now().toString(36)}`.slice(0, 40);
    const order = await createOrder(amount, receipt, {
      userId: req.user!.id,
      purpose: 'wallet_topup',
    });
    ok(res, {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayKeyId(),
      prefillEmail: req.user!.email,
    });
  })
);

/** Step 2 — verify the checkout signature and credit the wallet. */
router.post(
  '/recharge/verify',
  requirePermission('wallet:recharge'),
  validate({
    body: z.object({
      orderId: z.string(),
      paymentId: z.string(),
      signature: z.string(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { orderId, paymentId, signature } = vbody<{
      orderId: string;
      paymentId: string;
      signature: string;
    }>(req);
    if (!verifyPaymentSignature(orderId, paymentId, signature))
      throw BadRequest('Invalid payment signature');

    const order = await fetchOrder(orderId); // authoritative amount from the gateway
    const wallet = await ensureWallet(req.user!.id);

    // idempotency: don't double-credit the same payment
    const existing = await prisma.walletTransaction.findFirst({
      where: { walletId: wallet.id, reference: paymentId },
    });
    if (existing) return ok(res, { alreadyProcessed: true, wallet });

    const updated = await creditWallet(
      wallet.id,
      order.amount,
      'Wallet recharge (Razorpay)',
      paymentId
    );
    ok(res, { verified: true, wallet: updated });
  })
);

/** Legacy/dev direct credit (kept for tests when gateway is off). */
router.post(
  '/recharge',
  requirePermission('wallet:recharge'),
  validate({ body: amountSchema }),
  asyncHandler(async (req, res) => {
    const { amount } = vbody<{ amount: number }>(req);
    const wallet = await ensureWallet(req.user!.id);
    ok(res, await creditWallet(wallet.id, amount, 'Wallet recharge'));
  })
);

async function creditWallet(walletId: string, amount: number, note: string, reference?: string) {
  return prisma.$transaction(async (tx) => {
    const w = await tx.wallet.update({
      where: { id: walletId },
      data: { balance: { increment: amount } },
    });
    await tx.walletTransaction.create({
      data: { walletId, type: 'RECHARGE', amount, balanceAfter: w.balance, note, reference },
    });
    return w;
  });
}

export default router;
