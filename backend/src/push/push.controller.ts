import { Body, Controller, Delete, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { PushService } from './push.service';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private push: PushService) {}

  /** The app calls this after the user grants notification permission. */
  @Post('register')
  register(
    @CurrentUser() user: JwtPayload,
    @Body() body: { token: string; platform?: string },
  ) {
    return this.push.registerToken(user.sub, body.token, body.platform);
  }

  /** Called on sign-out so the next person on that phone isn't reached. */
  @Delete('register')
  unregister(@Body() body: { token: string }) {
    return this.push.removeToken(body.token);
  }
}
