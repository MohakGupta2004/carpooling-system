import { type CreateOrgInput, SYSTEM_ROLES, type UpdateOrgInput } from '@carpool/types';

import { Conflict, NotFound } from '../../lib/errors.js';
import { hashPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { DEFAULT_ROLE_PERMISSIONS, SYSTEM_ROLE_META } from '../rbac/permission.catalog.ts';

// Same sensible defaults the seed uses, so a new org is immediately functional.
const ORG_DEFAULTS = {
  fuelCostRules: { petrolPricePerL: 105, dieselPricePerL: 92, cngPricePerKg: 78, evPricePerKwh: 9 },
  ridePolicies: { maxRideDistanceKm: 60, womenOnlyAllowed: true, instantBookingAllowed: true },
  workingHours: { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] },
};

/** Every organization visible to the super admin, with headline counts. */
export async function listOrganizations() {
  const [orgs, vehByOrg, rideByOrg] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { users: true, departments: true } } },
    }),
    prisma.vehicle.groupBy({
      by: ['organizationId'],
      where: { deletedAt: null },
      _count: { organizationId: true },
    }),
    prisma.ride.groupBy({ by: ['organizationId'], _count: { organizationId: true } }),
  ]);
  const veh = new Map(vehByOrg.map((v) => [v.organizationId, v._count.organizationId]));
  const rides = new Map(rideByOrg.map((r) => [r.organizationId, r._count.organizationId]));
  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    domain: o.domain,
    status: o.status,
    createdAt: o.createdAt,
    counts: {
      users: o._count.users,
      departments: o._count.departments,
      vehicles: veh.get(o.id) ?? 0,
      rides: rides.get(o.id) ?? 0,
    },
  }));
}

/** Full detail of one org — profile, admins, every employee, departments, offices. */
export async function getOrganization(id: string) {
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      departments: { select: { id: true, name: true } },
      officeLocations: { select: { id: true, name: true, address: true } },
      users: {
        // Super Admins are platform operators — never shown among a company's people.
        where: { deletedAt: null, NOT: { roles: { some: { role: { key: 'SUPER_ADMIN' } } } } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          status: true,
          photoUrl: true,
          createdAt: true,
          department: { select: { name: true } },
          roles: { select: { role: { select: { key: true, name: true } } } },
        },
      },
    },
  });
  if (!org) throw NotFound('Organization not found');
  const [vehicles, rides] = await Promise.all([
    prisma.vehicle.count({ where: { organizationId: id, deletedAt: null } }),
    prisma.ride.count({ where: { organizationId: id } }),
  ]);
  return {
    ...org,
    counts: { users: org.users.length, vehicles, rides, departments: org.departments.length },
  };
}

/**
 * Provision a brand-new organization: the org, its per-org system roles with the
 * default permission grants, and its first Company Admin — all in one transaction
 * so a partial org can never exist.
 */
export async function createOrganization(input: CreateOrgInput) {
  if (await prisma.organization.findUnique({ where: { slug: input.slug } }))
    throw Conflict('An organization with this slug already exists');
  if (await prisma.organization.findFirst({ where: { domain: input.domain } }))
    throw Conflict('An organization with this domain already exists');

  const perms = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permByKey = new Map(perms.map((p) => [p.key, p.id]));
  const passwordHash = await hashPassword(input.adminPassword);

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
        domain: input.domain,
        status: 'ACTIVE',
        ...ORG_DEFAULTS,
      },
    });

    const roleIdByKey: Record<string, string> = {};
    for (const key of Object.values(SYSTEM_ROLES)) {
      const meta = SYSTEM_ROLE_META[key]!;
      const role = await tx.role.create({
        data: {
          organizationId: org.id,
          key,
          name: meta.name,
          description: meta.description,
          isSystem: true,
        },
      });
      roleIdByKey[key] = role.id;
      const grants = (DEFAULT_ROLE_PERMISSIONS[key] ?? [])
        .map((pk) => ({ roleId: role.id, permissionId: permByKey.get(pk)! }))
        .filter((r) => r.permissionId);
      if (grants.length) await tx.rolePermission.createMany({ data: grants, skipDuplicates: true });
    }

    const admin = await tx.user.create({
      data: {
        organizationId: org.id,
        email: input.adminEmail,
        fullName: input.adminName,
        passwordHash,
        status: 'ACTIVE',
        emailVerified: true,
        roles: { create: { roleId: roleIdByKey[SYSTEM_ROLES.COMPANY_ADMIN]! } },
        wallet: { create: {} },
      },
      select: { id: true, email: true },
    });
    return { org, admin };
  });
}

export async function updateOrganization(id: string, data: UpdateOrgInput) {
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) throw NotFound('Organization not found');
  return prisma.organization.update({ where: { id }, data });
}

/** Soft delete: archive by suspending (keeps all users/rides/history intact). */
export async function archiveOrganization(id: string) {
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) throw NotFound('Organization not found');
  return prisma.organization.update({ where: { id }, data: { status: 'SUSPENDED' } });
}
