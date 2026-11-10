import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ImpactFundDisbursementService {
  constructor(private prisma: PrismaService) {}

  private async balances(tx: any) {
    const [ledger, disbursements] = await Promise.all([
      tx.impactFundEntry.aggregate({ _sum: { contributionAmount: true } }),
      tx.impactFundDisbursement.findMany({ where: { status: { in: ['REQUESTED', 'APPROVED', 'PAID'] } }, select: { amount: true, status: true } }),
    ]);
    const accrued = ledger._sum.contributionAmount ?? 0;
    const reserved = disbursements.reduce((sum: number, row: any) => sum + row.amount, 0);
    return { accrued, reserved, available: accrued - reserved };
  }

  async list() {
    const [rows, totals] = await Promise.all([
      this.prisma.impactFundDisbursement.findMany({ orderBy: { requestedAt: 'desc' }, take: 500 }),
      this.prisma.impactFundDisbursement.groupBy({ by: ['status'], _sum: { amount: true }, _count: { _all: true } }),
    ]);
    const balance = await this.balances(this.prisma);
    return { rows, balance, totals };
  }

  async request(actorId: string, body: { amount: number; recipientName: string; recipientType?: string; purpose: string }) {
    const amount = Number(body.amount);
    const recipientName = body.recipientName?.trim();
    const purpose = body.purpose?.trim();
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new BadRequestException('DISBURSEMENT_AMOUNT_MUST_BE_A_POSITIVE_WHOLE_RWF_AMOUNT');
    if (!recipientName || recipientName.length > 160) throw new BadRequestException('RECIPIENT_NAME_REQUIRED_MAX_160_CHARACTERS');
    if (!purpose || purpose.length < 10 || purpose.length > 2000) throw new BadRequestException('PURPOSE_MUST_BE_10_TO_2000_CHARACTERS');
    const recipientType = body.recipientType || 'PROGRAM';
    if (!['PROGRAM', 'SCHOOL', 'HEALTHCARE', 'COMMUNITY', 'SUPPLIER', 'OTHER'].includes(recipientType)) throw new BadRequestException('INVALID_RECIPIENT_TYPE');

    return this.prisma.$transaction(async (tx: any) => {
      const balance = await this.balances(tx);
      if (amount > balance.available) throw new BadRequestException('INSUFFICIENT_ZIF_AVAILABLE_BALANCE');
      const row = await tx.impactFundDisbursement.create({ data: { amount, recipientName, recipientType, purpose, requestedBy: actorId, status: 'REQUESTED' } });
      await tx.auditLog.create({ data: {
        actorId, action: 'ZIF_DISBURSEMENT_REQUESTED', entityType: 'ImpactFundDisbursement', entityId: row.id,
        afterJson: JSON.stringify(row), metadataJson: JSON.stringify({ balanceBefore: balance.available, reservedAfter: balance.reserved + amount }),
      }});
      return { ...row, balanceAfterRequest: balance.available - amount };
    }, { isolationLevel: 'Serializable' });
  }

  async approve(actorId: string, id: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const before = await tx.impactFundDisbursement.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('ZIF disbursement request not found');
      if (before.status !== 'REQUESTED') throw new ConflictException('Only a requested disbursement can be approved');
      const balance = await this.balances(tx);
      if (balance.available < 0) throw new ConflictException('ZIF available balance has fallen below reserved disbursements; reconcile the ledger before approval');
      if (before.requestedBy === actorId) throw new ForbiddenException('A requester cannot approve their own disbursement');
      const after = await tx.impactFundDisbursement.update({ where: { id }, data: { status: 'APPROVED', approvedBy: actorId, approvedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId, action: 'ZIF_DISBURSEMENT_APPROVED', entityType: 'ImpactFundDisbursement', entityId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after) } });
      return after;
    }, { isolationLevel: 'Serializable' });
  }

  async reject(actorId: string, id: string, reason: string) {
    const clean = reason?.trim();
    if (!clean || clean.length < 5 || clean.length > 500) throw new BadRequestException('REJECTION_REASON_MUST_BE_5_TO_500_CHARACTERS');
    return this.prisma.$transaction(async (tx: any) => {
      const before = await tx.impactFundDisbursement.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('ZIF disbursement request not found');
      if (before.status !== 'REQUESTED') throw new ConflictException('Only a requested disbursement can be rejected');
      if (before.requestedBy === actorId) throw new ForbiddenException('A requester cannot reject their own disbursement');
      const after = await tx.impactFundDisbursement.update({ where: { id }, data: { status: 'REJECTED', rejectedBy: actorId, rejectedAt: new Date(), rejectionReason: clean } });
      await tx.auditLog.create({ data: { actorId, action: 'ZIF_DISBURSEMENT_REJECTED', entityType: 'ImpactFundDisbursement', entityId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after), metadataJson: JSON.stringify({ reason: clean }) } });
      return after;
    }, { isolationLevel: 'Serializable' });
  }

  async markPaid(actorId: string, id: string, body: { paymentMethod: string; paymentReference: string; evidenceUrl?: string }) {
    const paymentMethod = body.paymentMethod?.trim().toUpperCase();
    const paymentReference = body.paymentReference?.trim();
    if (!paymentMethod || !['BANK_TRANSFER', 'MOBILE_MONEY', 'CASH', 'CHEQUE', 'OTHER'].includes(paymentMethod)) throw new BadRequestException('VALID_PAYMENT_METHOD_REQUIRED');
    if (!paymentReference || paymentReference.length < 4 || paymentReference.length > 160) throw new BadRequestException('PAYMENT_REFERENCE_REQUIRED');
    const evidenceUrl = body.evidenceUrl?.trim();
    if (evidenceUrl && (!/^https:\/\//i.test(evidenceUrl) || evidenceUrl.length > 1000)) throw new BadRequestException('EVIDENCE_URL_MUST_BE_HTTPS');
    return this.prisma.$transaction(async (tx: any) => {
      const before = await tx.impactFundDisbursement.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('ZIF disbursement request not found');
      if (before.status !== 'APPROVED') throw new ConflictException('Only an approved disbursement can be marked paid');
      const balance = await this.balances(tx);
      if (balance.available < 0) throw new ConflictException('ZIF available balance has fallen below reserved disbursements; reconcile the ledger before recording payment');
      if (before.approvedBy === actorId) throw new ForbiddenException('The approver cannot also mark this disbursement as paid');
      const after = await tx.impactFundDisbursement.update({ where: { id }, data: { status: 'PAID', paidBy: actorId, paidAt: new Date(), paymentMethod, paymentReference, evidenceUrl } });
      await tx.auditLog.create({ data: { actorId, action: 'ZIF_DISBURSEMENT_PAID', entityType: 'ImpactFundDisbursement', entityId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after) } });
      return after;
    }, { isolationLevel: 'Serializable' });
  }
}