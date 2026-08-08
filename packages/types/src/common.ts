import { z } from 'zod';

export const paginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

// coerce: saved-place coords arrive as strings (Prisma Decimal → JSON string),
// so accept numeric strings as well as numbers everywhere coordinates are used.
export const latLng = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof latLng>;

export const place = latLng.extend({
  label: z.string().min(1),
});
export type Place = z.infer<typeof place>;

export type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> };
export type ApiError = {
  error: { code: string; message: string; details?: unknown };
};
