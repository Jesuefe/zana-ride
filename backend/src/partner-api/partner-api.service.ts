import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PaypackService } from '../wallet/paypack.service';

@Injectable()
export class PartnerApiService {
  constructor(private readonly prisma: PrismaService, private readonly paypack: PaypackService) {}

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


  async initiateTopUp(partnerId: string, scopes: string[], reference: string, phone: string, amount: number) {
    this.assertScope(scopes, 'wallet:topup');
    this.validateReference(reference);
    this.validateAmount(amount);
    if (typeof phone !== 'string' || !phone.trim()) throw new BadRequestException('MOBILE_MONEY_PHONE_REQUIRED');
    const wallet = await this.walletForPartner(this.prisma, partnerId);
    const ledgerReference = 'topup-pending:' + partnerId + ':' + reference;
    let pending = await this.prisma.apiPartnerWalletTransaction.findUnique({ where: { reference: ledgerReference } });
    if (pending) {
      if (pending.walletId !== wallet.id || pending.amount !== amount) throw new ConflictException('TOPUP_REFERENCE_ALREADY_USED');
      if (pending.status === 'COMPLETED') return { reference, status: 'completed', amount, currency: 'RWF', replayed: true };
      if (pending.status === 'FAILED') throw new ConflictException('TOPUP_PREVIOUSLY_FAILED_USE_NEW_REFERENCE');
      if (pending.status === 'PENDING') return { reference, providerRef: pending.providerRef, status: 'pending', amount, currency: 'RWF', replayed: true };
    } else {
      pending = await this.prisma.apiPartnerWalletTransaction.create({ data: {
        walletId: wallet.id, type: 'TOPUP_INITIATED', amount,
        availableBefore: wallet.available, availableAfter: wallet.available,
        reservedBefore: wallet.reserved, reservedAfter: wallet.reserved,
        reference: ledgerReference, status: 'INITIATING',
        description: 'Partner prepaid wallet top-up initiated',
      }});
    }

    const providerKey = 'ZP' + createHash('sha256').update(partnerId + ':' + reference).digest('hex').slice(0, 24);
    try {
      const result = await this.paypack.cashin(phone, amount, providerKey);
      if (result.status === 'failed') {
        await this.prisma.apiPartnerWalletTransaction.update({ where: { id: pending.id }, data: { status: 'FAILED' } });
        return { reference, status: 'failed', amount, currency: 'RWF' };
      }
      await this.prisma.apiPartnerWalletTransaction.update({
        where: { id: pending.id },
        data: { providerRef: result.ref, status: 'PENDING' },
      });
      return { reference, providerRef: result.ref, status: 'pending', amount, currency: 'RWF' };
    } catch (error) {
      // Leave INITIATING in place. A retry uses the same provider idempotency key,
      // allowing Paypack to return the original request rather than starting a
      // second collection if the first response was lost in transit.
      throw error;
    }
  }

  async checkTopUpStatus(partnerId: string, scopes: string[], reference: string) {
    this.assertScope(scopes, 'wallet:read');
    this.validateReference(reference);
    const ledgerReference = 'topup-pending:' + partnerId + ':' + reference;
    const pending = await this.prisma.apiPartnerWalletTransaction.findUnique({ where: { reference: ledgerReference } });
    if (!pending) throw new NotFoundException('TOPUP_NOT_FOUND');
    if (pending.status === 'COMPLETED' || pending.status === 'FAILED') {
      const wallet = await this.prisma.apiPartnerWallet.findUnique({ where: { id: pending.walletId }, select: { available: true, currency: true } });
      return { reference, status: pending.status.toLowerCase(), amount: pending.amount, balance: wallet?.available ?? null, currency: wallet?.currency ?? 'RWF' };
    }
    if (!pending.providerRef) return { reference, status: 'initiating', amount: pending.amount };
    const remote = await this.paypack.getTransaction(pending.providerRef);
    if (remote.status === 'failed') {
      await this.prisma.apiPartnerWalletTransaction.updateMany({
        where: { id: pending.id, status: 'PENDING' },
        data: { status: 'FAILED' },
      });
      return { reference, status: 'failed', amount: pending.amount };
    }
    if (remote.status !== 'successful') return { reference, status: 'pending', amount: pending.amount };

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.apiPartnerWalletTransaction.updateMany({
        where: { id: pending.id, status: 'PENDING' },
        data: { status: 'COMPLETED' },
      });
      const wallet = await tx.apiPartnerWallet.findUniqueOrThrow({ where: { id: pending.walletId } });
      if (claimed.count === 1) {
        const changed = await tx.apiPartnerWallet.update({
          where: { id: wallet.id },
          data: { available: { increment: pending.amount } },
        });
        await tx.apiPartnerWalletTransaction.create({ data: {
          walletId: wallet.id, type: 'TOPUP_CREDITED', amount: pending.amount,
          availableBefore: wallet.available, availableAfter: changed.available,
          reservedBefore: wallet.reserved, reservedAfter: wallet.reserved,
          reference: 'topup-credit:' + partnerId + ':' + reference,
          status: 'COMPLETED', description: 'Paypack-confirmed partner wallet top-up',
        }});
        return { reference, status: 'completed', amount: pending.amount, balance: changed.available, currency: wallet.currency };
      }
      return { reference, status: 'completed', amount: pending.amount, balance: wallet.available, currency: wallet.currency, replayed: true };
    }, { isolationLevel: 'Serializable' });
  }

  async reserve(partnerId: string, scopes: string[], reference: string, amount: number) {
    this.assertScope(scopes, 'wallet:reserve');
    this.validateReference(reference);
    this.validateAmount(amount);
    const ledgerReference = 'reserve:' + partnerId + ':' + reference;
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
    const ledgerReference = 'settle:' + partnerId + ':' + reference;
    return this.prisma.$transaction(async (tx) => {
      const prior = await tx.apiPartnerWalletTransaction.findUnique({ where: { reference: ledgerReference } });
      if (prior) {
        const existingWallet = await tx.apiPartnerWallet.findUnique({ where: { id: prior.walletId }, select: { partnerId: true } });
        if (!existingWallet || existingWallet.partnerId !== partnerId) throw new NotFoundException('RESERVATION_NOT_FOUND');
        return { settled: true, replayed: true, reference, amount: prior.amount, status: 'SETTLED' };
      }
      const wallet = await this.walletForPartner(tx, partnerId, true);
      const reservation = await tx.apiPartnerWalletTransaction.findUnique({ where: { reference: 'reserve:' + partnerId + ':' + reference } });
      if (!reservation || reservation.walletId !== wallet.id) throw new ConflictException('DELIVERY_RESERVATION_NOT_FOUND');
      const released = await tx.apiPartnerWalletTransaction.findUnique({ where: { reference: 'release:' + partnerId + ':' + reference } });
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
    const ledgerReference = 'release:' + partnerId + ':' + reference;
    return this.prisma.$transaction(async (tx) => {
      const prior = await tx.apiPartnerWalletTransaction.findUnique({ where: { reference: ledgerReference } });
      if (prior) {
        const existingWallet = await tx.apiPartnerWallet.findUnique({ where: { id: prior.walletId }, select: { partnerId: true } });
        if (!existingWallet || existingWallet.partnerId !== partnerId) throw new NotFoundException('RESERVATION_NOT_FOUND');
        return { released: true, replayed: true, reference, amount: prior.amount, status: 'RELEASED' };
      }
      const wallet = await this.walletForPartner(tx, partnerId, true);
      const reservation = await tx.apiPartnerWalletTransaction.findUnique({ where: { reference: 'reserve:' + partnerId + ':' + reference } });
      if (!reservation || reservation.walletId !== wallet.id) throw new ConflictException('DELIVERY_RESERVATION_NOT_FOUND');
      const settled = await tx.apiPartnerWalletTransaction.findUnique({ where: { reference: 'settle:' + partnerId + ':' + reference } });
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
      select: { currency: true, available: true, reserved: true, suspendedAt: true, updatedAt: true },
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
      select: { id: true, type: true, amount: true, status: true, providerRef: true, availableBefore: true, availableAfter: true, reservedBefore: true, reservedAfter: true, reference: true, description: true, createdAt: true },
    });
  }
}
