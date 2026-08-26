import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/roles.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { DriversService } from './drivers.service';
import { DriverApprovalStatus, DriverOnlineStatus, ServiceType } from '@prisma/client';

@Controller('driver')
@UseGuards(JwtAuthGuard)
export class DriversController {
  constructor(private driversService: DriversService) {}

  @Post('register')
  register(
    @CurrentUser() user: JwtPayload,
    @Body() body: { vehicle: string; plate: string; serviceType: ServiceType },
  ) {
    return this.driversService.register(user.sub, body);
  }

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.driversService.findByUserId(user.sub);
  }

  @Patch('go-online')
  async goOnline(@CurrentUser() user: JwtPayload) {
    const driver = await this.driversService.findByUserId(user.sub);
    return this.driversService.setOnlineStatus(driver.id, DriverOnlineStatus.ONLINE);
  }

  @Patch('go-offline')
  async goOffline(@CurrentUser() user: JwtPayload) {
    const driver = await this.driversService.findByUserId(user.sub);
    return this.driversService.setOnlineStatus(driver.id, DriverOnlineStatus.OFFLINE);
  }

  @Post('location')
  async updateLocation(@CurrentUser() user: JwtPayload, @Body() body: { lat: number; lng: number }) {
    const driver = await this.driversService.findByUserId(user.sub);
    return this.driversService.updateLocation(driver.id, body.lat, body.lng);
  }
}

@Controller('admin/drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminDriversController {
  constructor(private driversService: DriversService) {}

  @Get()
  findAll() {
    return this.driversService.findAll();
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.driversService.setApprovalStatus(id, DriverApprovalStatus.APPROVED);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string) {
    return this.driversService.setApprovalStatus(id, DriverApprovalStatus.REJECTED);
  }

  @Patch(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.driversService.setApprovalStatus(id, DriverApprovalStatus.SUSPENDED);
  }
}
