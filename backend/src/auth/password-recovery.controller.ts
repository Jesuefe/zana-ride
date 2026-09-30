import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class PasswordRecoveryController {
  constructor(private readonly authService: AuthService) {}

  @Post('password/lookup')
  lookupPassword(@Body() body: { identifier: string }) {
    return this.authService.lookupPasswordReset(body.identifier);
  }
}
