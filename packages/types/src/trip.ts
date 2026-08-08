import { z } from 'zod';

import { place } from './common.js';

export const createBookingSchema = z.object({
  rideId: z.string(),
  seats: z.number().int().min(1).max(8).default(1),
  pickup: place,
  drop: place,
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const cancelSchema = z.object({ reason: z.string().max(240).optional() });

export const TRIP_STATUS = [
  'BOOKED',
  'CONFIRMED',
  'DRIVER_STARTED',
  'PASSENGER_PICKED',
  'IN_PROGRESS',
  'REACHED',
  'COMPLETED',
  'PAYMENT_PENDING',
  'PAYMENT_COMPLETED',
  'CANCELLED',
] as const;
export type TripStatus = (typeof TRIP_STATUS)[number];

/** PS-mandated subset shown in the UI timeline */
export const PS_TRIP_TIMELINE = [
  'BOOKED',
  'DRIVER_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'PAYMENT_PENDING',
  'PAYMENT_COMPLETED',
] as const;

export const publishLocationSchema = z.object({
  tripId: z.string(),
  lat: z.number(),
  lng: z.number(),
  speed: z.number().optional(),
  heading: z.number().optional(),
});
export type PublishLocationInput = z.infer<typeof publishLocationSchema>;

export const paymentMethodEnum = z.enum(['CASH', 'CARD', 'UPI', 'WALLET']);
export const createPaymentSchema = z.object({
  bookingId: z.string(),
  method: paymentMethodEnum,
});
