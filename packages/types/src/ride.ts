import { z } from 'zod';

import { place } from './common.js';

export const rideRules = z.object({
  noSmoking: z.boolean().default(true),
  noPets: z.boolean().default(false),
  noLoudMusic: z.boolean().default(false),
  luggageAllowed: z.boolean().default(true),
  womenOnly: z.boolean().default(false),
});

export const createRideSchema = z.object({
  vehicleId: z.string(),
  origin: place,
  destination: place,
  stops: z.array(place.extend({ order: z.number().int() })).optional(),
  departAt: z.string().datetime(),
  recurrence: z
    .object({
      days: z.array(z.number().int().min(0).max(6)),
      until: z.string().datetime().optional(),
    })
    .optional(),
  totalSeats: z.number().int().min(1).max(10),
  farePerSeat: z.number().int().min(0), // paise
  rules: rideRules.partial().optional(),
  bookingMode: z.enum(['INSTANT', 'APPROVAL']).default('INSTANT'),
  // How far off-route the driver will detour to collect a passenger (meters).
  maxDetourM: z.number().int().min(0).max(20000).default(3000),
  routePolyline: z.string().optional(),
  distanceM: z.number().int().optional(),
  durationS: z.number().int().optional(),
});
export type CreateRideInput = z.infer<typeof createRideSchema>;

/** Browse available rides that are within detour tolerance of my pickup. */
export const availableRidesSchema = z.object({
  pickup: place,
});
export type AvailableRidesInput = z.infer<typeof availableRidesSchema>;

export const searchRideSchema = z.object({
  pickup: place,
  destination: place,
  date: z.string(), // ISO date
  time: z.string().optional(), // HH:mm
  seats: z.number().int().min(1).max(8).default(1),
  recurring: z.boolean().default(false),
  filters: z
    .object({
      ac: z.boolean().optional(),
      gender: z.enum(['ANY', 'MALE', 'FEMALE']).optional(),
      minRating: z.number().min(0).max(5).optional(),
      ev: z.boolean().optional(),
      maxFare: z.number().int().optional(),
      radiusM: z.number().int().optional(),
      womenOnly: z.boolean().optional(),
    })
    .optional(),
  sort: z.enum(['DISTANCE', 'PRICE', 'RATING', 'ARRIVAL']).default('DISTANCE'),
});
export type SearchRideInput = z.infer<typeof searchRideSchema>;

export const routePreviewSchema = z.object({
  origin: place,
  destination: place,
  stops: z.array(place).optional(),
});
