import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { RecoverAdminDto } from './dto/password-auth.dto';
import { RegisterDto, LoginDto, RegisterDriverDto } from './dto/password-auth.dto';
import { JwtAuthGuard } from './roles.guard';
import { CurrentUser } from './current-user.decorator';
import type { JwtPayload } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('request-otp')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.phone, dto.email);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.code, undefined, dto.email);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-phone')
  @UseGuards(JwtAuthGuard)
  verifyPhone(@CurrentUser() user: JwtPayload, @Body() body: { code: string }) {
    return this.authService.verifyPhone(user.sub, body.code);
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  resendVerification(@CurrentUser() user: JwtPayload, @Body() body: { email?: boolean }) {
    return this.authService.resendVerification(user.sub, body.email);
  }

  @Post('register-driver')
  registerDriver(@Body() dto: RegisterDriverDto) {
    return this.authService.registerDriver(dto);
  }

  // Emergency admin bootstrap. This endpoint is inert unless
  // ADMIN_RECOVERY_SECRET is configured in the server environment.
  // Remove that environment variable immediately after successful recovery.
  @Post('admin/recover')
  recoverAdmin(@Body() dto: RecoverAdminDto) {
    return this.authService.recoverAdmin(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.identifier, dto.password);
  }

  @Post('register-merchant')
  registerMerchant(@Body() body: { token: string; email: string; password: string; businessName: string; category: string; phone: string }) {
    return this.authService.registerMerchantViaInvite(body.token, body);
  }


  // ── Sign in with a code instead of a password ─────────────────────────────

  @Post('login/request-code')
  requestLoginCode(@Body() body: { phone: string }) {
    return this.authService.requestLoginCode(body.phone);
  }

  @Post('login/code')
  loginWithCode(@Body() body: { phone: string; code: string }) {
    return this.authService.loginWithCode(body.phone, body.code);
  }

  // ── Forgotten password ────────────────────────────────────────────────────

  @Post('password/forgot')
  forgotPassword(@Body() body: { identifier: string }) {
    return this.authService.requestPasswordReset(body.identifier);
  }

  @Post('password/reset')
  resetPassword(@Body() body: { identifier: string; code: string; password: string }) {
    return this.authService.resetPassword(body.identifier, body.code, body.password);
  }

  @Post('password/change')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(user.sub, body.currentPassword, body.newPassword);
  }
}
