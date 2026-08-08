import { createPaymentSchema } from '@carpooling-system/types';
import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';

import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import { asyncHandler, created, ok } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import {
  createOrder,
  isRazorpayConfigured,
  razorpayKeyId,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from '../../lib/razorpay.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate, vbody, vparams } from '../../middleware/validate.js';
import { notifyUser } from '../../realtime/emit.js';

const router = Router();

// ---- Webhook (public, signature-verified) — defined BEFORE auth middleware ----
router.post(
  '/razorpay/webhook',
  asyncHandler(async (req: Request, res) => {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const raw =
      (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));
    if (!signature || !verifyWebhookSignature(raw, signature)) {
      return res
        .status(400)
        .json({ error: { code: 'BAD_SIGNATURE', message: 'Invalid webhook signature' } });
    }

    const event = req.body?.event as string;
    const entity = req.body?.payload?.payment?.entity;
    if (event === 'payment.captured' && entity?.order_id) {
      const payment = await prisma.payment.findFirst({
        where: { providerOrderId: entity.order_id },
      });
      if (payment && payment.status !== 'PAID') {
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: 'PAID', providerPaymentId: entity.id },
          });
          await settleTripIfPaid(tx, payment.bookingId);
        });
        logger.info({ orderId: entity.order_id }, 'razorpay webhook: payment settled');
      }
    }
    res.json({ received: true });
  })
);

router.use(authenticate);

// ---- Wallet & cash (internal, no gateway) ----
router.post(
  '/',
  requirePermission('payment:create'),
  validate({ body: createPaymentSchema }),
  asyncHandler(async (req, res) => {
    const { bookingId, method } = vbody<z.infer<typeof createPaymentSchema>>(req);
    if (method === 'CARD' || method === 'UPI')
      throw BadRequest('Use /payments/order for card/UPI payments');

    const booking = await loadPayableBooking(bookingId, req.user!.id);

    // Cash is settled only once the DRIVER confirms receipt (see confirm-cash);
    // it starts PENDING and does not settle the trip yet. Wallet is instant.
    const isCash = method === 'CASH';

    const payment = await prisma.$transaction(async (tx) => {
      if (method === 'WALLET') {
        const wallet = await tx.wallet.upsert({
          where: { userId: req.user!.id },
          create: { userId: req.user!.id },
          update: {},
        });
        if (wallet.balance < booking.fareAmount) throw BadRequest('Insufficient wallet balance');
        const w = await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: booking.fareAmount } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'RIDE_DEBIT',
            amount: -booking.fareAmount,
            balanceAfter: w.balance,
            reference: bookingId,
            note: 'Ride payment',
          },
        });
      }
      const p = await tx.payment.upsert({
        where: { bookingId },
        create: {
          organizationId: booking.ride.organizationId,
          bookingId,
          payerId: req.user!.id,
          amount: booking.fareAmount,
          method,
          status: isCash ? 'PENDING' : 'PAID',
          invoiceNo: invoiceNo(bookingId),
        },
        update: { method, status: isCash ? 'PENDING' : 'PAID' },
      });
      if (!isCash) await settleTripIfPaid(tx, bookingId);
      return p;
    });

    if (isCash) {
      void notifyUser(booking.ride.driverId, {
        type: 'CASH_PENDING',
        title: 'Cash payment',
        body: `A passenger will pay ₹${(booking.fareAmount / 100).toFixed(2)} in cash — confirm once collected.`,
      });
    } else {
      notifyDriverPaid(booking.ride.driverId, booking.fareAmount, method);
    }
    created(res, payment);
  })
);

// ---- Cash: driver confirms receipt → settles the passenger's payment ----
router.post(
  '/:bookingId/confirm-cash',
  requirePermission('payment:create'),
  validate({ params: z.object({ bookingId: z.string() }) }),
  asyncHandler(async (req, res) => {
    const { bookingId } = vparams<{ bookingId: string }>(req);
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId },
      include: { ride: { select: { driverId: true } }, payment: true },
    });
    if (!booking) throw NotFound('Booking not found');
    if (booking.ride.driverId !== req.user!.id) throw Forbidden('Only the driver can confirm cash');
    if (!booking.payment || booking.payment.method !== 'CASH')
      throw BadRequest('No cash payment to confirm');
    if (booking.payment.status === 'PAID') return ok(res, booking.payment);

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({ where: { bookingId }, data: { status: 'PAID' } });
      await settleTripIfPaid(tx, bookingId);
      return p;
    });
    void notifyUser(booking.passengerId, {
      type: 'PAYMENT_DONE',
      title: 'Cash confirmed',
      body: 'Your driver confirmed the cash payment. Thanks!',
    });
    ok(res, updated);
  })
);

// ---- Card / UPI via Razorpay: order → checkout → verify ----
router.post(
  '/order',
  requirePermission('payment:create'),
  validate({ body: z.object({ bookingId: z.string(), method: z.enum(['CARD', 'UPI']) }) }),
  asyncHandler(async (req, res) => {
    const { bookingId, method } = vbody<{ bookingId: string; method: 'CARD' | 'UPI' }>(req);
    if (!isRazorpayConfigured())
      throw BadRequest('Card/UPI payments are unavailable (gateway not configured)');
    const booking = await loadPayableBooking(bookingId, req.user!.id);

    const receipt = `bkg_${bookingId.slice(-12)}_${Date.now().toString(36)}`.slice(0, 40);
    const order = await createOrder(booking.fareAmount, receipt, {
      bookingId,
      payerId: req.user!.id,
      purpose: 'ride_payment',
    });

    await prisma.payment.upsert({
      where: { bookingId },
      create: {
        organizationId: booking.ride.organizationId,
        bookingId,
        payerId: req.user!.id,
        amount: booking.fareAmount,
        method,
        status: 'PENDING',
        provider: 'razorpay',
        providerOrderId: order.id,
        invoiceNo: invoiceNo(bookingId),
      },
      update: { method, provider: 'razorpay', providerOrderId: order.id, status: 'PENDING' },
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

router.post(
  '/verify',
  requirePermission('payment:create'),
  validate({
    body: z.object({ orderId: z.string(), paymentId: z.string(), signature: z.string() }),
  }),
  asyncHandler(async (req, res) => {
    const { orderId, paymentId, signature } = vbody<{
      orderId: string;
      paymentId: string;
      signature: string;
    }>(req);
    if (!verifyPaymentSignature(orderId, paymentId, signature))
      throw BadRequest('Invalid payment signature');

    const payment = await prisma.payment.findFirst({
      where: { providerOrderId: orderId, payerId: req.user!.id },
      include: { booking: { include: { ride: { select: { driverId: true } } } } },
    });
    if (!payment) throw NotFound('Payment not found');

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'PAID', providerPaymentId: paymentId },
      });
      await settleTripIfPaid(tx, payment.bookingId);
      return p;
    });
    notifyDriverPaid(payment.booking.ride.driverId, payment.amount, payment.method);
    ok(res, { verified: true, payment: updated });
  })
);

router.get(
  '/:id/receipt',
  requirePermission('payment:read'),
  validate({ params: z.object({ id: z.string() }) }),
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findFirst({
      where: { id: vparams<{ id: string }>(req).id, payerId: req.user!.id },
      include: {
        booking: { include: { ride: { include: { driver: { select: { fullName: true } } } } } },
      },
    });
    if (!payment) throw NotFound('Payment not found');
    ok(res, payment);
  })
);

// ---- helpers ----
async function loadPayableBooking(bookingId: string, payerId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, passengerId: payerId },
    include: { ride: true, payment: true },
  });
  if (!booking) throw NotFound('Booking not found');
  if (booking.payment?.status === 'PAID') throw BadRequest('Already paid');
  if (booking.status !== 'COMPLETED') throw BadRequest('Trip not completed yet');
  return booking;
}

async function settleTripIfPaid(tx: Prisma.TransactionClient, bookingId: string) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: { rideId: true },
  });
  if (!booking) return;
  const unpaid = await tx.booking.count({
    where: {
      rideId: booking.rideId,
      status: 'COMPLETED',
      OR: [{ payment: { is: null } }, { payment: { status: { not: 'PAID' } } }],
    },
  });
  if (unpaid === 0) {
    await tx.trip.updateMany({
      where: { rideId: booking.rideId },
      data: { status: 'PAYMENT_COMPLETED' },
    });
  }
}

function notifyDriverPaid(driverId: string, amount: number, method: string) {
  void notifyUser(driverId, {
    type: 'PAYMENT_DONE',
    title: 'Payment received',
    body: `₹${(amount / 100).toFixed(2)} via ${method}.`,
  });
}

const invoiceNo = (bookingId: string) => `INV-${bookingId.slice(-6).toUpperCase()}`;

export default router;
