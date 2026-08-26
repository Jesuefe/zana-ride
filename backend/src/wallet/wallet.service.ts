import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

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
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + amount;
      if (balanceAfter < 0) throw new BadRequestException('Insufficient wallet balance');

      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter } });
      return tx.walletTransaction.create({
        data: { walletId: wallet.id, amount, balanceBefore, balanceAfter, reference },
      });
    });
  }
}
