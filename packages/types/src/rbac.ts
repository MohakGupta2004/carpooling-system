import { z } from 'zod';

/**
 * Permission keys are `resource:action`. This list is the seed catalog and the
 * canonical set the UI can gate against. Roles/permissions remain editable at
 * runtime — this is the starting catalog, not a hard-coded policy.
 */
export const PERMISSIONS = [
  // self
  'profile:read',
  'profile:update',
  'session:manage',
  // rbac / admin
  'rbac:manage',
  'role:create',
  'role:update',
  'role:delete',
  'permission:read',
  'user:approve',
  'user:suspend',
  'user:read',
  'user:create',
  // company config
  'company:read',
  'company:configure',
  'department:manage',
  'officeLocation:manage',
  'costRules:manage',
  'policy:manage',
  // vehicles
  'vehicle:create',
  'vehicle:read',
  'vehicle:update',
  'vehicle:delete',
  'vehicle:verify',
  // rides / trips
  'ride:create',
  'ride:read',
  'ride:update',
  'ride:cancel',
  'ride:search',
  'booking:create',
  'booking:read',
  'booking:approve',
  'booking:cancel',
  'trip:read',
  'trip:start',
  'trip:complete',
  'trip:cancel',
  'tracking:publish',
  'tracking:view',
  // comms
  'chat:use',
  'call:use',
  'notification:read',
  // money
  'wallet:read',
  'wallet:recharge',
  'payment:create',
  'payment:read',
  'payment:refund',
  // reports
  'report:view:self',
  'report:view:org',
  'sustainability:view',
  'analytics:view',
  // super admin
  'org:manage',
  'platform:monitor',
  // safety
  'sos:trigger',
  'user:block',
  'user:report',
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  EMPLOYEE: 'EMPLOYEE',
} as const;

export const createRoleSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[A-Z0-9_]+$/, 'UPPER_SNAKE_CASE'),
  name: z.string().min(2).max(80),
  description: z.string().max(240).optional(),
});

export const setRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string()),
});

export const assignRoleSchema = z.object({ roleId: z.string() });

/** Admin-created account (e.g. Super Admin adding a Company Admin). */
export const createUserSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(['COMPANY_ADMIN', 'EMPLOYEE']), // never SUPER_ADMIN via this endpoint
  departmentId: z.string().optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const setOverridesSchema = z.object({
  overrides: z.array(
    z.object({
      permissionKey: z.string(),
      effect: z.enum(['ALLOW', 'DENY']),
    })
  ),
});
