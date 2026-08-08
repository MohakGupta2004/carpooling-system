import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { splitPermission } from './permission.catalog.ts';

const CACHE_TTL = 300; // seconds

/**
 * Permissions that confer control over access/platform itself. Granting these
 * requires the actor to already hold them (prevents privilege escalation).
 * All other (operational) permissions can be granted by any `rbac:manage`
 * holder — e.g. a Company Admin configuring what Employees can do, even for
 * permissions the admin does not personally use.
 */
const ELEVATED_PERMISSIONS = new Set([
  'rbac:manage',
  'role:create',
  'role:update',
  'role:delete',
  'org:manage',
  'platform:monitor',
  'user:approve',
  'user:suspend',
]);

/** Current permission version for an org (drives cache invalidation). */
async function permVersion(orgId: string): Promise<number> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { permVersion: true },
  });
  return org?.permVersion ?? 1;
}

/**
 * Bump the org's permission version. This atomically invalidates ALL cached
 * permission sets for the org (keys embed the version), so any RBAC edit takes
 * effect on the next request — no per-key deletion, no redeploy.
 */
export async function bumpPermVersion(orgId: string): Promise<void> {
  await prisma.organization.update({
    where: { id: orgId },
    data: { permVersion: { increment: 1 } },
  });
}

/**
 * Effective permissions = (union of role permissions + ALLOW overrides) − DENY overrides.
 * DENY always wins. Cached in Redis under a version-scoped key.
 */
export async function getEffectivePermissions(userId: string, orgId: string): Promise<Set<string>> {
  const version = await permVersion(orgId);
  const cacheKey = `perms:${userId}:v${version}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return new Set(JSON.parse(cached) as string[]);
  } catch {
    /* redis down — fall through to DB */
  }

  const [roleGrants, overrides] = await Promise.all([
    prisma.rolePermission.findMany({
      where: { role: { users: { some: { userId } } } },
      select: { permission: { select: { key: true } } },
    }),
    prisma.userPermission.findMany({
      where: { userId },
      select: { effect: true, permission: { select: { key: true } } },
    }),
  ]);

  const set = new Set<string>(
    roleGrants.map((g: { permission: { key: string } }) => g.permission.key)
  );
  for (const o of overrides) {
    if (o.effect === 'ALLOW') set.add(o.permission.key);
    else set.delete(o.permission.key); // DENY wins
  }

  try {
    await redis.set(cacheKey, JSON.stringify([...set]), 'EX', CACHE_TTL);
  } catch {
    /* ignore cache write failure */
  }
  return set;
}

// ---- Management operations (all bump perm version) --------------------------

// Platform-owner privileges — hidden from Company Admins (only Super Admins
// manage these, and only they should see the SUPER_ADMIN role at all).
const SUPER_ADMIN_ONLY_PERMISSIONS = new Set(['org:manage', 'platform:monitor']);

export async function listPermissions(isSuper = true) {
  const perms = await prisma.permission.findMany({
    orderBy: [{ resource: 'asc' }, { action: 'asc' }],
  });
  return isSuper
    ? perms
    : perms.filter((p: { key: string }) => !SUPER_ADMIN_ONLY_PERMISSIONS.has(p.key));
}

export async function listRoles(orgId: string, isSuper = true) {
  const roles = await prisma.role.findMany({
    where: { OR: [{ organizationId: orgId }, { organizationId: null, isSystem: true }] },
    include: {
      permissions: { select: { permission: { select: { key: true } } } },
      _count: { select: { users: true } },
    },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });
  return isSuper ? roles : roles.filter((r: { key: string }) => r.key !== 'SUPER_ADMIN');
}

export async function createRole(
  orgId: string,
  data: { key: string; name: string; description?: string }
) {
  const exists = await prisma.role.findUnique({
    where: { organizationId_key: { organizationId: orgId, key: data.key } },
  });
  if (exists) throw BadRequest('A role with this key already exists');
  return prisma.role.create({ data: { ...data, organizationId: orgId, isSystem: false } });
}

async function requireOrgRole(orgId: string, roleId: string) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw NotFound('Role not found');
  // system roles are global templates cloned per org at seed; guard org roles here
  if (role.organizationId && role.organizationId !== orgId)
    throw Forbidden('Cannot manage a role from another organization');
  return role;
}

export async function updateRole(
  orgId: string,
  roleId: string,
  data: { name?: string; description?: string }
) {
  await requireOrgRole(orgId, roleId);
  return prisma.role.update({ where: { id: roleId }, data });
}

export async function deleteRole(orgId: string, roleId: string) {
  const role = await requireOrgRole(orgId, roleId);
  if (role.isSystem) throw Forbidden('System roles cannot be deleted');
  await prisma.role.delete({ where: { id: roleId } });
  await bumpPermVersion(orgId);
}

/**
 * Replace a role's permission set. Guardrail: the actor cannot grant a
 * permission they do not themselves hold (no privilege escalation).
 */
export async function setRolePermissions(
  orgId: string,
  actorId: string,
  roleId: string,
  permissionKeys: string[]
) {
  await requireOrgRole(orgId, roleId);
  const actorPerms = await getEffectivePermissions(actorId, orgId);
  // Only elevated (access/platform) permissions require the actor to hold them.
  const escalating = permissionKeys.filter(
    (k) => ELEVATED_PERMISSIONS.has(k) && !actorPerms.has(k)
  );
  if (escalating.length > 0)
    throw Forbidden('Cannot grant elevated permissions you do not hold', { escalating });

  const perms = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } },
    select: { id: true, key: true },
  });

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: perms.map((p: { id: string }) => ({ roleId, permissionId: p.id })),
      skipDuplicates: true,
    }),
  ]);
  await bumpPermVersion(orgId);
  await writeAudit(orgId, actorId, 'role.permissions.set', roleId, { permissionKeys });
  logger.info({ orgId, roleId, count: perms.length }, 'role permissions updated');
  return perms.map((p: { key: string }) => p.key);
}

export async function assignRole(orgId: string, actorId: string, userId: string, roleId: string) {
  await requireOrgRole(orgId, roleId);
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    create: { userId, roleId },
    update: {},
  });
  await bumpPermVersion(orgId);
  await writeAudit(orgId, actorId, 'user.role.assign', userId, { roleId });
}

export async function removeRole(orgId: string, actorId: string, userId: string, roleId: string) {
  await prisma.userRole.deleteMany({ where: { userId, roleId } });
  await bumpPermVersion(orgId);
  await writeAudit(orgId, actorId, 'user.role.remove', userId, { roleId });
}

export async function setUserOverrides(
  orgId: string,
  actorId: string,
  userId: string,
  overrides: { permissionKey: string; effect: 'ALLOW' | 'DENY' }[]
) {
  const perms = await prisma.permission.findMany({
    where: { key: { in: overrides.map((o) => o.permissionKey) } },
    select: { id: true, key: true },
  });
  const byKey = new Map(perms.map((p: { key: string; id: string }) => [p.key, p.id]));

  await prisma.$transaction([
    prisma.userPermission.deleteMany({ where: { userId } }),
    prisma.userPermission.createMany({
      data: overrides
        .filter((o) => byKey.has(o.permissionKey))
        .map((o) => ({ userId, permissionId: byKey.get(o.permissionKey)!, effect: o.effect })),
      skipDuplicates: true,
    }),
  ]);
  await bumpPermVersion(orgId);
  await writeAudit(orgId, actorId, 'user.overrides.set', userId, { overrides });
}

export async function getAuditLog(orgId: string) {
  return prisma.auditLog.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

async function writeAudit(
  orgId: string,
  actorId: string,
  action: string,
  target: string,
  after: unknown
) {
  await prisma.auditLog.create({
    data: { organizationId: orgId, actorId, action, target, after: after as object },
  });
}

export { splitPermission };
