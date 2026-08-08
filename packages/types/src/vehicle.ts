import { z } from 'zod';

export const vehicleTypeEnum = z.enum(['CAR', 'BIKE', 'EV']);
export const fuelTypeEnum = z.enum(['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID']);

export const createVehicleSchema = z
  .object({
    type: vehicleTypeEnum,
    brand: z.string().min(1).max(60),
    model: z.string().min(1).max(60),
    registrationNo: z.string().min(3).max(20),
    licenseNo: z.string().min(3).max(30),
    driverName: z.string().min(1).max(60),
    // AC only applies to four-wheelers; bikes never have AC, decided at runtime.
    isAc: z.boolean().optional(),
    color: z.string().max(30).optional(),
    fuelType: fuelTypeEnum,
    seats: z.number().int().min(1).max(10),
    insuranceNo: z.string().max(40).optional(),
    pucValidTill: z.string().datetime().optional(),
    photos: z.array(z.string().url()).max(6).optional(),
  })
  .transform((data) => ({ ...data, isAc: data.type === 'BIKE' ? false : (data.isAc ?? false) }));
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = z
  .object({
    type: vehicleTypeEnum,
    brand: z.string().min(1).max(60),
    model: z.string().min(1).max(60),
    registrationNo: z.string().min(3).max(20),
    licenseNo: z.string().min(3).max(30),
    driverName: z.string().min(1).max(60),
    isAc: z.boolean().optional(),
    color: z.string().max(30).optional(),
    fuelType: fuelTypeEnum,
    seats: z.number().int().min(1).max(10),
    insuranceNo: z.string().max(40).optional(),
    pucValidTill: z.string().datetime().optional(),
    photos: z.array(z.string().url()).max(6).optional(),
  })
  .partial()
  .transform((data) => ({ ...data, isAc: data.type === 'BIKE' ? false : data.isAc }));
