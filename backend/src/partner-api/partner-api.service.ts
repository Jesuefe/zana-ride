import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PartnerApiService {
  constructor(private readonly prisma: PrismaService) {}

  private assertScope(scopes: string[], required: string) {
    if (!scopes.includes(required) && !scopes.includes('*')) throw new ForbiddenException('INSUFFICIENT_API_SCOPE');
  }

  async account(partnerId: string, scopes: string[]) {
    this.assertScope(scopes, 'account:read');
    const partner = await this.prisma.apiPartner.findUnique({
      where: { id: partnerId },
      select: { id: true, name: true, status: true, createdAt: true },
    });
    if (!partner) throw new NotFoundException('PARTNER_NOT_FOUND');
    return partner;
  }

  async wallet(partnerId: string, scopes: string[]) {
    this.assertScope(scopes, 'wallet:read');
    const wallet = await this.prisma.apiPartnerWallet.findUnique({
      where: { partnerId },
      select: { currency: true, available: true, reserved: true, creditLimit: true, suspendedAt: true, updatedAt: true },
    });
    if (!wallet) throw new NotFoundException('PARTNER_WALLET_NOT_CONFIGURED');
    return { ...wallet, creditAvailable: Math.max(0, wallet.creditLimit - Math.max(0, wallet.reserved - wallet.available)) };
  }

  async transactions(partnerId: string, scopes: string[], limitInput?: string) {
    this.assertScope(scopes, 'wallet:read');
    const limit = Math.min(100, Math.max(1, Number.parseInt(limitInput ?? '25', 10) || 25));
    const wallet = await this.prisma.apiPartnerWallet.findUnique({ where: { partnerId }, select: { id: true } });
    if (!wallet) throw new NotFoundException('PARTNER_WALLET_NOT_CONFIGURED');
    return this.prisma.apiPartnerWalletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, type: true, amount: true, availableBefore: true, availableAfter: true, reservedBefore: true, reservedAfter: true, reference: true, description: true, createdAt: true },
    });
  }
}
