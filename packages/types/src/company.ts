import { z } from 'zod';

export const fuelCostRules = z.object({
  petrolPricePerL: z.number().default(105),
  dieselPricePerL: z.number().default(92),
  cngPricePerKg: z.number().default(78),
  evPricePerKwh: z.number().default(9),
});

/**
 * A bare email domain — "acme.co", never "someone@acme.co". Registration
 * auto-join compares this against the part after `@` in the signup address,
 * so anything holding an `@` silently matches nobody.
 */
export const emailDomain = z
  .string()
  .min(3)
  .max(120)
  .toLowerCase()
  .regex(
    /^(?!-)[a-z0-9-]+(?<!-)(\.(?!-)[a-z0-9-]+(?<!-))+$/,
    'must be a bare domain like "acme.co" — no "@", no scheme, no path'
  );

export const updateCompanySchema = z.object({
  name: z.string().min(2).max(160).optional(),
  logoUrl: z.string().url().optional(),
  domain: emailDomain.optional(),
  workingHours: z
    .object({
      start: z.string(),
      end: z.string(),
      days: z.array(z.number().int().min(0).max(6)),
    })
    .optional(),
  holidays: z.array(z.string()).optional(),
  ridePolicies: z
    .object({
      maxRideDistanceKm: z.number().optional(),
      womenOnlyAllowed: z.boolean().optional(),
      instantBookingAllowed: z.boolean().optional(),
    })
    .optional(),
  fuelCostRules: fuelCostRules.partial().optional(),
  travelAllowance: z.record(z.string(), z.number()).optional(),
});
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

// ---- Super-admin organization management ----
export const createOrgSchema = z.object({
  name: z.string().min(2).max(160),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, hyphens'),
  domain: emailDomain,
  // first Company Admin provisioned with the org
  adminName: z.string().min(2).max(120),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(128),
});
export type CreateOrgInput = z.infer<typeof createOrgSchema>;

export const updateOrgSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  domain: emailDomain.optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;

export const departmentSchema = z.object({ name: z.string().min(1).max(80) });

export const officeLocationSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().min(1).max(240),
  lat: z.number(),
  lng: z.number(),
});
