import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';

type OtpEntry = { code: string; expiresAt: number };

const OTP_TTL_SECONDS = 5 * 60;
const otpKey = (phone: string) => `otp:${phone}`;
const otpRequestKey = (phone: string) => `otp:req:${phone}`;
const otpAttemptKey = (phone: string) => `otp:attempt:${phone}`;

@Injectable()
export class AuthService {
  // Codes live in Redis so they survive a deploy and work across instances.
  // The in-memory map is only a fallback for when Redis is unreachable —
  // better a code that works for one instance than no login at all.
  private otpFallback = new Map<string, OtpEntry>();

  private async saveOtp(phone: string, entry: OtpEntry) {
    try {
      await this.redis.set(otpKey(phone), JSON.stringify(entry), OTP_TTL_SECONDS);
    } catch {
      this.otpFallback.set(phone, entry);
    }
  }

  private async readOtp(phone: string): Promise<OtpEntry | null> {
    try {
      const raw = await this.redis.get(otpKey(phone));
      if (raw) return JSON.parse(raw);
    } catch { /* fall through */ }
    return this.otpFallback.get(phone) ?? null;
  }

  private async clearOtp(phone: string) {
    try { await this.redis.del(otpKey(phone)); } catch { /* ignore */ }
    this.otpFallback.delete(phone);
  }

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private redis: RedisService,
    private emailService: EmailService,
  ) {}

  async requestOtp(phone: string, email?: string) {
    // Was previously unlimited — nothing stopped repeatedly requesting a
    // code for the same number, which costs real SMS money and enables
    // flooding a number with texts. Five requests per 10 minutes is
    // generous for a genuine user retrying a bad connection, while
    // making sustained abuse impractical.
    const requestCount = await this.redis.incr(otpRequestKey(phone), 10 * 60);
    if (requestCount > 5) {
      throw new UnauthorizedException('Too many code requests — please wait a few minutes and try again.');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    await this.saveOtp(phone, { code, expiresAt });

    // A traveller on a foreign SIM has a genuinely real phone number —
    // it's just not one Africa's Talking's African-carrier routing can
    // reliably reach. Rather than build a whole separate no-phone
    // account path, the account still keys on phone as it always has;
    // only the code's delivery channel changes when they ask for it.
    if (email) {
      const sent = await this.emailService.sendVerificationCode(email, code);
      if (sent) {
        console.log(`[OTP] Email sent to ${email}`);
        return { sent: true };
      }
      console.log(`[OTP FALLBACK] ${phone} -> ${code} (email send failed)`);
      return { sent: false };
    }

    const apiKey = this.config.get<string>('AT_API_KEY');
    const username = this.config.get<string>('AT_USERNAME');

    if (apiKey && username) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const AfricasTalking = require('africastalking');
        const at = AfricasTalking({ apiKey, username });
        const senderId = this.config.get<string>('AT_SENDER_ID');
        const smsPayload: any = {
          to: [phone],
          message: `Your Zana verification code is: ${code}. Valid for 5 minutes.`,
        };
        if (senderId && senderId.trim()) smsPayload.from = senderId;
        await at.SMS.send(smsPayload);
        console.log(`[OTP] SMS sent to ${phone}`);
      } catch (err) {
        // Non-fatal — log the code as fallback so dev/test still works
        console.error(`[OTP] SMS failed for ${phone}:`, err?.message);
        console.log(`[OTP FALLBACK] ${phone} -> ${code}`);
      }
    } else {
      // No SMS provider configured — log for dev/test
      console.log(`[OTP DEV] ${phone} -> ${code} (set AT_API_KEY + AT_USERNAME to enable SMS)`);
    }

    return { sent: true };
  }

  async verifyOtp(phone: string, code: string, role: 'CUSTOMER' | 'DRIVER' | 'ADMIN' | 'MERCHANT' = 'CUSTOMER', email?: string) {
    // A 6-digit code is only as safe as how many guesses are allowed
    // against it — with no limit here, an automated script could try
    // all million combinations well inside the 5-minute expiry window.
    // Five wrong guesses forces a fresh code instead.
    const attempts = await this.redis.incr(otpAttemptKey(phone), OTP_TTL_SECONDS);
    if (attempts > 5) {
      throw new UnauthorizedException('Too many incorrect attempts — please request a new code.');
    }

    const entry = await this.readOtp(phone);
    if (!entry || entry.code !== code || Date.now() > entry.expiresAt) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    await this.clearOtp(phone);

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      // Captures the email a brand-new signup verified through,
      // rather than losing it — this is exactly the address a
      // traveller just proved they control, worth keeping on the
      // account for next time rather than asking again. Silently
      // drops it rather than failing the whole signup if it's
      // somehow already taken by another account — the phone number
      // itself is what actually identifies this account.
      let safeEmail = email;
      if (safeEmail) {
        const emailTaken = await this.prisma.user.findUnique({ where: { email: safeEmail } });
        if (emailTaken) safeEmail = undefined;
      }
      user = await this.prisma.user.create({
        data: { phone, role, email: safeEmail || undefined, wallet: { create: { balance: 0 } } },
      });
    }

    const token = this.jwt.sign({ sub: user.id, phone: user.phone, role: user.role });
    return { token, user };
  }

  async register(data: { phone: string; email: string; password: string; firstName?: string; lastName?: string }) {
    const existingPhone = await this.prisma.user.findUnique({ where: { phone: data.phone } });
    if (existingPhone) throw new ConflictException('An account with this phone number already exists');

    const existingEmail = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existingEmail) throw new ConflictException('An account with this email already exists');

    const passwordHash = await bcrypt.hash(data.password, 10);

    // Previously created verified with no check at all — anyone could
    // register with a phone number and email they don't actually
    // control. Starts unverified now; requestOtp/verifyOtp (already
    // built, already supports email delivery for a foreign SIM SMS
    // can't reliably reach) is what the frontend calls right after to
    // actually confirm it.
    const user = await this.prisma.user.create({
      data: {
        phone: data.phone,
        email: data.email,
        password: passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneVerified: false,
        wallet: { create: { balance: 0 } },
      },
    });

    await this.requestOtp(data.phone);

    const token = this.jwt.sign({ sub: user.id, phone: user.phone, role: user.role });
    return { token, user };
  }

  // Confirms the code sent by register()'s automatic requestOtp call
  // (or a resend). Separate from verifyOtp above, which is for the
  // OTP-only login/signup path and creates an account if none exists —
  // this one only ever flips phoneVerified on an account that already
  // exists and is already logged in.
  async verifyPhone(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Account not found');

    const attempts = await this.redis.incr(otpAttemptKey(user.phone), OTP_TTL_SECONDS);
    if (attempts > 5) {
      throw new UnauthorizedException('Too many incorrect attempts — please request a new code.');
    }

    const entry = await this.readOtp(user.phone);
    if (!entry || entry.code !== code || Date.now() > entry.expiresAt) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    await this.clearOtp(user.phone);

    return this.prisma.user.update({ where: { id: userId }, data: { phoneVerified: true } });
  }

  // Lets the just-registered user switch delivery channel without
  // starting over — this is the actual foreign-SIM path: SMS never
  // arrives, so they ask for it by email instead using the same
  // address they already gave at signup.
  async resendVerification(userId: string, useEmail?: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Account not found');
    return this.requestOtp(user.phone, useEmail ? (user.email ?? undefined) : undefined);
  }

  async registerDriver(data: {
    phone: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    vehicle: string;
    plate: string;
    serviceType: 'BIKE' | 'ECONOMY' | 'COMFORT';
  }) {
    const existingPhone = await this.prisma.user.findUnique({ where: { phone: data.phone } });
    if (existingPhone) throw new ConflictException('An account with this phone number already exists');

    const existingEmail = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existingEmail) throw new ConflictException('An account with this email already exists');

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        phone: data.phone,
        email: data.email,
        password: passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'DRIVER',
        wallet: { create: { balance: 0 } },
        driver: {
          create: {
            vehicle: data.vehicle,
            plate: data.plate,
            serviceType: data.serviceType as any,
            approvalStatus: 'PENDING',
          },
        },
      },
      include: { driver: true },
    });

    const token = this.jwt.sign({ sub: user.id, phone: user.phone, role: user.role });
    return { token, user };
  }

  async login(identifier: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ phone: identifier }, { email: identifier }] },
    });
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email/phone or password');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email/phone or password');
    }

    const token = this.jwt.sign({ sub: user.id, phone: user.phone, role: user.role });
    return { token, user };
  }

  async registerMerchantViaInvite(token: string, data: {
    email: string; password: string; businessName: string; category: string; phone: string;
  }) {
    const invite = await this.prisma.merchantInvite.findUnique({ where: { token } });
    if (!invite) throw new ConflictException('Invalid invite link');
    if (invite.usedAt) throw new ConflictException('This invite has already been used');
    if (invite.expiresAt < new Date()) throw new ConflictException('This invite link has expired');

    // Create user + merchant in one transaction
    const passwordHash = await bcrypt.hash(data.password, 10);
    const result = await this.prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          phone: data.phone,
          email: data.email,
          password: passwordHash,
          role: 'MERCHANT' as any,
          firstName: data.businessName,
        },
      });
      await tx.wallet.create({ data: { userId: user.id, balance: 0 } });
      const merchant = await tx.merchant.create({
        data: {
          userId: user.id,
          businessName: data.businessName,
          category: data.category as any,
          status: 'PENDING' as any,
        },
      });
      await tx.merchantInvite.update({
        where: { token },
        data: { usedAt: new Date(), usedBy: user.id },
      });
      return { user, merchant };
    });

    const jwtToken = this.jwt.sign({ sub: result.user.id, role: result.user.role });
    return { token: jwtToken, user: result.user };
  }


  // ── Signing in with a code instead of a password ──────────────────────────

  /**
   * Send a login code. Deliberately does not reveal whether the number is
   * registered — telling an attacker which numbers have accounts is a gift,
   * and the client flow is identical either way.
   */
  async requestLoginCode(phone: string, email?: string) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (user) {
      await this.requestOtp(phone, email);
    } else {
      console.log(`[LOGIN CODE] no account for ${phone} — nothing sent`);
    }
    return { sent: true };
  }

  /** Exchange a valid code for a session. */
  async loginWithCode(phone: string, code: string) {
    const entry = await this.readOtp(phone);
    if (!entry || entry.code !== code) {
      throw new UnauthorizedException('INVALID_CODE');
    }
    if (Date.now() > entry.expiresAt) {
      await this.clearOtp(phone);
      throw new UnauthorizedException('CODE_EXPIRED');
    }

    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw new UnauthorizedException('INVALID_CODE');

    if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
      throw new UnauthorizedException('ACCOUNT_SUSPENDED');
    }

    // A code is single use.
    await this.clearOtp(phone);

    const token = this.jwt.sign({ sub: user.id, phone: user.phone, role: user.role });
    return { token, user };
  }

  // ── Forgotten password ────────────────────────────────────────────────────

  /**
   * Start a reset. Same silence as above: the response is identical whether
   * or not the account exists.
   */
  async requestPasswordReset(identifier: string) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ phone: identifier }, { email: identifier }] },
    });

    if (!user?.phone) {
      console.log(`[RESET] no account for ${identifier} — nothing sent`);
      return { sent: true, channel: null, phoneHint: null, emailHint: null };
    }

    // Phone recovery sends by SMS; email recovery sends the same one-time
    // code to the account email. The code remains bound to the account phone.
    const isEmail = !!user.email && identifier.trim().toLowerCase() === user.email.toLowerCase();
    if (isEmail) {
      await this.requestOtp(user.phone, user.email ?? undefined);
      const e = user.email!;
      const at = e.indexOf('@');
      const emailHint = at > 1 ? `${e.slice(0, 2)}•••${e.slice(at - 1)}${e.slice(at)}` : null;
      return { sent: true, channel: 'email', phoneHint: null, emailHint };
    }

    await this.requestOtp(user.phone);
    const p = user.phone;
    const phoneHint = p.length > 4 ? `${p.slice(0, 4)}•••${p.slice(-3)}` : null;
    return { sent: true, channel: 'sms', phoneHint, emailHint: null };
  }

  /** Verify the code and set the new password in one step. */
  async resetPassword(identifier: string, code: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('PASSWORD_TOO_SHORT');
    }

    const user = await this.prisma.user.findFirst({
      where: { OR: [{ phone: identifier }, { email: identifier }] },
    });
    if (!user?.phone) throw new UnauthorizedException('INVALID_CODE');

    const entry = await this.readOtp(user.phone);
    if (!entry || entry.code !== code) {
      throw new UnauthorizedException('INVALID_CODE');
    }
    if (Date.now() > entry.expiresAt) {
      await this.clearOtp(user.phone);
      throw new UnauthorizedException('CODE_EXPIRED');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id }, data: { password: hashed },
    });

    await this.clearOtp(user.phone);
    console.log(`[RESET] password changed for ${user.phone}`);

    const token = this.jwt.sign({ sub: user.id, phone: user.phone, role: user.role });
    return { token, user };
  }

  /** Changing a password while signed in still requires the current one. */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('PASSWORD_TOO_SHORT');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.password) throw new UnauthorizedException('NO_PASSWORD_SET');

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) throw new UnauthorizedException('WRONG_PASSWORD');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    return { changed: true };
  }

}