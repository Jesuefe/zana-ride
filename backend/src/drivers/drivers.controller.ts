import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { DriversService } from './drivers.service';
import { DriverApprovalStatus, DriverOnlineStatus, ServiceType } from '@prisma/client';

@Controller('driver')
@UseGuards(JwtAuthGuard)
export class DriversController {
  constructor(private driversService: DriversService) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.driversService.findByUserId(user.sub);
  }

  @Patch('go-online')
  async goOnline(@CurrentUser() user: JwtPayload) {
    const driver = await this.driversService.findByUserId(user.sub);
    // Previously had no check at all — a driver who was still pending
    // review, had been rejected, or was suspended for a real reason
    // could go online and accept rides exactly like an approved one.
    if ((driver as any).approvalStatus !== 'APPROVED') {
      throw new ForbiddenException('DRIVER_NOT_APPROVED');
    }
    await this.driversService.assertCanGoOnline(driver.id);
    // A fresh session id on every go-online — this is what lets a
    // second device going online supersede the first one, rather than
    // both silently staying "online" and pinging location at once.
    const sessionId = randomUUID();
    const updated = await this.driversService.setOnlineStatus(driver.id, DriverOnlineStatus.ONLINE, sessionId);
    return { ...updated, sessionId };
  }

  @Patch('go-offline')
  async goOffline(@CurrentUser() user: JwtPayload) {
    const driver = await this.driversService.findByUserId(user.sub);
    return this.driversService.setOnlineStatus(driver.id, DriverOnlineStatus.OFFLINE);
  }

  @Patch('mode')
  async updateMode(@CurrentUser() user: JwtPayload, @Body() body: { mode: string }) {
    const driver = await this.driversService.findByUserId(user.sub);
    return this.driversService.updateDriverMode(driver.id, body.mode as any);
  }

  @Post('location')
  async updateLocation(@CurrentUser() user: JwtPayload, @Body() body: { lat: number; lng: number; sessionId?: string }) {
    const driver = await this.driversService.findByUserId(user.sub);
    return this.driversService.updateLocation(driver.id, body.lat, body.lng, body.sessionId);
  }

  @Get('earnings')
  async earnings(@CurrentUser() user: JwtPayload) {
    const driver = await this.driversService.findByUserId(user.sub);
    return this.driversService.getEarnings(driver.id);
  }

  // A plain env-backed value the app reads at runtime rather than a
  // baked-in frontend constant — this driver app is a static export with
  // no live server of its own, so anything set as a Next.js env var would
  // still need a full rebuild and redeploy to change, same as a hardcoded
  // number. Reading it from here means tuning it is just an env change
  // and a backend restart, nothing on the app side at all.
  @Get('config')
  getConfig() {
    return {
      deliveryGeofenceRadiusMeters: Number(process.env.DELIVERY_GEOFENCE_RADIUS_METERS) || 200,
    };
  }

  @Get('debt')
  async getDebt(@CurrentUser() user: JwtPayload) {
    const driver = await this.driversService.findByUserId(user.sub);
    if (!driver) return { totalDebt: 0, debtCount: 0 };
    return this.driversService.getCommissionDebts(driver.id);
  }

  @Get('trips/history')
  async tripHistory(@CurrentUser() user: JwtPayload) {
    const driver = await this.driversService.findByUserId(user.sub);
    if (!driver) return [];
    return this.driversService.getTripHistory(driver.id);
  }

  @Get('ratings')
  async ratings(@CurrentUser() user: JwtPayload) {
    const driver = await this.driversService.findByUserId(user.sub);
    if (!driver) return { average: 0, count: 0, ratings: [] };
    return this.driversService.getRatings(driver.id);
  }

  @Get('recently-completed-ride')
  async recentlyCompleted(@CurrentUser() user: JwtPayload) {
    const driver = await this.driversService.findByUserId(user.sub);
    if (!driver) return null;
    return this.driversService.getRecentlyCompletedRide(driver.id);
  }

  @Post('recovery-event')
  async recoveryEvent(
    @CurrentUser() user: JwtPayload,
    @Body() body: { event: string; rideId?: string; rideStatus?: string },
  ) {
    const driver = await this.driversService.findByUserId(user.sub);
    if (!driver) return { logged: false };
    await this.driversService.logRecoveryEvent(driver.id, body.event, body.rideId, body.rideStatus);
    return { logged: true };
  }

  // Ride management endpoints are handled by TripsController
  // These stubs ensure backward compatibility

  // ── Documents ─────────────────────────────────────────────────────────────

  @Get('documents')
  myDocuments(@CurrentUser() user: JwtPayload) {
    return this.driversService.myDocuments(user.sub);
  }

  @Post('documents')
  uploadDocument(
    @CurrentUser() user: JwtPayload,
    @Body() body: { label: string; imageBase64: string },
  ) {
    return this.driversService.uploadDocument(user.sub, body.label, body.imageBase64);
  }
}

@Controller('admin/drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminDriversController {
  constructor(private driversService: DriversService) {}

  @Get()
  findAll(@Query('status') status?: string) { return this.driversService.findAll(status); }

  @Get(':id/detail')
  detail(@Param('id') id: string) { return this.driversService.getDetail(id); }

  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.driversService.setApprovalStatus(id, DriverApprovalStatus.APPROVED);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.driversService.setApprovalStatus(id, DriverApprovalStatus.REJECTED);
  }

  @Patch(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.driversService.setApprovalStatus(id, DriverApprovalStatus.SUSPENDED);
  }

  @Get(':id/documents')
  documents(@Param('id') id: string) {
    return this.driversService.documentsForDriver(id);
  }

  @Patch('documents/:documentId/verify')
  verifyDocument(
    @Param('documentId') documentId: string,
    @Body() body: { verified: boolean },
  ) {
    return this.driversService.verifyDocument(documentId, body.verified);
  }
}

@Controller('drivers')
@UseGuards(JwtAuthGuard)
export class PublicDriversController {
  constructor(private driversService: DriversService) {}

  @Get('nearby')
  nearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('serviceType') serviceType: string,
    @Query('radiusKm') radiusKm: string,
  ) {
    return this.driversService.findNearbyAvailable(
      Number(lat), Number(lng),
      serviceType as ServiceType,
      radiusKm ? Number(radiusKm) : undefined,
    );
  }
}
