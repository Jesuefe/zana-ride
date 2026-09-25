import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export type JwtPayload = { sub: string; phone: string; role: string };

// super() has to be the first statement in a derived constructor, so the
// same "refuse to start rather than silently sign with a known secret"
// check from auth.module.ts is expressed here as a function called
// directly inside that super() call instead of a statement before it.
function requireJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret) {
    throw new Error('JWT_SECRET must be set — refusing to start with an insecure default.');
  }
  return secret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret(config),
    });
  }

  async validate(payload: JwtPayload) {
    // Previously just returned the raw token payload — a suspended or
    // banned user's existing, already-issued token (valid up to 30
    // days) kept working for every single request regardless, since
    // nothing here ever re-checked their actual current status. This
    // is the one place that check can genuinely close that gap for
    // every role at once, rather than patching it endpoint by endpoint.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('ACCOUNT_NOT_ACTIVE');
    }
    return payload;
  }
}
