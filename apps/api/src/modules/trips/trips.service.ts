import type { CreateBookingInput } from '@carpool/types';

import { SUSTAINABILITY as S } from '../../config/sustainability.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { notifyUser } from '../../realtime/emit.js';

/** Book seats on a ride. Instant → confirmed + seats decremented; approval → requested. */
export async function createBooking(orgId: string, passengerId: string, input: CreateBookingInput) {
  const ride = await prisma.ride.findFirst({
    where: { id: input.rideId, organizationId: orgId, status: 'PUBLISHED' },
  });
  if (!ride) throw NotFound('Ride not available');
  if (ride.driverId === passengerId) throw BadRequest('You cannot book your own ride');
  if (ride.seatsAvailable < input.seats) throw BadRequest('Not enough seats');

  // Women-only rides are bookable by women passengers only.
  if ((ride.rules as { womenOnly?: boolean } | null)?.womenOnly) {
    const passenger = await prisma.user.findUnique({
      where: { id: passengerId },
      select: { gender: true },
    });
    if (passenger?.gender !== 'FEMALE')
      throw BadRequest('This ride is reserved for women passengers');
  }

  // A passenger can have only one booking row per ride (unique index). If they
  // already have an ACTIVE booking, reject clearly; if they previously cancelled,
  // re-activate that row instead of colliding on the constraint.
  const existing = await prisma.booking.findUnique({
    where: { rideId_passengerId: { rideId: ride.id, passengerId } },
  });
  if (existing && ['CONFIRMED', 'REQUESTED', 'COMPLETED'].includes(existing.status)) {
    throw BadRequest('You already have a booking for this ride');
  }

  const confirmed = ride.bookingMode === 'INSTANT';
  const fareAmount = input.seats * ride.farePerSeat;
  const pickupOtp = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit pickup code

  const booking = await prisma.$transaction(async (tx) => {
    const data = {
      seats: input.seats,
      pickupLabel: input.pickup.label,
      pickupLat: input.pickup.lat,
      pickupLng: input.pickup.lng,
      dropLabel: input.drop.label,
      dropLat: input.drop.lat,
      dropLng: input.drop.lng,
      fareAmount,
      pickupOtp,
      pickupVerifiedAt: null,
      status: (confirmed ? 'CONFIRMED' : 'REQUESTED') as 'CONFIRMED' | 'REQUESTED',
    };
    const b = existing
      ? await tx.booking.update({ where: { id: existing.id }, data })
      : await tx.booking.create({ data: { rideId: ride.id, passengerId, ...data } });
    if (confirmed) {
      const seatsLeft = ride.seatsAvailable - input.seats;
      await tx.ride.update({
        where: { id: ride.id },
        data: { seatsAvailable: seatsLeft, status: seatsLeft === 0 ? 'FULL' : 'PUBLISHED' },
      });
      await tx.trip.upsert({
        where: { rideId: ride.id },
        create: { rideId: ride.id, status: 'BOOKED' },
        update: {},
      });
    }
    return b;
  });

  void notifyUser(ride.driverId, {
    type: confirmed ? 'RIDE_BOOKED' : 'RIDE_REQUESTED',
    title: confirmed ? 'New booking' : 'Booking request',
    body: `A passenger ${confirmed ? 'booked' : 'requested'} ${input.seats} seat(s).`,
    link: '/trips',
  });
  return booking;
}

export async function approveBooking(
  orgId: string,
  driverId: string,
  bookingId: string,
  approve: boolean
) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, ride: { driverId, organizationId: orgId } },
    include: { ride: true },
  });
  if (!booking) throw NotFound('Booking not found');
  if (booking.status !== 'REQUESTED') throw BadRequest('Booking is not pending');

  if (!approve) {
    await prisma.booking.update({ where: { id: bookingId }, data: { status: 'REJECTED' } });
    void notifyUser(booking.passengerId, {
      type: 'RIDE_REJECTED',
      title: 'Booking declined',
      body: 'Your booking was declined.',
      link: '/trips',
    });
    return { status: 'REJECTED' };
  }

  if (booking.ride.seatsAvailable < booking.seats) throw BadRequest('Seats no longer available');
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED' } });
    const seatsLeft = booking.ride.seatsAvailable - booking.seats;
    await tx.ride.update({
      where: { id: booking.rideId },
      data: { seatsAvailable: seatsLeft, status: seatsLeft === 0 ? 'FULL' : 'PUBLISHED' },
    });
    await tx.trip.upsert({
      where: { rideId: booking.rideId },
      create: { rideId: booking.rideId, status: 'BOOKED' },
      update: {},
    });
  });
  void notifyUser(booking.passengerId, {
    type: 'RIDE_ACCEPTED',
    title: 'Booking confirmed',
    body: 'Your ride is confirmed!',
  });
  return { status: 'CONFIRMED' };
}

export async function cancelBooking(orgId: string, userId: string, bookingId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, passengerId: userId, ride: { organizationId: orgId } },
    include: { ride: true },
  });
  if (!booking) throw NotFound('Booking not found');
  if (['CANCELLED', 'COMPLETED'].includes(booking.status)) throw BadRequest('Cannot cancel');

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
    if (booking.status === 'CONFIRMED') {
      await tx.ride.update({
        where: { id: booking.rideId },
        data: { seatsAvailable: { increment: booking.seats }, status: 'PUBLISHED' },
      });
    }
  });
  return { cancelled: true };
}

/** My Trips: rides I'm driving + rides I've booked. */
export async function myTrips(userId: string) {
  const [asDriver, asPassenger] = await Promise.all([
    prisma.ride.findMany({
      where: { driverId: userId, trip: { isNot: null } },
      include: {
        trip: true,
        vehicle: { select: { brand: true, model: true } },
        bookings: {
          where: { status: { in: ['CONFIRMED', 'COMPLETED'] } },
          include: { passenger: { select: { fullName: true, photoUrl: true } } },
        },
      },
      orderBy: { departAt: 'desc' },
    }),
    prisma.booking.findMany({
      where: { passengerId: userId, status: { in: ['CONFIRMED', 'REQUESTED', 'COMPLETED'] } },
      include: {
        ride: {
          include: {
            trip: true,
            driver: { select: { fullName: true, photoUrl: true, rating: true } },
            vehicle: { select: { brand: true, model: true, type: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return { asDriver, asPassenger };
}

export async function getTrip(orgId: string, userId: string, tripId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, ride: { organizationId: orgId } },
    include: {
      metric: true,
      ride: {
        include: {
          driver: {
            select: { id: true, fullName: true, photoUrl: true, rating: true, phone: true },
          },
          vehicle: true,
          bookings: {
            include: {
              passenger: { select: { id: true, fullName: true, photoUrl: true, phone: true } },
              payment: { select: { status: true, method: true } },
              reviews: { select: { role: true, rating: true, comment: true } },
            },
          },
        },
      },
    },
  });
  if (!trip) throw NotFound('Trip not found');
  const isParticipant =
    trip.ride.driverId === userId || trip.ride.bookings.some((b) => b.passengerId === userId);
  if (!isParticipant) throw Forbidden('Not a trip participant');

  // Only the passenger sees their own pickup OTP — the driver must get it from them.
  trip.ride.bookings = trip.ride.bookings.map((b) => ({
    ...b,
    pickupOtp: b.passengerId === userId ? b.pickupOtp : null,
  }));
  return trip;
}

/**
 * Driver verifies the passenger's pickup OTP on arrival. On success the ride
 * officially starts (IN_PROGRESS). Mirrors the Uber/Rapido start-code flow.
 */
export async function verifyPickup(
  orgId: string,
  driverId: string,
  tripId: string,
  bookingId: string,
  otp: string
) {
  const trip = await requireDriver(orgId, driverId, tripId);
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, rideId: trip.rideId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
  });
  if (!booking) throw NotFound('Booking not found');
  if (booking.pickupVerifiedAt) return { alreadyVerified: true, status: trip.status };
  if (!booking.pickupOtp || booking.pickupOtp !== otp) throw BadRequest('Incorrect pickup OTP');

  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { pickupVerifiedAt: new Date() } }),
    prisma.trip.update({ where: { id: tripId }, data: { status: 'IN_PROGRESS' } }),
  ]);
  void notifyUser(booking.passengerId, {
    type: 'PICKUP_VERIFIED',
    title: 'Pickup verified',
    body: 'Your ride has started. Enjoy the trip!',
    link: `/track/${tripId}`,
  });
  await notifyParticipants(tripId, {
    type: 'TRIP_IN_PROGRESS',
    title: 'Ride started',
    body: 'The ride is now in progress.',
  });
  return { verified: true, status: 'IN_PROGRESS' };
}

/** Chat history for a trip (participant-only). */
export async function getMessages(orgId: string, userId: string, tripId: string) {
  await getTrip(orgId, userId, tripId); // throws unless caller is a participant
  const convo = await prisma.conversation.findUnique({
    where: { tripId },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 200 } },
  });
  return convo?.messages ?? [];
}

async function requireDriver(orgId: string, userId: string, tripId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, ride: { organizationId: orgId } },
    include: { ride: true },
  });
  if (!trip) throw NotFound('Trip not found');
  if (trip.ride.driverId !== userId) throw Forbidden('Only the driver can do this');
  return trip;
}

export async function startTrip(orgId: string, userId: string, tripId: string) {
  const trip = await requireDriver(orgId, userId, tripId);

  // A ride can only start once at least one passenger is confirmed on board.
  const confirmedBookings = await prisma.booking.count({
    where: { rideId: trip.rideId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
  });
  if (confirmedBookings === 0) {
    throw BadRequest('At least one confirmed booking is required before starting the ride.');
  }

  const updated = await prisma.trip.update({
    where: { id: tripId },
    data: { status: 'DRIVER_STARTED', startedAt: new Date() },
  });
  await prisma.ride.update({ where: { id: trip.rideId }, data: { status: 'STARTED' } });
  await notifyParticipants(tripId, {
    type: 'TRIP_STARTED',
    title: 'Trip started',
    body: 'Your driver has started the trip.',
  });
  return updated;
}

export async function progressTrip(orgId: string, userId: string, tripId: string) {
  await requireDriver(orgId, userId, tripId);
  return prisma.trip.update({ where: { id: tripId }, data: { status: 'IN_PROGRESS' } });
}

export async function completeTrip(orgId: string, userId: string, tripId: string) {
  const trip = await requireDriver(orgId, userId, tripId);

  const [ride, bookings] = await Promise.all([
    prisma.ride.findUnique({ where: { id: trip.rideId }, include: { vehicle: true } }),
    prisma.booking.findMany({ where: { rideId: trip.rideId, status: 'CONFIRMED' } }),
  ]);
  if (!ride) throw NotFound('Ride not found');

  const passengers = bookings.reduce((n, b) => n + b.seats, 0);
  const distanceKm = (ride.distanceM ?? 0) / 1000;
  const metric = computeMetric(distanceKm, passengers, ride.vehicle.fuelType);

  await prisma.$transaction(async (tx) => {
    await tx.trip.update({
      where: { id: tripId },
      data: {
        status: 'PAYMENT_PENDING',
        completedAt: new Date(),
        actualDistanceM: ride.distanceM ?? 0,
      },
    });
    await tx.ride.update({ where: { id: ride.id }, data: { status: 'COMPLETED' } });
    await tx.booking.updateMany({
      where: { rideId: ride.id, status: 'CONFIRMED' },
      data: { status: 'COMPLETED' },
    });
    await tx.tripMetric.upsert({
      where: { tripId },
      create: {
        organizationId: orgId,
        tripId,
        distanceM: ride.distanceM ?? 0,
        seatsFilled: passengers,
        soloBaselineDistanceM: Math.round(distanceKm * passengers * 1000),
        fuelSavedMl: metric.fuelSavedMl,
        co2SavedG: metric.co2SavedG,
        costPerKm: metric.costPerKm,
      },
      update: {},
    });
    // gamification: eco points for the CO2 avoided by sharing this ride.
    // Driver earns the full trip saving; each passenger earns their seat-share.
    if (passengers > 0) {
      await tx.user.update({
        where: { id: ride.driverId },
        data: { ecoPoints: { increment: Math.round(metric.co2SavedG / 100) } },
      });
      for (const b of bookings) {
        const pts = Math.round((metric.co2SavedG * (b.seats / passengers)) / 100);
        if (pts > 0) {
          await tx.user.update({
            where: { id: b.passengerId },
            data: { ecoPoints: { increment: pts } },
          });
        }
      }
    }
  });

  await notifyParticipants(tripId, {
    type: 'TRIP_COMPLETED',
    title: 'Trip completed',
    body: 'Please complete your payment.',
  });
  return { status: 'PAYMENT_PENDING', metric };
}

export async function cancelTrip(orgId: string, userId: string, tripId: string, reason?: string) {
  const trip = await requireDriver(orgId, userId, tripId);
  await prisma.$transaction([
    prisma.trip.update({
      where: { id: tripId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
    }),
    prisma.ride.update({ where: { id: trip.rideId }, data: { status: 'CANCELLED' } }),
    prisma.booking.updateMany({
      where: { rideId: trip.rideId, status: { in: ['CONFIRMED', 'REQUESTED'] } },
      data: { status: 'CANCELLED' },
    }),
  ]);
  await notifyParticipants(tripId, {
    type: 'TRIP_CANCELLED',
    title: 'Trip cancelled',
    body: reason ?? 'The trip was cancelled.',
  });
  return { cancelled: true };
}

// ---- sustainability math (docs/07) ----
function computeMetric(distanceKm: number, passengers: number, fuelType: string) {
  const soloKm = distanceKm * passengers; // each passenger's avoided solo trip
  let fuelSavedL: number;
  let co2SavedG: number;
  if (fuelType === 'ELECTRIC') {
    const kwh = soloKm / S.EV_EFFICIENCY_KM_PER_KWH;
    fuelSavedL = 0;
    co2SavedG = Math.round(kwh * S.CO2_PER_KWH_G);
  } else {
    // Distance-based method: fuel = distance / efficiency; CO2 = fuel × per-fuel factor.
    const factor = S.CO2_PER_LITRE_G[fuelType] ?? 2310; // fallback: petrol
    fuelSavedL = soloKm / S.FUEL_EFFICIENCY_KMPL;
    co2SavedG = Math.round(fuelSavedL * factor);
  }
  const costPerKm =
    distanceKm > 0
      ? Math.round(
          ((fuelSavedL || soloKm / S.FUEL_EFFICIENCY_KMPL) * S.PETROL_PRICE_PER_L * 100) /
            Math.max(soloKm, 1)
        )
      : 0;
  return { fuelSavedMl: Math.round(fuelSavedL * 1000), co2SavedG, costPerKm };
}

async function notifyParticipants(
  tripId: string,
  payload: { type: string; title: string; body: string }
) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      ride: { include: { bookings: { where: { status: { in: ['CONFIRMED', 'COMPLETED'] } } } } },
    },
  });
  if (!trip) return;
  const ids = new Set<string>([
    trip.ride.driverId,
    ...trip.ride.bookings.map((b) => b.passengerId),
  ]);
  for (const id of ids) void notifyUser(id, { ...payload, link: `/track/${tripId}` });
}
