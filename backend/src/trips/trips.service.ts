import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DriversService } from '../drivers/drivers.service';
import { ServiceType, TripStatus, DriverOnlineStatus } from '@prisma/client';
import { estimateFare, estimateDurationMinutes, haversineKm } from './fare.util';

type LatLng = { lat: number; lng: number };

@Injectable()
export class TripsService {
  constructor(
    private prisma: PrismaService,
    private driversService: DriversService,
  ) {}

  estimate(pickup: LatLng, destination: LatLng, serviceType: ServiceType) {
    const distanceKm = Math.max(0.8, haversineKm(pickup.lat, pickup.lng, destination.lat, destination.lng));
    const durationMin = estimateDurationMinutes(distanceKm);
    return {
      distanceKm: Math.round(distanceKm * 10) / 10,
      durationMinutes: durationMin,
      fare: estimateFare(serviceType, distanceKm, durationMin),
    };
  }

  async create(
    customerId: string,
    data: {
      serviceType: ServiceType;
      pickupAddress: string;
      pickupLat: number;
      pickupLng: number;
      destinationAddress: string;
      destinationLat: number;
      destinationLng: number;
    },
  ) {
    const est = this.estimate(
      { lat: data.pickupLat, lng: data.pickupLng },
      { lat: data.destinationLat, lng: data.destinationLng },
      data.serviceType,
    );

    const trip = await this.prisma.trip.create({
      data: {
        customerId,
        serviceType: data.serviceType,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        destinationAddress: data.destinationAddress,
        destinationLat: data.destinationLat,
        destinationLng: data.destinationLng,
        distanceKm: est.distanceKm,
        estimatedFare: est.fare,
        status: TripStatus.SEARCHING_DRIVER,
      },
    });

    // Simple nearest-available match — see spec section 9 for the fuller
    // scoring model (distance + ETA + rating + acceptance rate) to layer in
    // once there's enough driver density for it to matter.
    const nearby = await this.driversService.findNearbyAvailable(data.pickupLat, data.pickupLng, data.serviceType);
    if (nearby.length === 0) {
      return this.prisma.trip.update({
        where: { id: trip.id },
        data: { status: TripStatus.NO_DRIVER_FOUND },
      });
    }

    return trip;
  }

  async findById(id: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: { driver: { include: { user: true } }, customer: true },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async assignDriver(tripId: string, driverId: string) {
    await this.driversService.setOnlineStatus(driverId, DriverOnlineStatus.BUSY);
    return this.prisma.trip.update({
      where: { id: tripId },
      data: { driverId, status: TripStatus.DRIVER_ASSIGNED, acceptedAt: new Date() },
    });
  }

  async updateStatus(tripId: string, status: TripStatus) {
    const timestampField: Partial<Record<TripStatus, string>> = {
      DRIVER_ARRIVED: 'arrivedAt',
      RIDE_IN_PROGRESS: 'startedAt',
      RIDE_COMPLETED: 'completedAt',
    };

    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');

    const data: Record<string, unknown> = { status };
    const field = timestampField[status];
    if (field) data[field] = new Date();
    if (status === TripStatus.RIDE_COMPLETED) data.finalFare = trip.estimatedFare;

    const updated = await this.prisma.trip.update({ where: { id: tripId }, data });

    if ((status === TripStatus.RIDE_COMPLETED || status === TripStatus.DRIVER_CANCELLED) && trip.driverId) {
      await this.driversService.setOnlineStatus(trip.driverId, DriverOnlineStatus.ONLINE);
    }

    return updated;
  }

  async cancel(tripId: string, by: 'CUSTOMER' | 'DRIVER') {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status === TripStatus.RIDE_COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed trip');
    }

    return this.updateStatus(
      tripId,
      by === 'CUSTOMER' ? TripStatus.CUSTOMER_CANCELLED : TripStatus.DRIVER_CANCELLED,
    );
  }

  async findAllForAdmin() {
    return this.prisma.trip.findMany({
      include: { customer: true, driver: { include: { user: true } } },
      orderBy: { requestedAt: 'desc' },
      take: 100,
    });
  }

  async findActiveForDriver(driverId: string) {
    return this.prisma.trip.findFirst({
      where: {
        driverId,
        status: { in: [TripStatus.DRIVER_ASSIGNED, TripStatus.DRIVER_EN_ROUTE, TripStatus.DRIVER_ARRIVED, TripStatus.RIDE_IN_PROGRESS] },
      },
      include: { customer: true },
      orderBy: { requestedAt: 'desc' },
    });
  }

  // Trips waiting for a driver at all — the driver app polls this to simulate
  // an incoming request until real-time websockets are wired in.
  async findSearchingTrips(serviceType: ServiceType) {
    return this.prisma.trip.findMany({
      where: { status: TripStatus.SEARCHING_DRIVER, serviceType },
      include: { customer: true },
      orderBy: { requestedAt: 'asc' },
      take: 5,
    });
  }
}
