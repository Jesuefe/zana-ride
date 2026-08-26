import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

type OtpEntry = { code: string; expiresAt: number };

@Injectable()
export class AuthService {
  // In-memory store — fine for a single instance during early development.
  // Move to Redis before running more than one API instance behind a load balancer.
  private otpStore = new Map<string, OtpEntry>();

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async requestOtp(phone: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    this.otpStore.set(phone, { code, expiresAt });

    // TODO: replace with a real SMS provider (Africa's Talking, Twilio, etc).
    // Logging for now so you can test the flow end-to-end before that's wired in.
    console.log(`[OTP] ${phone} -> ${code} (expires in 5 min)`);

    return { sent: true };
  }

  async verifyOtp(phone: string, code: string, role: 'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'MERCHANT' = 'CUSTOMER') {
    const entry = this.otpStore.get(phone);
    if (!entry || entry.code !== code || Date.now() > entry.expiresAt) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    this.otpStore.delete(phone);

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { phone, role, wallet: { create: { balance: 0 } } },
      });
    }

    const token = this.jwt.sign({ sub: user.id, phone: user.phone, role: user.role });
    return { token, user };
  }
}
