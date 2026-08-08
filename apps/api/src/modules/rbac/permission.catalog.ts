import { PERMISSIONS, type PermissionKey, SYSTEM_ROLES } from '@carpool/types';

/** Split "resource:action" (handles the "report:view:self" 3-part case). */
export function splitPermission(key: string): { resource: string; action: string } {
  const idx = key.indexOf(':');
  return { resource: key.slice(0, idx), action: key.slice(idx + 1) };
}

export const ALL_PERMISSIONS = PERMISSIONS;

/** Default seed mapping. Fully editable at runtime afterwards. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, readonly PermissionKey[]> = {
  [SYSTEM_ROLES.EMPLOYEE]: [
    'profile:read',
    'profile:update',
    'session:manage',
    'vehicle:create',
    'vehicle:read',
    'vehicle:update',
    'vehicle:delete',
    'ride:create',
    'ride:read',
    'ride:update',
    'ride:cancel',
    'ride:search',
    'booking:create',
    'booking:read',
    'booking:cancel',
    'trip:read',
    'trip:start',
    'trip:complete',
    'trip:cancel',
    'tracking:publish',
    'tracking:view',
    'chat:use',
    'call:use',
    'notification:read',
    'wallet:read',
    'wallet:recharge',
    'payment:create',
    'payment:read',
    'report:view:self',
    'sustainability:view',
    'sos:trigger',
    'user:block',
    'user:report',
    'user:read',
  ],
  [SYSTEM_ROLES.COMPANY_ADMIN]: [
    'profile:read',
    'profile:update',
    'session:manage',
    'company:read',
    'company:configure',
    'department:manage',
    'officeLocation:manage',
    'costRules:manage',
    'policy:manage',
    'user:approve',
    'user:suspend',
    'user:read',
    'user:create',
    'vehicle:read',
    'vehicle:verify',
    'rbac:manage',
    'role:create',
    'role:update',
    'role:delete',
    'permission:read',
    'trip:read',
    'notification:read',
    // Admins are management-only (no personal rides) — org analytics only, no
    // personal report:view:self.
    'report:view:org',
    'sustainability:view',
    'analytics:view',
  ],
  [SYSTEM_ROLES.SUPER_ADMIN]: [
    // Platform owner — organization management + cross-org analytics.
    'org:manage',
    'platform:monitor',
    'analytics:view',
    'report:view:org',
    'sustainability:view',
    'permission:read',
    'rbac:manage',
    // employee management (Employees tab — shared with Company Admin; hidden from staff)
    'user:read',
    'user:approve',
    'user:suspend',
    'user:create',
    // vehicle approvals (shared with Company Admin)
    'vehicle:read',
    'vehicle:verify',
  ],
};

export const SYSTEM_ROLE_META: Record<string, { name: string; description: string }> = {
  [SYSTEM_ROLES.SUPER_ADMIN]: { name: 'Super Admin', description: 'Platform owner' },
  [SYSTEM_ROLES.COMPANY_ADMIN]: {
    name: 'Company Admin',
    description: 'Organization configuration',
  },
  [SYSTEM_ROLES.EMPLOYEE]: { name: 'Employee', description: 'Primary platform user' },
};
