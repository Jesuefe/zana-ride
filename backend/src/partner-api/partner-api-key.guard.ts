import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PartnerApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = String(request.headers.authorization ?? '');
    const match = authorization.match(/^Bearer (zana_(?:live|test)_[A-Za-z0-9_-]{24,})$/);
    if (!match) throw new UnauthorizedException('INVALID_PARTNER_CREDENTIALS');

    const token = match[1];
    const secretHash = createHash('sha256').update(token).digest('hex');
    const credential = await this.prisma.apiCredential.findUnique({
      where: { secretHash },
      include: { partner: { select: { id: true, status: true } } },
    });
    if (!credential || !credential.active || (credential.expiresAt && credential.expiresAt <= new Date())) {
      throw new UnauthorizedException('INVALID_PARTNER_CREDENTIALS');
    }
    if (credential.partner.status !== 'ACTIVE') throw new UnauthorizedException('PARTNER_NOT_ACTIVE');
    const expectedEnvironment = token.startsWith('zana_test_') ? 'SANDBOX' : 'LIVE';
    if (credential.environment !== expectedEnvironment) throw new UnauthorizedException('CREDENTIAL_ENVIRONMENT_MISMATCH');

    await this.prisma.apiCredential.update({ where: { id: credential.id }, data: { lastUsedAt: new Date() } });
    request.partner = { id: credential.partnerId, credentialId: credential.id, scopes: credential.scopes };
    return true;
  }
}
