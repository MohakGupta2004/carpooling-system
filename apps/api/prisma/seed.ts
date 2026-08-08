import { PERMISSIONS, SYSTEM_ROLES } from '@carpool/types';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_ROLE_PERMISSIONS,
  SYSTEM_ROLE_META,
  splitPermission,
} from '../src/modules/rbac/permission.catalog.js';

// Load the monorepo root .env (where DATABASE_URL lives), then any local override,
// so `prisma db seed` / `migrate reset` work without manually exporting env vars.
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../../.env') });
dotenv.config();

const prisma = new PrismaClient();
const PASSWORD = 'Password123!';

async function main() {
  console.log('🌱 seeding…');

  // --- wipe (dev only) ---
  await prisma.$transaction([
    prisma.tripMetric.deleteMany(),
    prisma.tripLocation.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.review.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.trip.deleteMany(),
    prisma.ride.deleteMany(),
    prisma.walletTransaction.deleteMany(),
    prisma.wallet.deleteMany(),
    prisma.vehicle.deleteMany(),
    prisma.savedPlace.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.sosEvent.deleteMany(),
    prisma.userPermission.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.user.deleteMany(),
    prisma.role.deleteMany(),
    prisma.department.deleteMany(),
    prisma.officeLocation.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.permission.deleteMany(),
  ]);

  // --- permissions ---
  await prisma.permission.createMany({
    data: PERMISSIONS.map((key) => ({ key, ...splitPermission(key) })),
  });
  const permByKey = new Map((await prisma.permission.findMany()).map((p) => [p.key, p.id]));
  console.log(`  ✓ ${permByKey.size} permissions`);

  const hash = await argon2.hash(PASSWORD);

  await seedOrg({
    slug: 'odoo',
    name: 'Odoo India',
    domain: 'odoo.com',
    hash,
    permByKey,
    withDemoRides: true,
  });
  await seedOrg({
    slug: 'globex',
    name: 'Globex',
    domain: 'globex.com',
    hash,
    permByKey,
    withDemoRides: false,
  });

  // The *Geo columns are plain (not GENERATED) in the database, and nothing in the
  // app writes them, so derive them here from the lat/lng we just inserted.
  // Order matters: the points must exist before routeGeo can be built from them.
  await prisma.$executeRawUnsafe(
    `UPDATE "Ride" SET
       "originGeo" = ST_SetSRID(ST_MakePoint("originLng"::double precision, "originLat"::double precision), 4326)::geography,
       "destGeo"   = ST_SetSRID(ST_MakePoint("destLng"::double precision,   "destLat"::double precision),   4326)::geography;`
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Booking" SET
       "pickupGeo" = ST_SetSRID(ST_MakePoint("pickupLng"::double precision, "pickupLat"::double precision), 4326)::geography,
       "dropGeo"   = ST_SetSRID(ST_MakePoint("dropLng"::double precision,   "dropLat"::double precision),   4326)::geography;`
  );

  // Backfill routeGeo for seeded rides (created without a road polyline) with a
  // straight origin→destination line, so corridor matching works out of the box.
  await prisma.$executeRawUnsafe(
    `UPDATE "Ride" SET "routeGeo" = ST_MakeLine("originGeo"::geometry, "destGeo"::geometry)::geography WHERE "routeGeo" IS NULL;`
  );

  console.log('✅ seed complete');
  console.log(`   Login with any @odoo.com user · password: ${PASSWORD}`);
  console.log('   pramit@odoo.com (Company Admin) · mohak@odoo.com (Super Admin)');
  console.log(
    '   subhodeep@odoo.com, dia@odoo.com, abhinandan@odoo.com, ananya@odoo.com (Employees)'
  );
  console.log(
    '   ▶ Ready trip: driver=subhodeep, 3 passengers — abhinandan(OTP 1234), dia(2345), ananya(3456)'
  );
  console.log(
    '     As subhodeep, open the trip before starting to see all pickups + optimized order.'
  );
}

async function seedOrg(opts: {
  slug: string;
  name: string;
  domain: string;
  hash: string;
  permByKey: Map<string, string>;
  withDemoRides: boolean;
}) {
  const org = await prisma.organization.create({
    data: {
      slug: opts.slug,
      name: opts.name,
      domain: opts.domain,
      fuelCostRules: {
        petrolPricePerL: 105,
        dieselPricePerL: 92,
        cngPricePerKg: 78,
        evPricePerKwh: 9,
      },
      ridePolicies: { maxRideDistanceKm: 60, womenOnlyAllowed: true, instantBookingAllowed: true },
      workingHours: { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] },
    },
  });

  const eng = await prisma.department.create({
    data: { organizationId: org.id, name: 'Engineering' },
  });
  const sales = await prisma.department.create({ data: { organizationId: org.id, name: 'Sales' } });
  await prisma.officeLocation.create({
    data: {
      organizationId: org.id,
      name: `${opts.name} Kolkata (Sector V)`,
      address: 'Godrej Waterside, Sector V, Salt Lake, Kolkata, West Bengal 700091',
      lat: 22.5726,
      lng: 88.4332,
    },
  });

  // --- roles (system, per-org, editable at runtime) ---
  const roleIds: Record<string, string> = {};
  for (const key of Object.values(SYSTEM_ROLES)) {
    const meta = SYSTEM_ROLE_META[key]!;
    const role = await prisma.role.create({
      data: {
        organizationId: org.id,
        key,
        name: meta.name,
        description: meta.description,
        isSystem: true,
      },
    });
    roleIds[key] = role.id;
    const perms = DEFAULT_ROLE_PERMISSIONS[key] ?? [];
    await prisma.rolePermission.createMany({
      data: perms
        .map((pk) => ({ roleId: role.id, permissionId: opts.permByKey.get(pk)! }))
        .filter((r) => r.permissionId),
    });
  }

  const mkUser = async (
    email: string,
    fullName: string,
    roleKey: string,
    extra: {
      departmentId?: string;
      homeLat?: number;
      homeLng?: number;
      homeAddress?: string;
      gender?: 'MALE' | 'FEMALE';
      balance?: number;
    } = {}
  ) => {
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email,
        fullName,
        passwordHash: opts.hash,
        emailVerified: true,
        status: 'ACTIVE',
        phone: `+9198${String(Math.floor(10000000 + Math.random() * 89999999))}`,
        departmentId: extra.departmentId,
        homeAddress: extra.homeAddress,
        homeLat: extra.homeLat,
        homeLng: extra.homeLng,
        gender: extra.gender,
        rating: 4.8,
        roles: { create: { roleId: roleIds[roleKey]! } },
        wallet: { create: { balance: extra.balance ?? 50000 } },
        preferences: { pickupRadiusM: 1500, smokingAllowed: false, acPreference: 'AC' },
      },
    });
    // Saved places (Home + Office) so the location picker can suggest them
    if (extra.homeLat && extra.homeLng) {
      await prisma.savedPlace.createMany({
        data: [
          {
            userId: user.id,
            label: 'Home',
            address: extra.homeAddress ?? 'Home',
            lat: extra.homeLat,
            lng: extra.homeLng,
          },
          {
            userId: user.id,
            label: 'Office',
            address: 'Godrej Waterside, Sector V, Salt Lake, Kolkata',
            lat: 22.5726,
            lng: 88.4332,
          },
        ],
      });
    }
    return user;
  };

  await mkUser(`pramit@${opts.domain}`, 'Pramit Manna', SYSTEM_ROLES.COMPANY_ADMIN, {
    departmentId: eng.id,
    homeAddress: 'Ballygunge Place, Kolkata',
    homeLat: 22.528,
    homeLng: 88.365,
    gender: 'MALE',
  });
  await mkUser(`mohak@${opts.domain}`, 'Mohak Gupta', SYSTEM_ROLES.SUPER_ADMIN, {
    departmentId: eng.id,
    homeAddress: 'Park Street, Kolkata',
    homeLat: 22.555,
    homeLng: 88.3517,
    gender: 'MALE',
  });

  const subhodeep = await mkUser(
    `subhodeep@${opts.domain}`,
    'Subhodeep Ghosh',
    SYSTEM_ROLES.EMPLOYEE,
    {
      departmentId: eng.id,
      homeAddress: 'Seven Tanks Estate, Dum Dum, Kolkata',
      homeLat: 22.622,
      homeLng: 88.384,
      gender: 'MALE',
    }
  );
  const dia = await mkUser(`dia@${opts.domain}`, 'Dia Santra', SYSTEM_ROLES.EMPLOYEE, {
    departmentId: sales.id,
    homeAddress: 'Jadavpur Central Road, Kolkata',
    homeLat: 22.499,
    homeLng: 88.371,
    gender: 'FEMALE',
  });
  const abhinandan = await mkUser(
    `abhinandan@${opts.domain}`,
    'Abhinandan Bhattacharya',
    SYSTEM_ROLES.EMPLOYEE,
    {
      departmentId: eng.id,
      homeAddress: 'New Town Action Area I, Kolkata',
      homeLat: 22.585,
      homeLng: 88.471,
      gender: 'MALE',
    }
  );
  const ananya = await mkUser(`ananya@${opts.domain}`, 'Ananya Banerjee', SYSTEM_ROLES.EMPLOYEE, {
    departmentId: sales.id,
    homeAddress: 'Lake Gardens, Kolkata',
    homeLat: 22.507,
    homeLng: 88.358,
    gender: 'FEMALE',
    balance: 20000,
  });
  const debasish = await mkUser(
    `debasish@${opts.domain}`,
    'Debasish Mukhopadhyay',
    SYSTEM_ROLES.EMPLOYEE,
    {
      departmentId: sales.id,
      homeAddress: 'Howrah AC Market, Kolkata',
      homeLat: 22.583,
      homeLng: 88.342,
      gender: 'MALE',
      balance: 15000,
    }
  );

  if (!opts.withDemoRides) return;

  // --- vehicles (verified so rides can be offered) ---
  const subhodeepCar = await prisma.vehicle.create({
    data: {
      organizationId: org.id,
      ownerId: subhodeep.id,
      type: 'CAR',
      brand: 'Toyota',
      model: 'Innova',
      registrationNo: 'WB02AB1234',
      licenseNo: 'WB-2019-0012345',
      driverName: 'Subhodeep Ghosh',
      isAc: true,
      color: 'White',
      fuelType: 'PETROL',
      seats: 6,
      verification: 'VERIFIED',
    },
  });
  const abhinandanEv = await prisma.vehicle.create({
    data: {
      organizationId: org.id,
      ownerId: abhinandan.id,
      type: 'EV',
      brand: 'Tata',
      model: 'Nexon EV',
      registrationNo: 'WB02XY9876',
      licenseNo: 'WB-2020-0098765',
      driverName: 'Abhinandan Bhattacharya',
      isAc: true,
      color: 'Teal',
      fuelType: 'ELECTRIC',
      seats: 5,
      verification: 'VERIFIED',
    },
  });
  const diaCar = await prisma.vehicle.create({
    data: {
      organizationId: org.id,
      ownerId: dia.id,
      type: 'CAR',
      brand: 'Honda',
      model: 'City',
      registrationNo: 'WB02DS4567',
      licenseNo: 'WB-2021-0045678',
      driverName: 'Dia Santra',
      isAc: true,
      color: 'Silver',
      fuelType: 'PETROL',
      seats: 5,
      verification: 'VERIFIED',
    },
  });
  const ananyaCar = await prisma.vehicle.create({
    data: {
      organizationId: org.id,
      ownerId: ananya.id,
      type: 'CAR',
      brand: 'Maruti',
      model: 'Baleno',
      registrationNo: 'WB02AB7890',
      licenseNo: 'WB-2022-0078901',
      driverName: 'Ananya Banerjee',
      isAc: true,
      color: 'Red',
      fuelType: 'PETROL',
      seats: 5,
      verification: 'VERIFIED',
    },
  });

  const office = { label: 'Odoo Kolkata (Sector V)', lat: 22.5726, lng: 88.4332 };

  // Upcoming published ride (Subhodeep → office) for the live find/book demo.
  // Three passengers are pre-booked (different pickups) so the driver's pre-trip
  // view shows the whole map with all pickups + the optimized pickup order.
  const readyRide = await prisma.ride.create({
    data: {
      organizationId: org.id,
      driverId: subhodeep.id,
      vehicleId: subhodeepCar.id,
      originLabel: 'Seven Tanks Estate, Dum Dum',
      originLat: 22.622,
      originLng: 88.384,
      destLabel: office.label,
      destLat: office.lat,
      destLng: office.lng,
      departAt: new Date(Date.now() + 2 * 3600_000),
      distanceM: 12500,
      durationS: 1800,
      totalSeats: 4,
      seatsAvailable: 1,
      farePerSeat: 8000,
      bookingMode: 'INSTANT',
      status: 'PUBLISHED',
      rules: { noSmoking: true, womenOnly: false },
    },
  });
  const readyPax = [
    { user: abhinandan, label: 'New Town Action Area I', lat: 22.585, lng: 88.471, otp: '1234' },
    { user: dia, label: 'Jadavpur Central Road', lat: 22.499, lng: 88.371, otp: '2345' },
    { user: ananya, label: 'Lake Gardens', lat: 22.507, lng: 88.358, otp: '3456' },
  ];
  for (const p of readyPax) {
    await prisma.booking.create({
      data: {
        rideId: readyRide.id,
        passengerId: p.user.id,
        seats: 1,
        pickupLabel: p.label,
        pickupLat: p.lat,
        pickupLng: p.lng,
        dropLabel: office.label,
        dropLat: office.lat,
        dropLng: office.lng,
        fareAmount: 8000,
        status: 'CONFIRMED',
        pickupOtp: p.otp,
      },
    });
  }
  await prisma.trip.create({ data: { rideId: readyRide.id, status: 'BOOKED' } });
  await prisma.ride.create({
    data: {
      organizationId: org.id,
      driverId: abhinandan.id,
      vehicleId: abhinandanEv.id,
      originLabel: 'New Town Action Area I',
      originLat: 22.585,
      originLng: 88.471,
      destLabel: office.label,
      destLat: office.lat,
      destLng: office.lng,
      departAt: new Date(Date.now() + 3 * 3600_000),
      distanceM: 8200,
      durationS: 1200,
      totalSeats: 3,
      seatsAvailable: 3,
      farePerSeat: 6000,
      bookingMode: 'APPROVAL',
      status: 'PUBLISHED',
      rules: { noSmoking: true },
    },
  });

  // A completed trip (last week) so dashboards + sustainability render immediately
  const pastRide = await prisma.ride.create({
    data: {
      organizationId: org.id,
      driverId: subhodeep.id,
      vehicleId: subhodeepCar.id,
      originLabel: 'Seven Tanks Estate, Dum Dum',
      originLat: 22.622,
      originLng: 88.384,
      destLabel: office.label,
      destLat: office.lat,
      destLng: office.lng,
      departAt: new Date(Date.now() - 6 * 86400_000),
      distanceM: 12500,
      durationS: 1800,
      totalSeats: 4,
      seatsAvailable: 2,
      farePerSeat: 8000,
      status: 'COMPLETED',
    },
  });
  const pastTrip = await prisma.trip.create({
    data: {
      rideId: pastRide.id,
      status: 'PAYMENT_COMPLETED',
      startedAt: new Date(Date.now() - 6 * 86400_000),
      completedAt: new Date(Date.now() - 6 * 86400_000 + 1800_000),
      actualDistanceM: 12500,
    },
  });
  const pastPickups = [
    { user: dia, label: 'Jadavpur Central Road', lat: 22.499, lng: 88.371 },
    { user: ananya, label: 'Lake Gardens', lat: 22.507, lng: 88.358 },
  ];
  for (const p of pastPickups) {
    const booking = await prisma.booking.create({
      data: {
        rideId: pastRide.id,
        passengerId: p.user.id,
        seats: 1,
        pickupLabel: p.label,
        pickupLat: p.lat,
        pickupLng: p.lng,
        dropLabel: office.label,
        dropLat: office.lat,
        dropLng: office.lng,
        fareAmount: 8000,
        status: 'COMPLETED',
      },
    });
    await prisma.payment.create({
      data: {
        organizationId: org.id,
        bookingId: booking.id,
        payerId: p.user.id,
        amount: 8000,
        method: 'WALLET',
        status: 'PAID',
        invoiceNo: `INV-${booking.id.slice(-6).toUpperCase()}`,
      },
    });
  }
  await prisma.tripMetric.create({
    data: {
      organizationId: org.id,
      tripId: pastTrip.id,
      departmentId: eng.id,
      distanceM: 12500,
      seatsFilled: 2,
      soloBaselineDistanceM: 25000,
      fuelSavedMl: Math.round((25 / 15) * 1000),
      co2SavedG: Math.round((25 / 15) * 2310),
      costPerKm: 700,
    },
  });
  await prisma.user.update({ where: { id: subhodeep.id }, data: { ecoPoints: 44 } });

  // ── Historical trips (past 30 days) so analytics charts are populated & dynamic ──
  // Every employee both drives and rides, so each personal report looks full.
  const drivers = [
    { user: subhodeep, vehicle: subhodeepCar, ev: false, dept: eng.id },
    { user: abhinandan, vehicle: abhinandanEv, ev: true, dept: eng.id },
    { user: dia, vehicle: diaCar, ev: false, dept: sales.id },
    { user: ananya, vehicle: ananyaCar, ev: false, dept: sales.id },
  ];
  const paxPool = [
    { user: abhinandan, label: 'New Town Action Area I', lat: 22.585, lng: 88.471, dept: eng.id },
    { user: dia, label: 'Jadavpur Central Road', lat: 22.499, lng: 88.371, dept: sales.id },
    { user: ananya, label: 'Lake Gardens', lat: 22.507, lng: 88.358, dept: sales.id },
    { user: subhodeep, label: 'Seven Tanks, Dum Dum', lat: 22.622, lng: 88.384, dept: eng.id },
    { user: debasish, label: 'Howrah AC Market', lat: 22.583, lng: 88.342, dept: sales.id },
  ];
  const routes = [
    { o: 'Dum Dum, Kolkata', oLat: 22.622, oLng: 88.384, km: 12.5 },
    { o: 'New Town Action Area I', oLat: 22.585, oLng: 88.471, km: 8.2 },
    { o: 'Jadavpur Central Road', oLat: 22.499, oLng: 88.371, km: 15.0 },
    { o: 'Lake Gardens', oLat: 22.507, oLng: 88.358, km: 14.2 },
    { o: 'Howrah AC Market', oLat: 22.583, oLng: 88.342, km: 16.5 },
  ];
  const methods = ['WALLET', 'UPI', 'CASH', 'CARD'] as const;
  const peakHours = [8, 8, 9, 9, 9, 10, 17, 18, 18, 19, 13, 20]; // weighted toward commute peaks
  const rnd = (n: number) => Math.floor(Math.random() * n);
  const pick = <T>(a: readonly T[]): T => a[rnd(a.length)]!;

  for (let d = 0; d < 55; d++) {
    const drv = pick(drivers);
    const route = pick(routes);
    const daysAgo = rnd(30);
    const hour = pick(peakHours);
    const depart = new Date();
    depart.setDate(depart.getDate() - daysAgo);
    depart.setHours(hour, rnd(60), 0, 0);
    const paxCount = 1 + rnd(3); // 1..3
    const chosen: typeof paxPool = [];
    for (const p of [...paxPool].sort(() => Math.random() - 0.5)) {
      if (p.user.id === drv.user.id) continue;
      if (chosen.length >= paxCount) break;
      chosen.push(p);
    }
    if (chosen.length === 0) continue;

    const distanceM = Math.round(route.km * 1000);
    const fare = 4000 + rnd(9) * 1000; // ₹40–₹120
    const ride = await prisma.ride.create({
      data: {
        organizationId: org.id,
        driverId: drv.user.id,
        vehicleId: drv.vehicle.id,
        originLabel: route.o,
        originLat: route.oLat,
        originLng: route.oLng,
        destLabel: office.label,
        destLat: office.lat,
        destLng: office.lng,
        departAt: depart,
        distanceM,
        durationS: Math.round((route.km / 28) * 3600),
        totalSeats: drv.vehicle.seats,
        seatsAvailable: Math.max(0, drv.vehicle.seats - chosen.length),
        farePerSeat: fare,
        status: 'COMPLETED',
        createdAt: depart,
      },
    });
    const trip = await prisma.trip.create({
      data: {
        rideId: ride.id,
        status: 'PAYMENT_COMPLETED',
        startedAt: depart,
        completedAt: new Date(depart.getTime() + 30 * 60_000),
        actualDistanceM: distanceM,
      },
    });
    for (const p of chosen) {
      const booking = await prisma.booking.create({
        data: {
          rideId: ride.id,
          passengerId: p.user.id,
          seats: 1,
          pickupLabel: p.label,
          pickupLat: p.lat,
          pickupLng: p.lng,
          dropLabel: office.label,
          dropLat: office.lat,
          dropLng: office.lng,
          fareAmount: fare,
          status: 'COMPLETED',
          createdAt: depart,
        },
      });
      await prisma.payment.create({
        data: {
          organizationId: org.id,
          bookingId: booking.id,
          payerId: p.user.id,
          amount: fare,
          method: pick(methods),
          status: 'PAID',
          invoiceNo: `INV-${booking.id.slice(-6).toUpperCase()}`,
          createdAt: depart,
        },
      });
    }
    const soloKm = route.km * chosen.length;
    const fuelSavedMl = drv.ev ? 0 : Math.round((soloKm / 15) * 1000);
    const co2SavedG = drv.ev ? Math.round((soloKm / 6) * 700) : Math.round((soloKm / 15) * 2310);
    await prisma.tripMetric.create({
      data: {
        organizationId: org.id,
        tripId: trip.id,
        departmentId: drv.dept,
        distanceM,
        seatsFilled: chosen.length,
        soloBaselineDistanceM: Math.round(soloKm * 1000),
        fuelSavedMl,
        co2SavedG,
        costPerKm: 700,
        createdAt: depart,
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
