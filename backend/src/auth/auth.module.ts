import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    PassportModule,
    EmailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule, RedisModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        // A silent fallback to a hardcoded, publicly-known string here
        // means a misconfigured deploy — the env var simply missing —
        // would quietly sign every token with a secret anyone reading
        // this source can already see, rather than failing loudly the
        // moment it happens.
        if (!secret) {
          throw new Error('JWT_SECRET must be set — refusing to start with an insecure default.');
        }
        return {
          secret,
          signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '30d') as `${number}${'d' | 'h' | 'm' | 's'}` },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
