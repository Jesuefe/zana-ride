import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EversendService } from './eversend.service';
import { WooshPayService } from './wooshpay.service';
import { WalletTransactionStatus } from '@prisma/client';

@Injectable()
export class WalletService {
  static readonly EVERSEND_MIN_WITHDRAWAL = 1000;
  static readonly WOOSHPAY_MIN_WITHDRAWAL = 980;

  constructor(
    private prisma: PrismaService,
    private eversend: EversendService,
    private wooshPay: WooshPayService,
  ) {}

  async findByUserId(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  // Ledger-style: every change is a new row, balance is never edited directly —
  // see spec section 19. Wrapped in a transaction so balance and the ledger
  // entry can never drift apart.
  async applyTransaction(userId: string, amount: number, reference?: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    if (amount >= 0) {
      // Credits cannot make the balance invalid, so a single atomic
      // increment is enough — no stale read ever decides the outcome.
      await this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      });
    } else {
      // Debits must never be decided from a balance read that could be
      // stale by the time the write lands — two requests racing here could
      // otherwise both pass a "balance >= amount" check against the same
      // starting number and both succeed, overdrawing the wallet. The WHERE
      // clause below is evaluated by Postgres as part of the same atomic
      // operation as the write, so a second concurrent call re-checks
      // against the balance the first call actually left behind.
      const result = await this.prisma.wallet.updateMany({
        where: { id: wallet.id, balance: { gte: -amount } },
        data: { balance: { increment: amount } },
      });
      if (result.count === 0) throw new BadRequestException('Insufficient wallet balance');
    }

    const after = await this.prisma.wallet.findUnique({ where: { id: wallet.id } });
    return this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount,
        balanceBefore: wallet.balance,
        balanceAfter: after!.balance,
        reference,
      },
    });
  }

  // Kicks off a real mobile money top-up via Eversend. The customer approves
  // on their phone; the balance is NOT credited yet — that only happens once
  // confirmTopUp() sees a successful status (the frontend polls for this,
  // same pattern as ride tracking, since we don't have a stable public URL
  // for Eversend's webhook yet).
  async initiateTopUp(userId: string, phoneNumber: string, amountRwf: number) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    // Customers may fund their own wallet from any supported mobile-money
    // number. The destination of the collection is the payment provider,
    // not another ZANA wallet, so the number does not have to match the
    // customer's registered account phone.
    const phone = String(phoneNumber ?? '').trim();
    if (!/^\+?[0-9]{9,15}$/.test(phone)) {
      throw new BadRequestException('INVALID_MOBILE_MONEY_NUMBER');
    }

    const cashin = await this.wooshPay.collectMobileMoney(phone, amountRwf, `ZANA-TOPUP-${userId}-${Date.now()}`);

    await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: amountRwf,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance, // unchanged until confirmed
        reference: 'Mobile Money Top Up',
        providerRef: cashin.ref,
        status: WalletTransactionStatus.PENDING,
      },
    });

    return { ref: cashin.ref, status: 'pending' };
  }

  async checkTopUpStatus(userId: string, ref: string) {
    const pending = await this.prisma.walletTransaction.findUnique({ where: { providerRef: ref } });
    if (!pending) throw new NotFoundException('Top-up not found');

    if (pending.status !== WalletTransactionStatus.PENDING) {
      return { status: pending.status.toLowerCase() };
    }

    const remote = await this.wooshPay.getCollectionStatus(ref);
    const remoteStatus = remote.status?.toLowerCase();

    const isFailed = remoteStatus === 'failed' || remoteStatus === 'cancelled' || remoteStatus === 'canceled';
    const isStillPending = remoteStatus === 'pending';

    // Eversend drops the "status" field entirely once a transaction settles —
    // only PENDING and FAILED transactions carry an explicit status. A
    // response with no status (and a real fee charged) means it succeeded.
    if (!isFailed && !isStillPending) {
      // The client polls this endpoint every few seconds while a MoMo
      // prompt is pending, and the background reconciler independently
      // sweeps the same pending transactions every minute — so two
      // processes can both observe PENDING here at nearly the same moment.
      // This claim step is the actual guard: only whichever call flips the
      // status from PENDING to COMPLETED first proceeds to credit the
      // wallet, atomically, in the same statement as the claim. The other
      // sees count === 0 and backs off rather than crediting a second time.
      const claimed = await this.prisma.walletTransaction.updateMany({
        where: { id: pending.id, status: WalletTransactionStatus.PENDING },
        data: { status: WalletTransactionStatus.COMPLETED },
      });

      if (claimed.count === 0) {
        // Someone else (the reconciler, most likely) already settled this.
        const current = await this.prisma.walletTransaction.findUnique({ where: { id: pending.id } });
        const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
        return { status: current?.status.toLowerCase() ?? 'completed', balance: wallet?.balance ?? 0 };
      }

      await this.prisma.wallet.update({
        where: { userId },
        data: { balance: { increment: pending.amount } },
      });
      const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
      await this.prisma.walletTransaction.update({
        where: { id: pending.id },
        data: { balanceAfter: wallet!.balance },
      });
      return { status: 'completed', balance: wallet!.balance };
    }

    if (isFailed) {
      await this.prisma.walletTransaction.update({
        where: { id: pending.id },
        data: { status: WalletTransactionStatus.FAILED },
      });
      return { status: 'failed' };
    }

    return { status: 'pending' };
  }

  // Mirrors initiateTopUp/checkTopUpStatus closely on purpose — same real
  // Eversend cashin + poll + atomic-claim pattern already proven safe
  // against double-crediting there. The amount is computed here from the
  // driver's actual unpaid debt, never taken from the client, so there's
  // no way to request settling more or less than what's genuinely owed.
  async initiateDebtSettlement(userId: string, phoneNumber: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver not found');

    const unpaidDebts = await this.prisma.commissionDebt.findMany({
      where: { driverId: driver.id, paidAt: null },
    });
    const amount = unpaidDebts.reduce((s, d) => s + d.amount, 0);
    if (amount <= 0) throw new BadRequestException('No outstanding balance to settle');

    const cashin = await this.eversend.collectMobileMoney(phoneNumber, amount, `ZANA-DEBT-${driver.id}-${Date.now()}`);

    await this.prisma.debtSettlement.create({
      data: { driverId: driver.id, amount, providerRef: cashin.ref, status: 'PENDING' },
    });

    return { ref: cashin.ref, status: 'pending', amount };
  }

  async checkDebtSettlementStatus(userId: string, ref: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver not found');

    const pending = await this.prisma.debtSettlement.findUnique({ where: { providerRef: ref } });
    if (!pending || pending.driverId !== driver.id) throw new NotFoundException('Settlement not found');

    if (pending.status !== 'PENDING') {
      return { status: pending.status.toLowerCase() };
    }

    const remote = await this.eversend.getCollectionStatus(ref);
    const remoteStatus = remote.status?.toLowerCase();
    const isFailed = remoteStatus === 'failed' || remoteStatus === 'cancelled' || remoteStatus === 'canceled';
    const isStillPending = remoteStatus === 'pending';

    if (!isFailed && !isStillPending) {
      // Same atomic-claim guard as the wallet top-up path — the client's
      // own poll and the background reconciler can both observe PENDING
      // here at nearly the same moment; only whichever call flips this
      // first goes on to actually clear any debt.
      const claimed = await this.prisma.debtSettlement.updateMany({
        where: { id: pending.id, status: 'PENDING' },
        data: { status: 'COMPLETED' },
      });

      if (claimed.count === 0) {
        const current = await this.prisma.debtSettlement.findUnique({ where: { id: pending.id } });
        return { status: current?.status.toLowerCase() ?? 'completed' };
      }

      // Oldest debts first — the same order the automatic settlement
      // path already uses, so a partial payment (if this amount is ever
      // less than the full total, e.g. debt accrued between initiating
      // and confirming) clears the longest-outstanding amounts first.
      let remaining = pending.amount;
      const unpaidDebts = await this.prisma.commissionDebt.findMany({
        where: { driverId: driver.id, paidAt: null },
        orderBy: { createdAt: 'asc' },
      });
      for (const debt of unpaidDebts) {
        if (remaining <= 0) break;
        if (debt.amount <= remaining) {
          remaining -= debt.amount;
          await this.prisma.commissionDebt.update({ where: { id: debt.id }, data: { paidAt: new Date(), settledVia: 'MANUAL' } });
        }
      }

      return { status: 'completed', amountSettled: pending.amount };
    }

    if (isFailed) {
      await this.prisma.debtSettlement.update({ where: { id: pending.id }, data: { status: 'FAILED' } });
      return { status: 'failed' };
    }

    return { status: 'pending' };
  }

  async withdraw(userId: string, amount: number) {
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, phone: true },
    });
    if (!account) throw new NotFoundException('Account not found');
    if (account.role !== 'DRIVER' && account.role !== 'MERCHANT') {
      throw new BadRequestException('PAYOUT_ONLY_DRIVER_OR_MERCHANT');
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('INVALID_WITHDRAWAL_AMOUNT');
    }
    if (amount < WalletService.WOOSHPAY_MIN_WITHDRAWAL) {
      throw new BadRequestException(`MIN_WITHDRAWAL:${WalletService.WOOSHPAY_MIN_WITHDRAWAL}`);
    }

    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (wallet.balance < amount) throw new BadRequestException('Insufficient balance');

    // Protect against double taps/retries that reach the API twice within a
    // short window. The ledger row is still the source of truth; this guard
    // only prevents an accidental duplicate payout request.
    const recent = await this.prisma.walletTransaction.findFirst({
      where: {
        walletId: wallet.id,
        amount: -amount,
        status: WalletTransactionStatus.PENDING,
        createdAt: { gte: new Date(Date.now() - 30_000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      return { success: true, ref: recent.providerRef, status: 'PENDING', rail: 'WOOSHPAY', duplicate: true };
    }

    // Always the account's own registered number — this is what
    // actually closes the gap: previously any destination number sent
    // by the client was trusted outright, so a compromised account
    // could be drained to an attacker's own MoMo number instead of the
    // real account holder's.
    // Payout destination is always the driver's/merchant's registered
    // account number. Never accept a payout destination from the client.
    const phone = account.phone;
    // This early check is only a fast, friendly rejection for the common
    // case. It is NOT what protects against overdraft — the atomic
    // conditional decrement further down is what actually guards that,
    // because this read can be stale by the time we act on it.

    const balanceBefore = wallet.balance;

    // The atomic guard that actually prevents overdraft: Postgres applies
    // the WHERE check and the decrement as one operation, so two withdraw
    // requests racing each other serialize here rather than both reading
    // the same starting balance and both succeeding.
    const debited = await this.prisma.wallet.updateMany({
      where: { userId, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (debited.count === 0) {
      throw new BadRequestException('Insufficient balance');
    }

    const afterWallet = await this.prisma.wallet.findUnique({ where: { userId } });
    const balanceAfter = afterWallet!.balance;

    try {
      const result = await this.wooshPay.payout(phone, amount, `ZANA-WITHDRAW-${userId}-${Date.now()}`);

      // Both rails settle asynchronously — the reconciler confirms it.
      await this.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: -amount,
          balanceBefore,
          balanceAfter,
          status: WalletTransactionStatus.PENDING,
          reference: `Withdrawal to ${phone}`,
          providerRef: result?.ref ?? undefined,
          description: `Withdrawal to ${phone} (WooshPay)`,
        } as any,
      });

      console.log(
        `[WITHDRAW] ${amount} RWF to ${phone} via WooshPay | ref ${result?.ref}`,
      );
      return {
        success: true,
        ref: result?.ref,
        status: 'PENDING',
        rail: 'WOOSHPAY',
      };
    } catch (err: any) {
      // Nothing left Zana — put it back. Adding the exact amount back atomically
      // rather than resetting to the pre-debit balance, because resetting to a
      // stale snapshot would silently erase any other wallet activity that
      // landed during the network round trip to the payment provider.
      await this.prisma.wallet.update({
        where: { userId }, data: { balance: { increment: amount } },
      });
      throw new BadRequestException(err?.message ?? 'Withdrawal failed — please try again');
    }
  }


}