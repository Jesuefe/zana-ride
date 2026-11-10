import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinanceExtensionsService {
  constructor(private prisma: PrismaService) {}

  async listAdvances(staffMemberId?: string) {
    return this.prisma.salaryAdvance.findMany({ where: staffMemberId ? { staffMemberId } : {}, include: { staff: true, recoveries: { orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' }, take: 500 });
  }

  async issueAdvance(actorId: string, body: any) {
    const principalAmount = Number(body.principalAmount), monthlyDeduction = Number(body.monthlyDeduction);
    if (!body.staffMemberId || !Number.isSafeInteger(principalAmount) || principalAmount <= 0 || !Number.isSafeInteger(monthlyDeduction) || monthlyDeduction <= 0 || monthlyDeduction > principalAmount) throw new BadRequestException('VALID_STAFF_AND_ADVANCE_AMOUNTS_REQUIRED');
    const staff = await this.prisma.staffMember.findUnique({ where: { id: body.staffMemberId } });
    if (!staff || !staff.active || staff.employmentType === 'CONTRACTOR') throw new BadRequestException('ACTIVE_EMPLOYEE_REQUIRED_FOR_SALARY_ADVANCE');
    return this.prisma.$transaction(async tx => {
      const active = await tx.salaryAdvance.aggregate({ where: { staffMemberId: staff.id, status: { in: ['REQUESTED','APPROVED','ACTIVE'] } }, _sum: { outstandingAmount: true } });
      const outstanding = active._sum.outstandingAmount ?? 0;
      if (outstanding > 0 && body.allowMultiple !== true) throw new ConflictException('EMPLOYEE_HAS_AN_ACTIVE_ADVANCE; settle it or explicitly allow a second advance');
      const row = await tx.salaryAdvance.create({ data: { staffMemberId: staff.id, principalAmount, outstandingAmount: principalAmount, monthlyDeduction, status: 'REQUESTED', dueDate: body.dueDate ? new Date(body.dueDate) : undefined, note: typeof body.note === 'string' ? body.note.slice(0, 1000) : undefined, createdBy: actorId } });
      await tx.auditLog.create({ data: { actorId, action: 'SALARY_ADVANCE_REQUESTED', entityType: 'SalaryAdvance', entityId: row.id, afterJson: JSON.stringify(row) } });
      return row;
    }, { isolationLevel: 'Serializable' });
  }

  async approveAdvance(actorId: string, id: string) {
    return this.prisma.$transaction(async tx => {
      const before = await tx.salaryAdvance.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Salary advance not found');
      if (before.status !== 'REQUESTED') throw new ConflictException('Only requested advances can be approved');
      if (before.createdBy === actorId) throw new ForbiddenException('Requester cannot approve their own salary advance');
      const after = await tx.salaryAdvance.update({ where: { id }, data: { status: 'APPROVED', approvedBy: actorId, approvedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId, action: 'SALARY_ADVANCE_APPROVED', entityType: 'SalaryAdvance', entityId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after) } });
      return after;
    });
  }

  async payAdvance(actorId: string, id: string, body: any) {
    const reference = String(body.paymentReference ?? '').trim(), method = String(body.paymentMethod ?? '').trim().toUpperCase();
    if (!reference || reference.length < 4 || !['BANK','MOMO','CASH','CHEQUE','OTHER'].includes(method)) throw new BadRequestException('VALID_ADVANCE_PAYMENT_REFERENCE_AND_METHOD_REQUIRED');
    return this.prisma.$transaction(async tx => {
      const before = await tx.salaryAdvance.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Salary advance not found');
      if (before.status !== 'APPROVED') throw new ConflictException('Only approved advances can be recorded as paid');
      if (before.approvedBy === actorId) throw new ForbiddenException('Approver cannot also record advance payout');
      const after = await tx.salaryAdvance.update({ where: { id }, data: { status: 'ACTIVE', paymentReference: reference, paymentMethod: method, paidAt: new Date() } });
      await tx.auditLog.create({ data: { actorId, action: 'SALARY_ADVANCE_PAID', entityType: 'SalaryAdvance', entityId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after) } });
      return after;
    });
  }

  async cancelAdvance(actorId: string, id: string, reason: string) {
    if (!reason?.trim() || reason.trim().length < 5) throw new BadRequestException('CANCELLATION_REASON_REQUIRED');
    return this.prisma.$transaction(async tx => {
      const before = await tx.salaryAdvance.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Salary advance not found');
      if (!['REQUESTED','APPROVED'].includes(before.status) || before.outstandingAmount !== before.principalAmount || before.paidAt) throw new ConflictException('Only an unpaid requested or approved advance can be cancelled');
      const after = await tx.salaryAdvance.update({ where: { id }, data: { status: 'CANCELLED' } });
      await tx.auditLog.create({ data: { actorId, action: 'SALARY_ADVANCE_CANCELLED', entityType: 'SalaryAdvance', entityId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after), metadataJson: JSON.stringify({ reason: reason.trim() }) } });
      return after;
    });
  }

  async listContractorInvoices(status?: string) {
    return this.prisma.contractorInvoice.findMany({ where: status ? { status } : {}, orderBy: { invoiceDate: 'desc' }, take: 500 });
  }

  async createContractorInvoice(actorId: string, body: any) {
    const grossAmount = Number(body.grossAmount), withholdingRate = Number(body.withholdingRate);
    const contractorName = String(body.contractorName ?? '').trim(), invoiceNumber = String(body.invoiceNumber ?? '').trim();
    const invoiceDate = new Date(body.invoiceDate);
    if (!contractorName || contractorName.length > 160 || !invoiceNumber || invoiceNumber.length > 100 || !String(body.description ?? '').trim() || Number.isNaN(invoiceDate.getTime())) throw new BadRequestException('CONTRACTOR_NAME_INVOICE_NUMBER_AND_VALID_DATE_REQUIRED');
    if (!Number.isSafeInteger(grossAmount) || grossAmount <= 0 || body.withholdingRate === undefined || body.withholdingRate === null || !Number.isFinite(withholdingRate) || withholdingRate < 0 || withholdingRate > 100) throw new BadRequestException('VALID_GROSS_AMOUNT_AND_WITHHOLDING_RATE_REQUIRED');
    if (body.staffMemberId) {
      const staff = await this.prisma.staffMember.findUnique({ where: { id: body.staffMemberId } });
      if (!staff || staff.employmentType !== 'CONTRACTOR') throw new BadRequestException('LINKED_STAFF_MEMBER_MUST_BE_A_CONTRACTOR');
    }
    const withholdingAmount = Math.round(grossAmount * withholdingRate / 100);
    const netPayable = grossAmount - withholdingAmount;
    if (body.dueDate && Number.isNaN(new Date(body.dueDate).getTime())) throw new BadRequestException('INVALID_DUE_DATE');
    try {
      const row = await this.prisma.contractorInvoice.create({ data: { contractorName, invoiceNumber, invoiceDate, dueDate: body.dueDate ? new Date(body.dueDate) : undefined, description: String(body.description ?? '').trim().slice(0, 2000), grossAmount, withholdingRate, withholdingAmount, netPayable, staffMemberId: body.staffMemberId || undefined, createdBy: actorId } });
      await this.prisma.auditLog.create({ data: { actorId, action: 'CONTRACTOR_INVOICE_SUBMITTED', entityType: 'ContractorInvoice', entityId: row.id, afterJson: JSON.stringify(row) } });
      return row;
    } catch (e: any) { if (e?.code === 'P2002') throw new ConflictException('CONTRACTOR_INVOICE_NUMBER_ALREADY_EXISTS'); throw e; }
  }

  async reviewContractorInvoice(actorId: string, id: string, approve: boolean, reason?: string) {
    if (!approve && (!reason?.trim() || reason.trim().length < 5)) throw new BadRequestException('REJECTION_REASON_REQUIRED');
    return this.prisma.$transaction(async tx => {
      const before = await tx.contractorInvoice.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Contractor invoice not found');
      if (before.status !== 'SUBMITTED') throw new ConflictException('Only submitted contractor invoices can be reviewed');
      if (before.createdBy === actorId) throw new ForbiddenException('Invoice creator cannot review their own invoice');
      const after = await tx.contractorInvoice.update({ where: { id }, data: { status: approve ? 'APPROVED' : 'REJECTED', reviewedBy: actorId, reviewedAt: new Date(), ...(approve ? {} : { description: `${before.description}\nRejected: ${reason!.trim()}`.slice(0, 2000) }) } });
      await tx.auditLog.create({ data: { actorId, action: approve ? 'CONTRACTOR_INVOICE_APPROVED' : 'CONTRACTOR_INVOICE_REJECTED', entityType: 'ContractorInvoice', entityId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after) } });
      return after;
    });
  }

  async payContractorInvoice(actorId: string, id: string, body: any) {
    const amount = Number(body.amount), reference = String(body.paymentReference ?? '').trim(), method = String(body.paymentMethod ?? '').trim().toUpperCase();
    if (!Number.isSafeInteger(amount) || amount <= 0 || !reference || reference.length < 4 || !['BANK','MOMO','CASH','CHEQUE','OTHER'].includes(method)) throw new BadRequestException('VALID_PAYMENT_AMOUNT_REFERENCE_AND_METHOD_REQUIRED');
    return this.prisma.$transaction(async tx => {
      const before = await tx.contractorInvoice.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Contractor invoice not found');
      if (!['APPROVED','PARTIALLY_PAID'].includes(before.status)) throw new ConflictException('Only approved unpaid invoices can be paid');
      if (before.reviewedBy === actorId) throw new ForbiddenException('Invoice reviewer cannot also record its payment');
      const alreadyPaid = before.amountPaid ?? 0;
      if (alreadyPaid + amount > before.netPayable) throw new BadRequestException('PAYMENT_EXCEEDS_NET_PAYABLE');
      // Payments are recorded in immutable audit metadata; aggregate is stored in the invoice status/reference fields.
      const full = alreadyPaid + amount === before.netPayable;
      const after = await tx.contractorInvoice.update({ where: { id }, data: { amountPaid: alreadyPaid + amount, status: full ? 'PAID' : 'PARTIALLY_PAID', paymentReference: reference, paymentMethod: method, paidAt: full ? new Date() : null } });
      await tx.auditLog.create({ data: { actorId, action: 'CONTRACTOR_INVOICE_PAYMENT_RECORDED', entityType: 'ContractorInvoice', entityId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after), metadataJson: JSON.stringify({ amount, cumulativePaid: alreadyPaid + amount, outstanding: before.netPayable - alreadyPaid - amount }) } });
      return { ...after, amountPaid: alreadyPaid + amount, outstanding: before.netPayable - alreadyPaid - amount };
    }, { isolationLevel: 'Serializable' });
  }

  async listRemittances(period?: string) {
    return this.prisma.statutoryRemittance.findMany({ where: period ? { period } : {}, orderBy: [{ period: 'desc' }, { obligationType: 'asc' }], take: 500 });
  }

  async generatePayrollRemittances(actorId: string, period: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException('PERIOD_MUST_BE_YYYY_MM');
    const run = await this.prisma.payrollRun.findUnique({ where: { month: period }, include: { lines: true } });
    if (run && !['APPROVED','PARTIALLY_PAID','PAID'].includes(run.status)) throw new BadRequestException('PAYROLL_RUN_MUST_BE_APPROVED_BEFORE_REMITTANCE_GENERATION');
    const invoiceStart = new Date(`${period}-01T00:00:00+02:00`);
    const invoiceEnd = new Date(invoiceStart.getTime()); invoiceEnd.setUTCMonth(invoiceEnd.getUTCMonth() + 1);
    const contractorInvoices = await this.prisma.contractorInvoice.findMany({ where: { invoiceDate: { gte: invoiceStart, lt: invoiceEnd }, status: { in: ['APPROVED','PARTIALLY_PAID','PAID'] } } });
    if (!run && contractorInvoices.length === 0) throw new BadRequestException('APPROVED_PAYROLL_OR_CONTRACTOR_INVOICES_REQUIRED');
    const payrollLines = run?.lines ?? [];
    const types: Record<string, number> = {
      CONTRACTOR_WITHHOLDING: contractorInvoices.reduce((sum, invoice) => sum + invoice.withholdingAmount, 0),
      PAYE: payrollLines.reduce((s, x) => s + x.paye, 0),
      PENSION_EMPLOYEE: payrollLines.reduce((s, x) => s + x.employeePension, 0),
      PENSION_EMPLOYER: payrollLines.reduce((s, x) => s + x.employerPension, 0),
      OCCUPATIONAL_HAZARDS: payrollLines.reduce((s, x) => s + x.employerOccupational, 0),
      MATERNITY_EMPLOYEE: payrollLines.reduce((s, x) => s + x.employeeMaternity, 0),
      MATERNITY_EMPLOYER: payrollLines.reduce((s, x) => s + x.employerMaternity, 0),
      CBHI: payrollLines.reduce((s, x) => s + x.cbhi, 0),
    };
    return this.prisma.$transaction(async tx => {
      const result: any[] = [];
      for (const [obligationType, amount] of Object.entries(types)) {
        if (amount <= 0) continue;
        const row = await tx.statutoryRemittance.upsert({ where: { period_obligationType: { period, obligationType } }, create: { period, obligationType, amount, sourcePayrollRunId: run?.id, createdBy: actorId, notes: 'Generated from approved payroll. Verify current filing classification and amount with accountant.' }, update: {} });
        result.push(row);
      }
      await tx.auditLog.create({ data: { actorId, action: 'STATUTORY_REMITTANCES_GENERATED', entityType: 'PayrollRun', entityId: run?.id ?? period, metadataJson: JSON.stringify({ period, types }) } });
      return result;
    }, { isolationLevel: 'Serializable' });
  }

  async approveRemittance(actorId: string, id: string) {
    return this.prisma.$transaction(async tx => {
      const before = await tx.statutoryRemittance.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Statutory remittance not found');
      if (before.status !== 'DRAFT') throw new ConflictException('Only draft remittances can be approved');
      if (before.createdBy === actorId) throw new ForbiddenException('Creator cannot approve their own remittance');
      const after = await tx.statutoryRemittance.update({ where: { id }, data: { status: 'APPROVED', approvedBy: actorId, approvedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId, action: 'STATUTORY_REMITTANCE_APPROVED', entityType: 'StatutoryRemittance', entityId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after) } });
      return after;
    });
  }

  async payRemittance(actorId: string, id: string, body: any) {
    const reference = String(body.paymentReference ?? '').trim(), method = String(body.paymentMethod ?? '').trim().toUpperCase();
    if (!reference || reference.length < 4 || !['BANK','MOMO','CASH','CHEQUE','OTHER'].includes(method)) throw new BadRequestException('VALID_PAYMENT_REFERENCE_AND_METHOD_REQUIRED');
    if (body.evidenceUrl && !/^https:\/\//i.test(body.evidenceUrl)) throw new BadRequestException('EVIDENCE_URL_MUST_BE_HTTPS');
    return this.prisma.$transaction(async tx => {
      const before = await tx.statutoryRemittance.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Statutory remittance not found');
      if (before.status !== 'APPROVED') throw new ConflictException('Only approved remittances can be marked paid');
      if (before.approvedBy === actorId) throw new ForbiddenException('Approver cannot record the payment');
      const after = await tx.statutoryRemittance.update({ where: { id }, data: { status: 'PAID', paymentReference: reference, paymentMethod: method, paidAt: new Date(), evidenceUrl: body.evidenceUrl || undefined } });
      await tx.auditLog.create({ data: { actorId, action: 'STATUTORY_REMITTANCE_PAID', entityType: 'StatutoryRemittance', entityId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after) } });
      return after;
    });
  }
}

[executed on device: vmi3250959 (aae32ee4-934a-4390-a92f-29b405a66623)]