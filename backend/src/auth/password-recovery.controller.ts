import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth-password-recovery')
export class PasswordRecoveryController {
  constructor(private readonly authService: AuthService) {}

  @Post('lookup')
  lookup(@Body() body: { identifier: string }) {
    return this.authService.lookupPasswordReset(body.identifier);
  }
}
