import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PartnerApiService {
  constructor(private readonly prisma: PrismaService) {}

  private assertScope(scopes: string[], required: string) {
    if (!scopes.includes(required) && !scopes.includes('*')) throw new ForbiddenException('INSUFFICIENT_API_SCOPE');
  }


  private validateAmount(amount: number) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadRequestException('AMOUNT_MUST_BE_A_POSITIVE_INTEGER_IN_RWF');
    }
  }

  private validateReference(reference: string) {
    if (typeof reference !== 'string' || !/^[A-Za-z0-9._:-]{3,120}$/.test(reference)) {
      throw new BadRequestException('INVALID_EXTERNAL_REFERENCE');
    }
  }

  private async walletForPartner(tx: any, partnerId: string, allowSuspended = false) {
    const wallet = await tx.apiPartnerWallet.findUnique({ where: { partnerId } });
    if (!wallet) throw new NotFoundException('PARTNER_WALLET_NOT_CONFIGURED');
    if (wallet.suspendedAt && !allowSuspended) throw new ConflictException('PARTNER_WALLET_SUSPENDED');
    return wallet;
  }

  async reserve(partnerId: string, scopes: string[], reference: string, amount: number) {
    this.assertScope(scopes, 'wallet:reserve');
    this.validateReference(reference);
    this.validateAmount(amount);
    const ledgerReference = 'reserve:' + reference;
    return this.prisma.$transaction(async (tx) => {
      const prior = await tx.apiPartnerWalletTransaction.findUnique({ where: { reference: ledgerReference } });
      if (prior) {
        const existingWallet = await tx.apiPartnerWallet.findUnique({ where: { id: prior.walletId }, select: { partnerId: true } });
        if (!existingWallet || existingWallet.partnerId !== partnerId) throw new NotFoundException('RESERVATION_NOT_FOUND');
        if (prior.amount !== amount) throw new ConflictException('IDEMPOTENCY_REFERENCE_AMOUNT_MISMATCH');
        return { secured: true, replayed: true, reference, amount, currency: 'RWF', status: 'RESERVED' };
      }
      const wallet = await this.walletForPartner(tx, partnerId);
      const changed = await tx.apiPartnerWallet.updateMany({
        where: { id: wallet.id, suspendedAt: null, available: { gte: amount } },
        data: { available: { decrement: amount }, reserved: { increment: amount } },
      });
      if (changed.count !== 1) throw new ConflictException('INSUFFICIENT_PREPAID_BALANCE');
      const after = await tx.apiPartnerWallet.findUniqueOrThrow({ where: { id: wallet.id } });
      await tx.apiPartnerWalletTransaction.create({ data: {
        walletId: wallet.id, type: 'RESERVED', amount,
        availableBefore: wallet.available, availableAfter: after.available,
        reservedBefore: wallet.reserved, reservedAfter: after.reserved,
        reference: ledgerReference, description: 'Prepaid funds reserved for delivery ' + reference,
      }});
      return { secured: true, replayed: false, reference, amount, currency: wallet.currency, status: 'RESERVED', available: after.available, reserved: after.reserved };
    }, { isolationLevel: 'Serializable' });
  }

  async settle(partnerId: string, scopes: string[], reference: string) {
    this.assertScope(scopes, 'wallet:settle');
    this.validateReference(reference);
    const ledgerReference = 'settle:' + reference;
    return this.prisma.$transaction(async (tx) => {
      const prior = await tx.apiPartnerWalletTransaction.findUnique({ where: { reference: ledgerReference } });
      if (prior) {
        const existingWallet = await tx.apiPartnerWallet.findUnique({ where: { id: prior.walletId }, select: { partnerId: true } });
        if (!existingWallet || existingWallet.partnerId !== partnerId) throw new NotFoundException('RESERVATION_NOT_FOUND');
        return { settled: true, replayed: true, reference, amount: prior.amount, status: 'SETTLED' };
      }
      const wallet = await this.walletForPartner(tx, partnerId, true);
      const reservation = await tx.apiPartnerWalletTransaction.findUnique({ where: { reference: 'reserve:' + reference } });
      if (!reservation || reservation.walletId !== wallet.id) throw new ConflictException('DELIVERY_RESERVATION_NOT_FOUND');
      const released = await tx.apiPartnerWalletTransaction.findUnique({ where: { reference: 'release:' + reference } });
      if (released) throw new ConflictException('DELIVERY_RESERVATION_ALREADY_RELEASED');
      const changed = await tx.apiPartnerWallet.updateMany({
        where: { id: wallet.id, reserved: { gte: reservation.amount } },
        data: { reserved: { decrement: reservation.amount } },
      });
      if (changed.count !== 1) throw new ConflictException('RESERVED_BALANCE_INCONSISTENT');
      const after = await tx.apiPartnerWallet.findUniqueOrThrow({ where: { id: wallet.id } });
      await tx.apiPartnerWalletTransaction.create({ data: {
        walletId: wallet.id, type: 'SETTLED', amount: reservation.amount,
        availableBefore: wallet.available, availableAfter: after.available,
        reservedBefore: wallet.reserved, reservedAfter: after.reserved,
        reference: ledgerReference, description: 'Prepaid delivery charge settled ' + reference,
      }});
      return { settled: true, replayed: false, reference, amount: reservation.amount, status: 'SETTLED', available: after.available, reserved: after.reserved };
    }, { isolationLevel: 'Serializable' });
  }

  async release(partnerId: string, scopes: string[], reference: string, reason?: string) {
    this.assertScope(scopes, 'wallet:release');
    this.validateReference(reference);
    const ledgerReference = 'release:' + reference;
    return this.prisma.$transaction(async (tx) => {
      const prior = await tx.apiPartnerWalletTransaction.findUnique({ where: { reference: ledgerReference } });
      if (prior) {
        const existingWallet = await tx.apiPartnerWallet.findUnique({ where: { id: prior.walletId }, select: { partnerId: true } });
        if (!existingWallet || existingWallet.partnerId !== partnerId) throw new NotFoundException('RESERVATION_NOT_FOUND');
        return { released: true, replayed: true, reference, amount: prior.amount, status: 'RELEASED' };
      }
      const wallet = await this.walletForPartner(tx, partnerId, true);
      const reservation = await tx.apiPartnerWalletTransaction.findUnique({ where: { reference: 'reserve:' + reference } });
      if (!reservation || reservation.walletId !== wallet.id) throw new ConflictException('DELIVERY_RESERVATION_NOT_FOUND');
      const settled = await tx.apiPartnerWalletTransaction.findUnique({ where: { reference: 'settle:' + reference } });
      if (settled) throw new ConflictException('DELIVERY_ALREADY_SETTLED');
      const changed = await tx.apiPartnerWallet.updateMany({
        where: { id: wallet.id, reserved: { gte: reservation.amount } },
        data: { reserved: { decrement: reservation.amount }, available: { increment: reservation.amount } },
      });
      if (changed.count !== 1) throw new ConflictException('RESERVED_BALANCE_INCONSISTENT');
      const after = await tx.apiPartnerWallet.findUniqueOrThrow({ where: { id: wallet.id } });
      await tx.apiPartnerWalletTransaction.create({ data: {
        walletId: wallet.id, type: 'RELEASED', amount: reservation.amount,
        availableBefore: wallet.available, availableAfter: after.available,
        reservedBefore: wallet.reserved, reservedAfter: after.reserved,
        reference: ledgerReference, description: reason?.slice(0, 240) || 'Unused delivery reservation released ' + reference,
      }});
      return { released: true, replayed: false, reference, amount: reservation.amount, status: 'RELEASED', available: after.available, reserved: after.reserved };
    }, { isolationLevel: 'Serializable' });
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
    return { ...wallet, creditAvailable: 0, billingMode: 'PREPAID_ONLY' };
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
