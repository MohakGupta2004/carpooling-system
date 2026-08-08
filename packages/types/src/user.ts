import { z } from 'zod';

export const genderEnum = z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_SAY']);

export const userPreferences = z.object({
  pickupRadiusM: z.number().int().min(0).max(20000).default(1500),
  smokingAllowed: z.boolean().default(false),
  musicPreference: z.enum(['ANY', 'NO_MUSIC', 'SOFT', 'LOUD']).default('ANY'),
  acPreference: z.enum(['ANY', 'AC', 'NON_AC']).default('ANY'),
  womenOnly: z.boolean().default(false),
  language: z.string().default('en'),
  preferredSeat: z.enum(['ANY', 'FRONT', 'BACK']).default('ANY'),
});
export type UserPreferences = z.infer<typeof userPreferences>;

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().min(6).max(20).optional(),
  gender: genderEnum.optional(),
  photoUrl: z.string().max(1000).optional(),
  employeeCode: z.string().max(40).optional(),
  departmentId: z.string().optional(),
  homeAddress: z.string().max(240).optional(),
  homeLat: z.number().optional(),
  homeLng: z.number().optional(),
  emergencyName: z.string().max(120).optional(),
  emergencyPhone: z.string().max(20).optional(),
  preferences: userPreferences.partial().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const savedPlaceSchema = z.object({
  label: z.string().min(1).max(60),
  address: z.string().min(1).max(240),
  lat: z.number(),
  lng: z.number(),
});
export type SavedPlaceInput = z.infer<typeof savedPlaceSchema>;
