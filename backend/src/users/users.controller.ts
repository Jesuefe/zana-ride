import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.usersService.findById(user.sub);
  }

  @Patch('me')
  update(@CurrentUser() user: JwtPayload, @Body() body: { firstName?: string; lastName?: string; email?: string }) {
    return this.usersService.updateProfile(user.sub, body);
  }

  @Patch('language')
  updateLanguage(@CurrentUser() user: JwtPayload, @Body() body: { language: string }) {
    return this.usersService.updateLanguage(user.sub, body.language);
  }

  @Get('saved-places')
  getSavedPlaces(@CurrentUser() user: JwtPayload) {
    return this.usersService.getSavedPlaces(user.sub);
  }

  @Post('saved-places')
  addSavedPlace(@CurrentUser() user: JwtPayload, @Body() body: { label: string; address: string; lat: number; lng: number }) {
    return this.usersService.addSavedPlace(user.sub, body);
  }

  @Delete('saved-places/:id')
  deleteSavedPlace(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.deleteSavedPlace(user.sub, id);
  }

}