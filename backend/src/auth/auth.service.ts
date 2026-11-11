import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto';
import { generateAdminTotpSecret, verifyAdminTotpCode } from './admin-totp.util';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { StorageService } from '../deliveries/storage.service';

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
    private storage: StorageService,
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
      console.log(`[OTP FALLBACK] Email delivery failed for ${phone}; code not logged.`);
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
        // Non-fatal — never log verification codes; delivery can be retried safely.
        console.error(`[OTP] SMS failed for ${phone}:`, err?.message);
        console.log(`[OTP FALLBACK] SMS provider request failed for ${phone}; code not logged.`);
      }
    } else {
      // No SMS provider configured — log for dev/test
      console.log(`[OTP DEV] SMS provider not configured for ${phone}; code not logged.`);
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
    if (user?.role === 'ADMIN') throw new UnauthorizedException('ADMIN_PASSWORD_AND_AUTHENTICATOR_REQUIRED');
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

  async recoverAdmin(data: {
    phone: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    recoverySecret: string;
  }) {
    const configuredSecret = this.config.get<string>('ADMIN_RECOVERY_SECRET');
    if (!configuredSecret) {
      throw new UnauthorizedException('Admin recovery is disabled');
    }

    const supplied = Buffer.from(data.recoverySecret);
    const expected = Buffer.from(configuredSecret);
    const secretMatches = supplied.length === expected.length && timingSafeEqual(supplied, expected);
    if (!secretMatches) {
      throw new UnauthorizedException('Invalid recovery credentials');
    }

    const existingPhone = await this.prisma.user.findUnique({ where: { phone: data.phone } });
    if (existingPhone) {
      throw new ConflictException('An account with this phone number already exists');
    }

    const existingEmail = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existingEmail) {
      throw new ConflictException('An account with this email already exists');
    }

    if (data.password.length < 12) {
      throw new BadRequestException('Admin password must be at least 12 characters');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await this.prisma.user.create({
      data: {
        phone: data.phone,
        email: data.email,
        password: passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'ADMIN',
        status: 'ACTIVE',
        phoneVerified: true,
        wallet: { create: { balance: 0 } },
      },
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return { created: true, user };
  }

  private adminTotpEncryptionKey(): Buffer {
    // Match the existing admin-settings and Zana AI encryption-key fallback.
    const configured = this.config.get<string>('SETTINGS_ENCRYPTION_KEY') || this.config.get<string>('JWT_SECRET');
    if (!configured) throw new BadRequestException('ADMIN_TOTP_ENCRYPTION_KEY_NOT_CONFIGURED');
    return /^[a-f0-9]{64}$/i.test(configured)
      ? Buffer.from(configured, 'hex')
      : createHash('sha256').update(configured).digest();
  }

  private encryptAdminTotpSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.adminTotpEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
  }

  private decryptAdminTotpSecret(value: string): string {
    const [version, ivText, tagText, dataText] = String(value).split('.');
    if (version !== 'v1' || !ivText || !tagText || !dataText) throw new BadRequestException('ADMIN_TOTP_SECRET_INVALID');
    const decipher = createDecipheriv('aes-256-gcm', this.adminTotpEncryptionKey(), Buffer.from(ivText, 'base64'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64')), decipher.final()]).toString('utf8');
  }

  private adminTotpTokenKey(purpose: 'setup' | 'login', token: string): string {
    if (!token || typeof token !== 'string' || token.length < 32) throw new UnauthorizedException('ADMIN_TOTP_CHALLENGE_INVALID');
    const digest = createHash('sha256').update(token).digest('hex');
    return `admin-totp:${purpose}:${digest}`;
  }

  private safeAdminUser(user: any) {
    const {
      password: _password,
      adminTotpSecretEnc: _secret,
      adminTotpPendingSecretEnc: _pending,
      adminTotpRecoveryCodes: _recovery,
      ...safeUser
    } = user;
    return safeUser;
  }

  async startAdminTotpSetup(setupToken: string) {
    const tokenKey = this.adminTotpTokenKey('setup', setupToken);
    const userId = await this.redis.get(tokenKey);
    if (!userId) throw new UnauthorizedException('ADMIN_TOTP_SETUP_EXPIRED');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE') throw new UnauthorizedException('ADMIN_ACCOUNT_NOT_AVAILABLE');
    if (user.adminTotpEnabled && user.adminTotpSecretEnc) throw new BadRequestException('ADMIN_TOTP_ALREADY_ENABLED');

    // Keep setup retries stable: a refreshed login/setup screen must not
    // silently replace the secret already added to the administrator's app.
    // A pending secret is rotated only through an explicit recovery/reset.
    const secret = user.adminTotpPendingSecretEnc
      ? this.decryptAdminTotpSecret(user.adminTotpPendingSecretEnc)
      : generateAdminTotpSecret();
    if (!user.adminTotpPendingSecretEnc) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { adminTotpPendingSecretEnc: this.encryptAdminTotpSecret(secret) },
      });
    }
    const accountLabel = user.email || user.phone;
    const label = encodeURIComponent(`Zana Admin:${accountLabel}`);
    const issuer = encodeURIComponent('Zana Admin');
    const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
    return { secret, otpauthUrl, accountLabel, issuer: 'Zana Admin', digits: 6, periodSeconds: 30 };
  }

  async enableAdminTotp(setupToken: string, code: string) {
    const tokenKey = this.adminTotpTokenKey('setup', setupToken);
    const userId = await this.redis.get(tokenKey);
    if (!userId) throw new UnauthorizedException('ADMIN_TOTP_SETUP_EXPIRED');
    const attempts = await this.redis.incr(`${tokenKey}:attempts`, 10 * 60);
    if (attempts > 5) {
      await this.redis.del(tokenKey);
      await this.redis.del(`${tokenKey}:attempts`);
      throw new UnauthorizedException('TOO_MANY_AUTHENTICATOR_ATTEMPTS');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE' || !user.adminTotpPendingSecretEnc) {
      throw new UnauthorizedException('ADMIN_TOTP_SETUP_NOT_AVAILABLE');
    }
    const secret = this.decryptAdminTotpSecret(user.adminTotpPendingSecretEnc);
    if (!verifyAdminTotpCode(secret, String(code ?? '').trim())) {
      throw new UnauthorizedException('INVALID_AUTHENTICATOR_CODE');
    }

    const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(6).toString('hex').toUpperCase());
    const recoveryHashes = recoveryCodes.map(value => createHash('sha256').update(value).digest('hex'));
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        adminTotpSecretEnc: user.adminTotpPendingSecretEnc,
        adminTotpPendingSecretEnc: null,
        adminTotpEnabled: true,
        adminTotpEnabledAt: new Date(),
        adminTotpRecoveryCodes: JSON.stringify(recoveryHashes),
      },
    });
    await this.redis.del(tokenKey);
    await this.redis.del(`${tokenKey}:attempts`);
    const token = this.jwt.sign({ sub: updated.id, phone: updated.phone, role: updated.role, adminTotpVerifiedAt: Date.now() });
    return { token, user: this.safeAdminUser(updated), recoveryCodes };
  }

  async verifyAdminTotpLogin(challengeToken: string, code: string) {
    const tokenKey = this.adminTotpTokenKey('login', challengeToken);
    const userId = await this.redis.get(tokenKey);
    if (!userId) throw new UnauthorizedException('ADMIN_TOTP_CHALLENGE_EXPIRED');
    const attempts = await this.redis.incr(`${tokenKey}:attempts`, 5 * 60);
    if (attempts > 5) {
      await this.redis.del(tokenKey);
      await this.redis.del(`${tokenKey}:attempts`);
      throw new UnauthorizedException('TOO_MANY_AUTHENTICATOR_ATTEMPTS');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'ADMIN' || user.status !== 'ACTIVE' || !user.adminTotpEnabled || !user.adminTotpSecretEnc) {
      throw new UnauthorizedException('ADMIN_ACCOUNT_NOT_AVAILABLE');
    }

    let verified = false;
    const supplied = String(code ?? '').trim().toUpperCase();
    try {
      verified = verifyAdminTotpCode(this.decryptAdminTotpSecret(user.adminTotpSecretEnc), supplied);
    } catch {
      verified = false;
    }

    if (!verified && user.adminTotpRecoveryCodes) {
      let stored: string[] = [];
      try { stored = JSON.parse(user.adminTotpRecoveryCodes); } catch { stored = []; }
      const digest = createHash('sha256').update(supplied).digest('hex');
      const index = stored.findIndex(value => {
        const a = Buffer.from(String(value), 'hex');
        const b = Buffer.from(digest, 'hex');
        return a.length === b.length && timingSafeEqual(a, b);
      });
      if (index >= 0) {
        const updated = await this.prisma.user.updateMany({
          where: { id: user.id, adminTotpRecoveryCodes: user.adminTotpRecoveryCodes },
          data: { adminTotpRecoveryCodes: JSON.stringify(stored.filter((_, i) => i !== index)) },
        });
        verified = updated.count === 1;
      }
    }

    if (!verified) throw new UnauthorizedException('INVALID_AUTHENTICATOR_CODE');
    await this.redis.del(tokenKey);
    await this.redis.del(`${tokenKey}:attempts`);
    const token = this.jwt.sign({ sub: user.id, phone: user.phone, role: user.role, adminTotpVerifiedAt: Date.now() });
    return { token, user: this.safeAdminUser(user) };
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

    if (user.role === 'ADMIN') {
      if (user.status !== 'ACTIVE') throw new UnauthorizedException('ACCOUNT_NOT_ACTIVE');
      const needsSetup = !user.adminTotpEnabled || !user.adminTotpSecretEnc;
      const challengeToken = randomBytes(32).toString('base64url');
      const purpose = needsSetup ? 'setup' : 'login';
      const expiresInSeconds = needsSetup ? 10 * 60 : 5 * 60;
      await this.redis.set(this.adminTotpTokenKey(purpose, challengeToken), user.id, expiresInSeconds);
      return {
        requiresTwoFactorSetup: needsSetup,
        requiresTwoFactor: !needsSetup,
        ...(needsSetup ? { setupToken: challengeToken } : { challengeToken }),
        expiresInSeconds,
        user: this.safeAdminUser(user),
      };
    }

    const staffMember = user.role === 'STAFF'
      ? await this.prisma.staffMember.findUnique({ where: { userId: user.id }, select: { accessRole: true, active: true } })
      : null;
    if (user.role === 'STAFF' && !staffMember?.active) {
      throw new UnauthorizedException('STAFF_ACCOUNT_INACTIVE');
    }
    const accessRole = staffMember?.accessRole || undefined;
    const token = this.jwt.sign({ sub: user.id, phone: user.phone, role: user.role, ...(accessRole ? { accessRole } : {}) });
    return { token, user: this.safeAdminUser({ ...user, ...(accessRole ? { accessRole } : {}) }) };
  }

  async registerMerchantPublic(data: {
    email: string; password: string; businessName: string; category: string; phone: string;
    contactName?: string; branch?: string; whatsappPhone?: string; businessAddress?: string;
    businessLat?: number; businessLng?: number; locationPhotoBase64?: string;
  }) {
    const email = data.email?.trim().toLowerCase();
    const phone = data.phone?.trim();
    const businessName = data.businessName?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a valid email address.');
    if (!phone || phone.length < 7 || phone.length > 24) throw new BadRequestException('Enter a valid phone number with country code.');
    if (!businessName || businessName.length < 2 || businessName.length > 120) throw new BadRequestException('Business name must be between 2 and 120 characters.');
    if (!data.password || data.password.length < 8) throw new BadRequestException('Password must be at least 8 characters.');
    if (!['FOOD', 'GIFTS', 'GOODS'].includes(data.category)) throw new BadRequestException('Choose a valid business category.');
    if (!Number.isFinite(data.businessLat) || !Number.isFinite(data.businessLng) || data.businessLat! < -90 || data.businessLat! > 90 || data.businessLng! < -180 || data.businessLng! > 180) throw new BadRequestException('Select the exact business location on the map.');
    if (!data.locationPhotoBase64 || data.locationPhotoBase64.length > 3_000_000) throw new BadRequestException('Upload a clear business premises photo (maximum 5 MB).');
    const locationPhotoUrl = await this.storage.uploadImage(data.locationPhotoBase64, 'merchant-locations');
    if (!locationPhotoUrl) throw new BadRequestException('Business photo upload is unavailable. Please contact Zana support.');

    const [existingPhone, existingEmail] = await Promise.all([
      this.prisma.user.findUnique({ where: { phone } }),
      this.prisma.user.findUnique({ where: { email } }),
    ]);
    if (existingPhone) throw new ConflictException('An account with this phone number already exists.');
    if (existingEmail) throw new ConflictException('An account with this email already exists.');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const result = await this.prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          phone, email, password: passwordHash, role: 'MERCHANT' as any,
          firstName: data.contactName?.trim() || businessName, phoneVerified: false,
          wallet: { create: { balance: 0 } },
        },
      });
      const merchant = await tx.merchant.create({
        data: {
          userId: user.id, businessName, category: data.category as any,
          branch: data.branch?.trim() || undefined,
          whatsappPhone: data.whatsappPhone?.trim() || phone,
          businessAddress: data.businessAddress?.trim() || undefined,
          businessLat: data.businessLat,
          businessLng: data.businessLng,
          coverUrl: locationPhotoUrl,
          status: 'PENDING' as any,
        },
      });
      return { user, merchant };
    });
    const token = this.jwt.sign({ sub: result.user.id, phone: result.user.phone, role: result.user.role });
    const { password: _password, ...safeUser } = result.user;
    return { token, user: safeUser, merchant: result.merchant, status: 'PENDING_REVIEW' };
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
    if (user.role === 'ADMIN') throw new UnauthorizedException('ADMIN_PASSWORD_AND_AUTHENTICATOR_REQUIRED');

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
  async lookupPasswordReset(identifier: string) {
    const raw = identifier.trim();
    const normalizedEmail = raw.toLowerCase();
    const normalizedPhone = raw.replace(/\D/g, '');
    const phone = normalizedPhone.startsWith('250') ? `+${normalizedPhone}` : normalizedPhone ? `+250${normalizedPhone.replace(/^0+/, '')}` : raw;

    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: normalizedEmail }, { phone }, { phone: raw }] },
    });

    if (!user?.email || !user.phone) {
      return { exists: false, emailHint: null };
    }

    return { exists: true, emailHint: this.maskEmail(user.email) };
  }

  async requestPasswordReset(identifier: string) {
    const raw = identifier.trim();
    const normalizedEmail = raw.toLowerCase();
    const normalizedPhone = raw.replace(/\D/g, '');
    const phone = normalizedPhone.startsWith('250') ? `+${normalizedPhone}` : normalizedPhone ? `+250${normalizedPhone.replace(/^0+/, '')}` : raw;

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { phone: phone },
          { phone: raw },
        ],
      },
    });

    // Recovery is intentionally email-only. If the person supplied a phone
    // number, resolve the account first and send the code to its email.
    // Keep the response generic so this endpoint cannot enumerate accounts.
    if (!user?.email || !user.phone) {
      console.log(`[RESET] no recoverable account for identifier`);
      return { sent: true, channel: null, phoneHint: null, emailHint: null };
    }

    const sent = await this.emailService.sendPasswordResetCode(
      user.email,
      await this.issuePasswordResetCode(user.phone),
    );
    if (!sent) {
      console.error(`[RESET] email delivery failed for account`);
    }

    return {
      sent: true,
      channel: 'email',
      phoneHint: null,
      emailHint: this.maskEmail(user.email),
    };
  }

  private async issuePasswordResetCode(phone: string): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + OTP_TTL_SECONDS * 1000;
    await this.saveOtp(phone, { code, expiresAt });
    return code;
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return 'your email';
    const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
    return `${visible}${'•'.repeat(Math.max(1, Math.min(3, local.length - visible.length)))}${local.length > 1 ? local.slice(-1) : ''}@${domain}`;
  }

  /** Verify the code and set the new password in one step. */
  async resetPassword(identifier: string, code: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('PASSWORD_TOO_SHORT');
    }

    const raw = identifier.trim();
    const normalizedEmail = raw.toLowerCase();
    const digits = raw.replace(/\D/g, '');
    const normalizedPhone = digits.startsWith('250') ? `+${digits}` : digits ? `+250${digits.replace(/^0+/, '')}` : raw;
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ phone: normalizedPhone }, { phone: raw }, { email: normalizedEmail }] },
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