import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { calculateMonthlyZifContribution } from '../finance/monthly-profit.util';
import { calculateRwandaPayroll } from '../finance/rwanda-payroll.util';

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService) {}

  private async assertFinancialPeriodOpen(tx: any, date: Date) {
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali', year: 'numeric', month: '2-digit' }).format(date);
    const closed = await tx.impactFundEntry.findUnique({ where: { idempotencyKey: `MONTHLY_NET_PROFIT:${month}` } });
    if (closed) throw new BadRequestException(`FINANCIAL_PERIOD_CLOSED:${month}; this release does not support reopening closed months. Use a separately approved current-period adjustment.`);
  }

  // ─── EXPENSES ──────────────────────────────────────────────────────────

  async createExpense(data: { title?: string; description?: string; amount: number; category: string; vendor?: string; invoiceNumber?: string; dueDate?: string; date?: string; paymentReference?: string; paymentStatus?: string; amountPaid?: number }, actorId?: string) {
    const title = (data.title ?? data.description ?? '').trim();
    const amount = Number(data.amount);
    if (!title) throw new BadRequestException('EXPENSE_TITLE_REQUIRED');
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new BadRequestException('EXPENSE_AMOUNT_MUST_BE_POSITIVE_RWF');
    if (!data.category?.trim()) throw new BadRequestException('EXPENSE_CATEGORY_REQUIRED');
    if (['SALARY', 'SALARIES', 'PAYROLL'].includes(data.category.trim().toUpperCase())) throw new BadRequestException('Record employee pay through Staff & Payroll to prevent duplicate salary expenses.');
    const date = data.date ? new Date(data.date) : new Date();
    const dueDate = data.dueDate ? new Date(data.dueDate) : undefined;
    if (Number.isNaN(date.getTime()) || (dueDate && Number.isNaN(dueDate.getTime()))) throw new BadRequestException('INVALID_EXPENSE_DATE');
    const amountPaid = Number(data.amountPaid ?? 0);
    if (!Number.isSafeInteger(amountPaid) || amountPaid !== 0) throw new BadRequestException('EXPENSE_MUST_BE_APPROVED_BEFORE_PAYMENT');
    const paymentStatus = 'UNPAID';
    return this.prisma.$transaction(async tx => {
      await this.assertFinancialPeriodOpen(tx, date);
      const expense = await tx.expense.create({ data: { title, amount, category: data.category.trim().toUpperCase(), description: data.description, vendor: data.vendor?.trim(), invoiceNumber: data.invoiceNumber?.trim(), paymentReference: data.paymentReference?.trim(), amountPaid, paymentStatus, status: 'PENDING', paidAt: undefined, date, dueDate } });
      await tx.auditLog.create({ data: { actorId, action: 'EXPENSE_CREATED', entityType: 'Expense', entityId: expense.id, afterJson: JSON.stringify(expense) } });
      return expense;
    });
  }

  async updateExpensePayment(id: string, amountPaid: number, paymentReference?: string, actorId?: string) {
    if (!Number.isSafeInteger(amountPaid) || amountPaid < 0) throw new BadRequestException('AMOUNT_PAID_MUST_BE_A_NON_NEGATIVE_RWF_INTEGER');
    return this.prisma.$transaction(async tx => {
      const before = await tx.expense.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Expense not found');
      if (before.status !== 'APPROVED') throw new BadRequestException('Only an approved expense can receive a payment.');
      if (amountPaid < before.amountPaid) throw new BadRequestException('RECORDED_EXPENSE_PAYMENTS_CANNOT_BE_REDUCED; USE_A_SEPARATE_REFUND_ADJUSTMENT');
      if (amountPaid > before.amount) throw new BadRequestException('AMOUNT_PAID_CANNOT_EXCEED_EXPENSE_TOTAL');
      const paymentStatus = amountPaid >= before.amount ? 'PAID' : amountPaid > 0 ? 'PARTIAL' : 'UNPAID';
      const after = await tx.expense.update({ where: { id }, data: { amountPaid, paymentStatus, paymentReference: paymentReference?.trim() || before.paymentReference, paidAt: paymentStatus === 'PAID' ? new Date() : null } });
      await tx.auditLog.create({ data: { actorId, action: 'EXPENSE_PAYMENT_UPDATED', entityType: 'Expense', entityId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after) } });
      return after;
    });
  }

  async getExpenses(from?: string, to?: string) {
    const where: any = {};
    if (from || to) where.date = { ...(from ? { gte: new Date(`${from}T00:00:00+02:00`) } : {}), ...(to ? { lt: new Date(new Date(`${to}T00:00:00+02:00`).getTime() + 86400000) } : {}) };
    return this.prisma.expense.findMany({ where, orderBy: { date: 'desc' }, take: 500 });
  }

  async approveExpense(id: string, actorId?: string) {
    return this.prisma.$transaction(async tx => {
      const before = await tx.expense.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Expense not found');
      if (before.status !== 'PENDING') throw new BadRequestException('Only pending expenses can be approved.');
      await this.assertFinancialPeriodOpen(tx, before.date);
      const after = await tx.expense.update({ where: { id }, data: { status: 'APPROVED' } });
      await tx.auditLog.create({ data: { actorId, action: 'EXPENSE_APPROVED', entityType: 'Expense', entityId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after) } });
      return after;
    });
  }

  async voidExpense(id: string, reason: string, actorId?: string) {
    if (!reason?.trim() || reason.trim().length < 5) throw new BadRequestException('A void reason of at least 5 characters is required');
    return this.prisma.$transaction(async tx => {
      const before = await tx.expense.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Expense not found');
      if (before.voidedAt) return before;
      await this.assertFinancialPeriodOpen(tx, before.date);
      if (before.amountPaid > 0) throw new BadRequestException('A paid or partially paid expense cannot be voided. Record a refund/credit adjustment instead.');
      const after = await tx.expense.update({ where: { id }, data: { status: 'VOID', voidedAt: new Date(), voidReason: reason.trim() } });
      await tx.auditLog.create({ data: { actorId, action: 'EXPENSE_VOIDED', entityType: 'Expense', entityId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after), metadataJson: JSON.stringify({ reason: reason.trim() }) } });
      return after;
    });
  }

  async getAccountingLedger(limit = 500) {
    const take = Math.min(Math.max(limit, 50), 1000);
    const [wallet, commissions, debts, debtSettlements, merchantSettlements, agentSettlements, expenses, salaryPayments, impactEntries, impactDisbursements, trips, deliveries, orders] = await Promise.all([
      this.prisma.walletTransaction.findMany({ take, orderBy: { createdAt: 'desc' }, include: { wallet: { select: { user: { select: { firstName: true, lastName: true, phone: true, role: true } } } } } }),
      this.prisma.commission.findMany({ take, orderBy: { createdAt: 'desc' } }),
      this.prisma.commissionDebt.findMany({ take, orderBy: { createdAt: 'desc' } }),
      this.prisma.debtSettlement.findMany({ take, orderBy: { createdAt: 'desc' } }),
      this.prisma.merchantSettlement.findMany({ take, orderBy: { createdAt: 'desc' } }),
      this.prisma.agentSettlement.findMany({ take, orderBy: { createdAt: 'desc' } }),
      this.prisma.expense.findMany({ where: { status: { not: 'VOID' } }, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.salaryPayment.findMany({ take, orderBy: { createdAt: 'desc' }, include: { staff: { select: { name: true } } } }),
      this.prisma.impactFundEntry.findMany({ take, orderBy: { createdAt: 'desc' } }),
      this.prisma.impactFundDisbursement.findMany({ take, orderBy: { createdAt: 'desc' } }),
      this.prisma.trip.findMany({ where: { status: 'RIDE_COMPLETED' }, take, orderBy: { completedAt: 'desc' }, select: { id: true, finalFare: true, estimatedFare: true, paymentMethod: true, serviceType: true, completedAt: true } }),
      this.prisma.delivery.findMany({ where: { status: 'DELIVERED' }, take, orderBy: { deliveredAt: 'desc' }, select: { id: true, fee: true, paymentMethod: true, deliveredAt: true } }),
      this.prisma.order.findMany({ take, orderBy: { createdAt: 'desc' }, select: { id: true, total: true, deliveryFee: true, status: true, paid: true, paymentMethod: true, createdAt: true } }),
    ]);

    const rows = [
      ...wallet.map(t => ({ at: t.createdAt, type: 'WALLET_TRANSACTION', direction: t.amount >= 0 ? 'CREDIT' : 'DEBIT', amount: t.amount, reference: t.reference, status: t.status, entityId: t.id, description: t.description, account: t.wallet.user?.phone })),
      ...commissions.map(t => ({ at: t.createdAt, type: 'ZANA_COMMISSION', direction: 'CREDIT', amount: t.amount, reference: t.tripId ? `TRIP:${t.tripId}` : `DELIVERY:${t.deliveryId}`, status: 'RECORDED', entityId: t.id, description: `Commission ${t.ratePercent}%`, account: 'ZANA' })),
      ...debts.map(t => ({ at: t.createdAt, type: 'DRIVER_COMMISSION_DEBT', direction: 'RECEIVABLE', amount: t.amount, reference: t.tripId ? `TRIP:${t.tripId}` : `DELIVERY:${t.deliveryId ?? ''}`, status: t.paidAt ? 'PAID' : 'OUTSTANDING', entityId: t.id, description: `Driver commission debt`, account: t.driverId })),
      ...debtSettlements.map(t => ({ at: t.createdAt, type: 'DEBT_SETTLEMENT', direction: 'CREDIT', amount: t.amount, reference: t.providerRef, status: t.status, entityId: t.id, description: 'Driver debt settlement', account: t.driverId })),
      ...merchantSettlements.map(t => ({ at: t.createdAt, type: 'MERCHANT_SETTLEMENT', direction: 'PAYABLE', amount: t.merchantNet, reference: `ORDER:${t.orderId}`, status: t.status, entityId: t.id, description: `Merchant settlement after ${t.commissionRate}% commission`, account: t.merchantId })),
      ...agentSettlements.map(t => ({ at: t.createdAt, type: 'AGENT_SETTLEMENT', direction: 'PAYABLE', amount: t.agentEarning, reference: `ORDER:${t.orderId}`, status: t.status, entityId: t.id, description: `Agent markup share ${t.agentRate ?? 0}%`, account: t.agentId })),
      ...expenses.map(t => ({ at: t.createdAt, type: 'EXPENSE', direction: 'EXPENSE', amount: t.amount, reference: t.id, status: t.paymentStatus, entityId: t.id, description: t.title, account: t.category })),
      ...salaryPayments.map(t => ({ at: t.createdAt, type: 'SALARY_PAYMENT', direction: 'CASH_OUT', amount: t.amount, reference: t.paymentReference ?? `PAYROLL:${t.month}`, status: t.paid ? 'FULLY_PAID' : 'PARTIAL_PAYMENT', entityId: t.id, description: `Salary payment for ${t.month}`, account: t.staff.name })),
      ...impactEntries.map(t => ({ at: t.createdAt, type: 'ZIF_LEDGER', direction: t.contributionAmount >= 0 ? 'RESERVED' : 'REVERSAL', amount: t.contributionAmount, reference: `${t.sourceType}:${t.sourceId}`, status: t.status, entityId: t.id, description: t.description ?? `ZIF ${t.eventType.toLowerCase()}`, account: 'ZANA IMPACT FUND' })),
      ...impactDisbursements.map(t => ({ at: t.paidAt ?? t.requestedAt, type: 'ZIF_DISBURSEMENT', direction: 'CASH_OUT', amount: t.amount, reference: t.paymentReference ?? `ZIF-REQUEST:${t.id}`, status: t.status, entityId: t.id, description: `ZIF payout to ${t.recipientName}: ${t.purpose}`, account: 'ZANA IMPACT FUND' })),
      ...trips.map(t => ({ at: t.completedAt ?? new Date(), type: 'RIDE_GMV', direction: 'GROSS', amount: t.finalFare ?? t.estimatedFare, reference: `TRIP:${t.id}`, status: 'COMPLETED', entityId: t.id, description: `${t.serviceType} ${t.paymentMethod}`, account: 'RIDES' })),
      ...deliveries.map(t => ({ at: t.deliveredAt ?? new Date(), type: 'DELIVERY_GMV', direction: 'GROSS', amount: t.fee, reference: `DELIVERY:${t.id}`, status: 'DELIVERED', entityId: t.id, description: t.paymentMethod, account: 'DELIVERIES' })),
      ...orders.map(t => ({ at: t.createdAt, type: 'ORDER', direction: 'GROSS', amount: t.total + t.deliveryFee, reference: `ORDER:${t.id}`, status: t.status, entityId: t.id, description: `${t.paymentMethod} · ${t.paid ? 'PAID' : 'UNPAID'}`, account: 'MARKETPLACE' })),
    ].sort((a,b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, take);

    const sum = (items: any[]) => items.reduce((s, x) => s + x.amount, 0);
    const rideGmv = trips.reduce((s,t)=>s+(t.finalFare ?? t.estimatedFare),0);
    const deliveryGmv = deliveries.reduce((s,t)=>s+t.fee,0);
    const orderGmv = orders.filter(o=>o.status !== 'CANCELLED').reduce((s,o)=>s+o.total+o.deliveryFee,0);
    const commissionTotal = commissions.reduce((s,t)=>s+t.amount,0);
    const outstandingDebt = debts.filter(d=>!d.paidAt).reduce((s,t)=>s+t.amount,0);
    const expensesTotal = expenses.reduce((s,t)=>s+t.amount,0);
    return {
      generatedAt: new Date(),
      totals: { rideGmv, deliveryGmv, marketplaceGmv: orderGmv, gmv: rideGmv + deliveryGmv + orderGmv, commission: commissionTotal, outstandingDriverDebt: outstandingDebt, expenses: expensesTotal },
      counts: { rides: trips.length, deliveries: deliveries.length, orders: orders.length, salaryPayments: salaryPayments.length, impactFundEntries: impactEntries.length, impactFundDisbursements: impactDisbursements.length, ledgerRows: rows.length },
      rows,
    };
  }

  async getExpenseSummary() {
    const expenses = await this.prisma.expense.findMany({ where: { status: { not: 'VOID' } } });
    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
      total += e.amount;
    }
    return { total, byCategory };
  }

  // ─── STAFF & SALARY ────────────────────────────────────────────────────

  async createStaff(data: { name: string; role: string; accessRole?: string; phone: string; email?: string; password: string; salary: number; startDate?: Date; department?: string; employmentType?: string }, actorId?: string) {
    if (!data.phone?.trim()) throw new BadRequestException('STAFF_PHONE_REQUIRED');
    if (!data.password || data.password.length < 8) throw new BadRequestException('STAFF_PASSWORD_TOO_SHORT');
    if (!Number.isSafeInteger(Number(data.salary)) || Number(data.salary) <= 0) throw new BadRequestException('STAFF_MONTHLY_SALARY_MUST_BE_POSITIVE_RWF');
    if (data.employmentType && !['EMPLOYEE', 'CONTRACTOR'].includes(data.employmentType)) throw new BadRequestException('INVALID_EMPLOYMENT_TYPE');
    if (data.accessRole && !['OPERATIONS', 'DRIVER_OPERATIONS', 'MARKET_OPERATIONS', 'CUSTOMER_SUPPORT', 'FINANCE'].includes(data.accessRole)) throw new BadRequestException('INVALID_STAFF_ACCESS_ROLE');
    const phone = data.phone.trim();
    const email = data.email?.trim() || undefined;
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ phone }, ...(email ? [{ email }] : [])] } });
    if (existing) throw new ConflictException('A user with that phone or email already exists');
    const passwordHash = await bcrypt.hash(data.password, 12);
    return this.prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          phone,
          email,
          password: passwordHash,
          firstName: data.name,
          role: 'STAFF',
          status: 'ACTIVE',
          phoneVerified: true,
        },
      });
      const staff = await tx.staffMember.create({
        data: {
          userId: user.id,
          name: data.name,
          role: data.role,
          accessRole: data.accessRole || 'OPERATIONS',
          phone,
          email,
          salary: Number(data.salary) || 0,
          department: data.department?.trim(),
          employmentType: data.employmentType || 'EMPLOYEE',
          startDate: data.startDate,
        },
      });
      await tx.staffSalaryHistory.create({ data: { staffMemberId: staff.id, baseSalary: staff.salary, effectiveFrom: staff.startDate } });
      await tx.auditLog.create({ data: { actorId, action: 'STAFF_MEMBER_CREATED', entityType: 'StaffMember', entityId: staff.id, afterJson: JSON.stringify({ ...staff, userId: user.id }) } });
      return { ...staff, user: { id: user.id, phone: user.phone, email: user.email, role: user.role } };
    });
  }

  async getStaff(month?: string) {
    const staff = await this.prisma.staffMember.findMany({
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 3 }, salaryHistory: { orderBy: { effectiveFrom: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    if (!month) return staff;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('PAYROLL_MONTH_MUST_BE_YYYY_MM');
    return staff.map(member => ({ ...member, payrollAmount: this.calculateStaffSalaryForMonth(member, month) }));
  }

  async updateStaff(id: string, data: Partial<{ name: string; role: string; accessRole: string; salary: number; active: boolean; department: string; employmentType: string }>, actorId?: string) {
    const before = await this.prisma.staffMember.findUnique({ where: { id }, include: { user: true } });
    if (!before) throw new NotFoundException('Staff member not found');
    const update: any = {};
    for (const key of ['name', 'role', 'accessRole', 'salary', 'active', 'department', 'employmentType']) if ((data as any)[key] !== undefined) update[key] = key === 'salary' ? Number((data as any)[key]) : (data as any)[key];
    if (update.salary !== undefined && (!Number.isSafeInteger(update.salary) || update.salary <= 0)) throw new BadRequestException('STAFF_MONTHLY_SALARY_MUST_BE_POSITIVE_RWF');
    if (update.employmentType !== undefined && !['EMPLOYEE', 'CONTRACTOR'].includes(update.employmentType)) throw new BadRequestException('INVALID_EMPLOYMENT_TYPE');
    if (update.accessRole !== undefined && !['OPERATIONS', 'DRIVER_OPERATIONS', 'MARKET_OPERATIONS', 'CUSTOMER_SUPPORT', 'FINANCE'].includes(update.accessRole)) throw new BadRequestException('INVALID_STAFF_ACCESS_ROLE');
    if (update.active === false && before.active && !before.endDate) update.endDate = new Date();
    if (update.active === true && !before.active) throw new BadRequestException('Reactivating former staff is not supported by this payroll history version. Create a new employment record through the HR rehire workflow.');
    const result = await this.prisma.$transaction(async tx => {
      const staff = await tx.staffMember.update({ where: { id }, data: update });
      if (update.salary !== undefined && Number(update.salary) !== before.salary) await tx.staffSalaryHistory.create({ data: { staffMemberId: id, baseSalary: Number(update.salary), effectiveFrom: new Date() } });
      if (update.active !== undefined && before.userId) await tx.user.update({ where: { id: before.userId }, data: { status: update.active ? 'ACTIVE' : 'SUSPENDED' } });
      return staff;
    });
    await this.prisma.auditLog.create({ data: { actorId, action: 'STAFF_SECURITY_UPDATED', entityType: 'StaffMember', entityId: id, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(result) } }).catch(() => {});
    return result;
  }

  private kigaliDayStart(value: Date): Date {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
    const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
    return new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00+02:00`);
  }

  private calculateStaffSalaryForMonth(staff: any, month: string): number {
    const start = new Date(`${month}-01T00:00:00+02:00`);
    const end = new Date(start.getTime());
    end.setUTCMonth(end.getUTCMonth() + 1);
    if (staff.startDate >= end || (!staff.active && (!staff.endDate || staff.endDate < start))) return 0;
    const dayMs = 86400000;
    const daysInMonth = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs));
    const history = staff.salaryHistory?.length ? staff.salaryHistory : [{ baseSalary: staff.salary, effectiveFrom: staff.startDate }];
    const employmentStart = Math.max(start.getTime(), this.kigaliDayStart(staff.startDate).getTime());
    const employmentEnd = staff.endDate ? Math.min(end.getTime(), this.kigaliDayStart(staff.endDate).getTime() + dayMs) : end.getTime();
    return history.reduce((total: number, row: any, index: number) => {
      const nextChange = history[index + 1]?.effectiveFrom ? this.kigaliDayStart(history[index + 1].effectiveFrom).getTime() : end.getTime();
      const activeFrom = Math.max(employmentStart, this.kigaliDayStart(row.effectiveFrom).getTime());
      const activeTo = Math.min(employmentEnd, nextChange);
      const activeDays = Math.max(0, Math.round((activeTo - activeFrom) / dayMs));
      return total + Math.round(row.baseSalary * activeDays / daysInMonth);
    }, 0);
  }


  async getPayrollRun(month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('PAYROLL_MONTH_MUST_BE_YYYY_MM');
    return this.prisma.payrollRun.findUnique({
      where: { month },
      include: { lines: { include: { staff: true, payments: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'asc' } } },
    });
  }

  async createPayrollRun(month: string, adjustments: Array<any> = [], actorId?: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('PAYROLL_MONTH_MUST_BE_YYYY_MM');
    if (!Array.isArray(adjustments)) throw new BadRequestException('PAYROLL_ADJUSTMENTS_MUST_BE_AN_ARRAY');
    const existing = await this.prisma.payrollRun.findUnique({ where: { month } });
    if (existing) throw new ConflictException('A payroll run already exists for ' + month + '.');
    const preview = await this.getPayrollPreview(month);
    const adjustmentMap = new Map<string, any>();
    for (const item of adjustments) {
      if (!item?.staffMemberId || adjustmentMap.has(item.staffMemberId)) throw new BadRequestException('PAYROLL_ADJUSTMENT_STAFF_ID_INVALID_OR_DUPLICATED');
      const values = ['taxableAllowances', 'nonTaxableAllowances', 'pensionableAllowances', 'bonus', 'otherDeductions', 'advanceDeduction'];
      const clean: any = {};
      for (const key of values) {
        const value = Number(item[key] ?? 0);
        if (!Number.isSafeInteger(value) || value < 0) throw new BadRequestException(key + ' must be a non-negative whole RWF amount');
        clean[key] = value;
      }
      adjustmentMap.set(item.staffMemberId, clean);
    }
    const employeeLines = preview.lines.filter(line => line.employmentType !== 'CONTRACTOR');
    const previewIds = new Set(employeeLines.map(line => line.staffMemberId));
    for (const id of adjustmentMap.keys()) if (!previewIds.has(id)) throw new BadRequestException('ADJUSTMENT_REFERENCES_STAFF_OUTSIDE_THIS_PAYROLL');
    if (!employeeLines.length) throw new BadRequestException('NO_EMPLOYEE_PAYROLL_LINES_TO_PROCESS');
    const prepared = employeeLines.map(line => {
      const a = adjustmentMap.get(line.staffMemberId) ?? {};
      let statutory: any;
      try {
        statutory = calculateRwandaPayroll({
          month, baseSalary: line.gross,
          taxableAllowances: a.taxableAllowances ?? 0,
          nonTaxableAllowances: a.nonTaxableAllowances ?? 0,
          pensionableAllowances: a.pensionableAllowances ?? 0,
          bonus: a.bonus ?? 0,
        });
      } catch (error: any) { throw new BadRequestException(error.message || 'PAYROLL_CALCULATION_FAILED'); }
      const extraDeductions = (a.otherDeductions ?? 0) + (a.advanceDeduction ?? 0);
      const netPay = statutory.netPay - extraDeductions;
      if (netPay < 0) throw new BadRequestException('PAYROLL_NET_PAY_CANNOT_BE_NEGATIVE:' + line.staffMemberId);
      const snapshot = {
        month, currency: 'RWF', staffMemberId: line.staffMemberId, name: line.name,
        employmentType: line.employmentType, baseSalary: line.gross, ...a,
        ...statutory, otherDeductions: a.otherDeductions ?? 0,
        advanceDeduction: a.advanceDeduction ?? 0,
        totalDeductions: statutory.employeeDeductions + extraDeductions,
        netPay, generatedAt: new Date().toISOString(),
      };
      return {
        staffMemberId: line.staffMemberId, baseSalary: line.gross,
        taxableAllowances: a.taxableAllowances ?? 0, nonTaxableAllowances: a.nonTaxableAllowances ?? 0,
        pensionableAllowances: a.pensionableAllowances ?? 0, bonus: a.bonus ?? 0,
        otherDeductions: a.otherDeductions ?? 0, advanceDeduction: a.advanceDeduction ?? 0,
        taxableGross: statutory.taxableGross, pensionableGross: statutory.pensionableGross,
        paye: statutory.paye, employeePension: statutory.employeePension,
        employerPension: statutory.employerPension, employerOccupational: statutory.employerOccupationalHazards,
        employeeMaternity: statutory.employeeMaternity, employerMaternity: statutory.employerMaternity,
        cbhi: statutory.cbhi, employeeDeductions: statutory.employeeDeductions + extraDeductions,
        netPay, employerStatutoryCost: statutory.employerStatutoryCost,
        totalEmployerCost: statutory.totalEmployerCost, payslipSnapshot: JSON.stringify(snapshot),
      };
    });
    const totals = prepared.reduce((sum, line) => ({
      gross: sum.gross + line.taxableGross + line.nonTaxableAllowances,
      net: sum.net + line.netPay,
      employeeDeductions: sum.employeeDeductions + line.employeeDeductions,
      employerStatutory: sum.employerStatutory + line.employerStatutoryCost,
      employerCost: sum.employerCost + line.totalEmployerCost,
    }), { gross: 0, net: 0, employeeDeductions: 0, employerStatutory: 0, employerCost: 0 });
    try {
      return await this.prisma.$transaction(async tx => {
        const run = await tx.payrollRun.create({
          data: {
            month, status: 'DRAFT', createdBy: actorId,
            totalGross: totals.gross, totalNetPay: totals.net,
            totalEmployeeDeductions: totals.employeeDeductions,
            totalEmployerStatutory: totals.employerStatutory, totalEmployerCost: totals.employerCost,
            lines: { create: prepared },
          },
          include: { lines: { include: { staff: true } } },
        });
        await tx.auditLog.create({ data: {
          actorId, action: 'PAYROLL_RUN_CREATED', entityType: 'PayrollRun', entityId: run.id,
          afterJson: JSON.stringify({ month, status: run.status, lineCount: prepared.length, totals }),
        }});
        return run;
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('A payroll run already exists for ' + month + '.');
      throw error;
    }
  }

  async discardDraftPayrollRun(id: string, reason: string, actorId?: string) {
    const cleanReason = reason?.trim();
    if (!cleanReason || cleanReason.length < 8 || cleanReason.length > 500) throw new BadRequestException('A reason of 8 to 500 characters is required to discard a draft payroll run.');
    return this.prisma.$transaction(async tx => {
      const run = await tx.payrollRun.findUnique({ where: { id }, include: { lines: { include: { payments: true } } } });
      if (!run) throw new NotFoundException('Payroll run not found');
      if (run.status !== 'DRAFT') throw new BadRequestException('Only an unapproved draft payroll run can be discarded.');
      if (run.lines.some(line => line.paidAmount > 0 || line.payments.length > 0)) throw new BadRequestException('A payroll run with payment records cannot be discarded.');
      await tx.auditLog.create({ data: { actorId, action: 'PAYROLL_DRAFT_DISCARDED', entityType: 'PayrollRun', entityId: id, beforeJson: JSON.stringify({ month: run.month, status: run.status, lineCount: run.lines.length, totalGross: run.totalGross, totalNetPay: run.totalNetPay, totalEmployerCost: run.totalEmployerCost }), metadataJson: JSON.stringify({ reason: cleanReason, discardedAt: new Date().toISOString() }) } });
      await tx.payrollRun.delete({ where: { id } });
      return { discarded: true, month: run.month, reason: cleanReason };
    });
  }

  async approvePayrollRun(id: string, actorId?: string) {
    return this.prisma.$transaction(async tx => {
      const run = await tx.payrollRun.findUnique({ where: { id }, include: { lines: true } });
      if (!run) throw new NotFoundException('Payroll run not found');
      if (run.status !== 'DRAFT') throw new BadRequestException('Only a draft payroll run can be approved.');
      if (!run.lines.length) throw new BadRequestException('Cannot approve an empty payroll run.');
      const after = await tx.payrollRun.update({
        where: { id }, data: { status: 'APPROVED', approvedBy: actorId, approvedAt: new Date() },
      });
      await tx.payrollLine.updateMany({ where: { payrollRunId: id }, data: { status: 'AWAITING_PAYMENT' } });
      await tx.auditLog.create({ data: {
        actorId, action: 'PAYROLL_RUN_APPROVED', entityType: 'PayrollRun', entityId: id,
        beforeJson: JSON.stringify({ status: run.status }), afterJson: JSON.stringify({ status: after.status, approvedAt: after.approvedAt }),
      }});
      return after;
    });
  }

  async recordPayrollPayment(lineId: string, amount: number, paymentReference: string, paymentMethod: string, actorId?: string) {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new BadRequestException('PAYROLL_PAYMENT_MUST_BE_A_POSITIVE_WHOLE_RWF_AMOUNT');
    const reference = paymentReference?.trim();
    if (!reference || reference.length > 120) throw new BadRequestException('PAYMENT_REFERENCE_REQUIRED');
    const method = paymentMethod?.trim().toUpperCase();
    if (!['BANK', 'MOMO', 'CASH'].includes(method)) throw new BadRequestException('PAYMENT_METHOD_MUST_BE_BANK_MOMO_OR_CASH');
    return this.prisma.$transaction(async tx => {
      const line = await tx.payrollLine.findUnique({ where: { id: lineId }, include: { payrollRun: true, staff: true } });
      if (!line) throw new NotFoundException('Payroll line not found');
      if (!['APPROVED', 'PARTIALLY_PAID'].includes(line.payrollRun.status)) throw new BadRequestException('PAYROLL_RUN_MUST_BE_APPROVED_BEFORE_PAYMENT');
      const outstanding = line.netPay - line.paidAmount;
      if (amount > outstanding) throw new BadRequestException('PAYMENT_EXCEEDS_OUTSTANDING_NET_PAY:' + outstanding);
      const nextPaid = line.paidAmount + amount;
      const fullyPaid = nextPaid === line.netPay;
      const payment = await tx.salaryPayment.create({
        data: {
          staffMemberId: line.staffMemberId, payrollLineId: line.id, month: line.payrollRun.month,
          amount, paid: fullyPaid, paidAt: new Date(), paymentReference: reference,
          paymentMethod: method, note: 'Approved payroll ' + line.payrollRun.month,
        },
      });
      await tx.payrollLine.update({ where: { id: line.id }, data: { paidAmount: nextPaid, status: fullyPaid ? 'PAID' : 'PARTIALLY_PAID' } });
      if (fullyPaid) await tx.salaryPayment.updateMany({ where: { payrollLineId: line.id }, data: { paid: true } });
      const allLines = await tx.payrollLine.findMany({ where: { payrollRunId: line.payrollRunId } });
      const allPaid = allLines.every(item => item.id === line.id ? fullyPaid : item.paidAmount >= item.netPay);
      const anyPaid = allLines.some(item => item.id === line.id ? nextPaid > 0 : item.paidAmount > 0);
      const runStatus = allPaid ? 'PAID' : anyPaid ? 'PARTIALLY_PAID' : 'APPROVED';
      await tx.payrollRun.update({ where: { id: line.payrollRunId }, data: { status: runStatus, paidAt: allPaid ? new Date() : null } });
      await tx.auditLog.create({ data: {
        actorId, action: 'PAYROLL_PAYMENT_RECORDED', entityType: 'SalaryPayment', entityId: payment.id,
        afterJson: JSON.stringify({ staffMemberId: line.staffMemberId, payrollLineId: line.id, month: line.payrollRun.month, amount, paymentReference: reference, paymentMethod: method, fullyPaid }),
      }});
      return { payment, paidAmount: nextPaid, outstanding: line.netPay - nextPaid, status: fullyPaid ? 'PAID' : 'PARTIALLY_PAID' };
    }, { isolationLevel: 'Serializable' });
  }

  async recordSalaryPayment(_staffMemberId: string, month: string, _amount?: number, _note?: string, _paymentReference?: string, _paymentMethod?: string, _actorId?: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('PAYROLL_MONTH_MUST_BE_YYYY_MM');
    throw new BadRequestException('PAYROLL_APPROVAL_REQUIRED: payment entry is disabled until a payroll run, payslip and approval workflow is implemented.');
  }

  async getPayrollPreview(month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('PAYROLL_MONTH_MUST_BE_YYYY_MM');
    const monthStart = new Date(month + '-01T00:00:00+02:00');
    const monthEnd = new Date(monthStart.getTime());
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    const staff = await this.prisma.staffMember.findMany({
      where: { startDate: { lt: monthEnd }, OR: [{ active: true }, { endDate: { gte: monthStart } }] },
      include: { salaryHistory: { where: { effectiveFrom: { lt: monthEnd } }, orderBy: { effectiveFrom: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    const lines = staff.map(member => {
      const gross = this.calculateStaffSalaryForMonth(member, month);
      if (member.employmentType === 'CONTRACTOR') return { staffMemberId: member.id, name: member.name, employmentType: member.employmentType, gross, statutory: null, netPay: gross, status: 'CONTRACTOR_REVIEW_REQUIRED' };
      const statutory = calculateRwandaPayroll({ month, baseSalary: gross });
      return { staffMemberId: member.id, name: member.name, employmentType: member.employmentType, gross, statutory, netPay: statutory.netPay, employerCost: statutory.totalEmployerCost, status: 'DRAFT_PREVIEW' };
    });
    return {
      month, currency: 'RWF', status: 'DRAFT_PREVIEW', approvalRequired: true, lines,
      totals: lines.reduce((sum, line) => ({
        gross: sum.gross + line.gross,
        employeeNetPay: sum.employeeNetPay + line.netPay,
        paye: sum.paye + (line.statutory?.paye ?? 0),
        employeeDeductions: sum.employeeDeductions + (line.statutory?.employeeDeductions ?? 0),
        employerStatutoryCost: sum.employerStatutoryCost + (line.statutory?.employerStatutoryCost ?? 0),
        totalEmployerCost: sum.totalEmployerCost + (line.employerCost ?? line.gross),
      }), { gross: 0, employeeNetPay: 0, paye: 0, employeeDeductions: 0, employerStatutoryCost: 0, totalEmployerCost: 0 }),
      warnings: ['Estimate based on recorded base salary only; recurring allowances, one-off bonuses, deductions, advances, leave, overtime and formal approval are not yet stored in payroll.', 'Contractor payments require invoice and withholding-tax review and are not calculated as employee payroll.', 'Confirm contribution bases and current rules with Zana accountant before filing or payment.'],
    };
  }

  async getSalaryPayments(month?: string) {
    return this.prisma.salaryPayment.findMany({
      where: month ? { month } : {},
      include: { staff: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Total monthly salary burden across all active staff.
  async getMonthlySalaryBurden() {
    const staff = await this.prisma.staffMember.findMany({ where: { active: true } });
    return staff.reduce((sum, s) => sum + s.salary, 0);
  }

  // ─── DRIVER SETTLEMENT MONITOR ─────────────────────────────────────────
  // Reads and aggregates the existing Commission/CommissionDebt/
  // DebtSettlement records — deliberately not a new parallel ledger. One
  // real, honest limitation worth stating plainly: settledVia was only
  // just added, so the auto-vs-manual breakdown is only accurate for
  // debts cleared from this point forward — debt already paid off before
  // this existed has no way to retroactively know which path cleared it.

  async getSettlementOverview() {
    const [cashTrips, digitalTrips, cashCommissions, allDebts, driverCount] = await Promise.all([
      this.prisma.trip.aggregate({
        where: { status: 'RIDE_COMPLETED', paymentMethod: 'CASH' },
        _sum: { finalFare: true, estimatedFare: true },
      }),
      this.prisma.trip.aggregate({
        where: { status: 'RIDE_COMPLETED', paymentMethod: { not: 'CASH' } },
        _sum: { finalFare: true, estimatedFare: true },
      }),
      // Real, recorded per-ride amounts now, not reconstructed from
      // other totals — walletCoveredAmount/debtCreatedAmount are
      // captured at the moment each cash ride is actually processed.
      this.prisma.commission.aggregate({
        where: { tripId: { not: null } },
        _sum: { amount: true, walletCoveredAmount: true, debtCreatedAmount: true },
      }),
      this.prisma.commissionDebt.findMany(),
      this.prisma.driver.count(),
    ]);

    const cashGmv = cashTrips._sum.finalFare ?? cashTrips._sum.estimatedFare ?? 0;
    const digitalGmv = digitalTrips._sum.finalFare ?? digitalTrips._sum.estimatedFare ?? 0;

    const debtCreated = allDebts.reduce((s, d) => s + d.amount, 0);
    const autoRecovered = allDebts.filter(d => d.settledVia === 'AUTO').reduce((s, d) => s + d.amount, 0);
    const manuallySettled = allDebts.filter(d => d.settledVia === 'MANUAL').reduce((s, d) => s + d.amount, 0);
    const outstanding = allDebts.filter(d => !d.paidAt).reduce((s, d) => s + d.amount, 0);
    const walletCovered = cashCommissions._sum.walletCoveredAmount ?? 0;

    return {
      cashGmv, digitalGmv,
      totalGmv: cashGmv + digitalGmv,
      totalCommission: Math.round(cashGmv * 0.15 + digitalGmv * 0.15),
      walletCovered,
      debtCreated,
      autoRecovered,
      manuallySettled,
      outstanding,
      driverCount,
    };
  }

  async getDriverSettlements() {
    const drivers = await this.prisma.driver.findMany({
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } },
        commissionDebts: true,
      },
    });

    // One query for every driver's cash GMV at once, rather than one
    // query per driver in a loop.
    const cashByDriver = await this.prisma.trip.groupBy({
      by: ['driverId'],
      where: { status: 'RIDE_COMPLETED', paymentMethod: 'CASH', driverId: { not: null } },
      _sum: { finalFare: true, estimatedFare: true },
    });
    const cashMap = new Map(cashByDriver.map(c => [c.driverId, c._sum.finalFare ?? c._sum.estimatedFare ?? 0]));

    // Commission.tripId is a plain scalar, not an actual Prisma relation
    // — there's no relation field here to include at all, so the join
    // has to be done manually rather than through Prisma itself. Fetched
    // separately and matched in code, rather than adding a schema
    // relation just for this one read — exactly the kind of unnecessary
    // schema change to avoid for a financial system when it isn't
    // genuinely needed.
    const cashCommissions = await this.prisma.commission.findMany({
      where: { tripId: { not: null }, walletCoveredAmount: { gt: 0 } },
    });
    const relevantTrips = await this.prisma.trip.findMany({
      where: { id: { in: cashCommissions.map(c => c.tripId!) } },
      select: { id: true, driverId: true, paymentMethod: true },
    });
    const tripMap = new Map(relevantTrips.map(t => [t.id, t]));

    const coveredMap = new Map<string, number>();
    for (const c of cashCommissions) {
      const trip = tripMap.get(c.tripId!);
      if (!trip || trip.paymentMethod !== 'CASH' || !trip.driverId) continue;
      coveredMap.set(trip.driverId, (coveredMap.get(trip.driverId) ?? 0) + c.walletCoveredAmount);
    }

    return drivers
      .map(d => {
        const cashCollected = cashMap.get(d.id) ?? 0;
        const commission = Math.round(cashCollected * 0.15);
        const outstanding = d.commissionDebts.filter(x => !x.paidAt).reduce((s, x) => s + x.amount, 0);
        const covered = coveredMap.get(d.id) ?? 0;
        return {
          driverId: d.id,
          name: `${d.user?.firstName ?? ''} ${d.user?.lastName ?? ''}`.trim() || d.user?.phone || 'Driver',
          cashCollected,
          commission,
          covered,
          outstanding,
          // No configurable thresholds exist yet — this is the simple,
          // honestly-computable version: anything outstanding is due,
          // nothing outstanding is clear. Overdue/restricted tiers are a
          // real, separate piece not built in this pass.
          status: outstanding > 0 ? 'DUE' : 'CLEARED',
        };
      })
      .filter(d => d.cashCollected > 0 || d.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding);
  }


  async getMonthlyProfitability(month: string, db: any = this.prisma) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('MONTH_MUST_BE_YYYY_MM');
    const start = new Date(`${month}-01T00:00:00+02:00`);
    const end = new Date(new Date(`${month}-01T00:00:00+02:00`).getTime());
    end.setUTCMonth(end.getUTCMonth() + 1);
    const [rideDelivery, merchant, agent, expenses, staff, payrollRun, existingZif] = await Promise.all([
      db.commission.aggregate({ where: { createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      db.merchantSettlement.aggregate({ where: { createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } }, _sum: { commissionAmount: true } }),
      db.agentSettlement.aggregate({ where: { createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } }, _sum: { zanaEarning: true } }),
      db.expense.findMany({ where: { date: { gte: start, lt: end }, status: { not: 'VOID' } } }),
      db.staffMember.findMany({ where: { startDate: { lt: end }, OR: [{ active: true }, { endDate: { gte: start } }] }, include: { salaryHistory: { where: { effectiveFrom: { lt: end } }, orderBy: { effectiveFrom: 'asc' } } } }),
      db.payrollRun.findUnique({ where: { month }, include: { lines: { select: { staffMemberId: true } } } }),
      db.impactFundEntry.findUnique({ where: { idempotencyKey: `MONTHLY_NET_PROFIT:${month}` } }),
    ]);
    const rideDeliveryCommission = rideDelivery._sum.amount ?? 0;
    const merchantCommission = merchant._sum.commissionAmount ?? 0;
    const shoppingEarnings = agent._sum.zanaEarning ?? 0;
    // Salaries are accrued from staff contracts here. A SALARIES expense entry is
    // excluded so a salary payment cannot be counted twice as both payroll and expense.
    const salaryCategories = ['SALARY', 'SALARIES', 'PAYROLL'];
    const legacySalaryExpenseCount = expenses.filter(e => salaryCategories.includes(String(e.category).trim().toUpperCase())).length;
    const approvedExpenses = expenses.filter(e => e.status === 'APPROVED');
    const pendingExpenseCount = expenses.filter(e => e.status === 'PENDING').length;
    const operatingExpenses = approvedExpenses.filter(e => !salaryCategories.includes(String(e.category).trim().toUpperCase())).reduce((sum, e) => sum + e.amount, 0);
    const employeeStaffCount = staff.filter(member => member.employmentType !== 'CONTRACTOR').length;
    const contractorCount = staff.length - employeeStaffCount;
    const payrollAccrual = payrollRun
      ? payrollRun.totalEmployerCost
      : staff.filter(member => member.employmentType !== 'CONTRACTOR').reduce((sum, member) => sum + this.calculateStaffSalaryForMonth(member, month), 0);
    const payrollApproved = !!payrollRun && ['APPROVED', 'PARTIALLY_PAID', 'PAID'].includes(payrollRun.status);
    const payrollLineCount = payrollRun?.lines?.length ?? 0;
    const payrollCoverageMatches = employeeStaffCount === 0 ? payrollLineCount === 0 : payrollLineCount === employeeStaffCount;
    const platformEarnings = rideDeliveryCommission + merchantCommission + shoppingEarnings;
    const netProfit = platformEarnings - operatingExpenses - payrollAccrual;
    const impactFundRate = 3;
    const contribution = calculateMonthlyZifContribution(netProfit, impactFundRate);
    const canClose = employeeStaffCount === 0 && contractorCount === 0 || payrollApproved && contractorCount === 0;
    const warnings = [
      payrollRun ? 'Payroll expense uses the stored monthly payroll run, including employer statutory costs. The run must be approved before the month can close.' : 'No stored payroll run exists. The preview uses base-salary accrual only and cannot be used to close a month with employees.',
      contractorCount ? 'Contractor invoices and withholding-tax review are not yet integrated; months containing contractors remain blocked from close.' : 'Contractor payroll is not included in employee payroll.',
      'Only approved operating expenses are included. Pending expenses must be resolved before month close.',
      'Only recognized platform commissions and recorded marketplace earnings are included; gross customer payments and pass-through balances are excluded.',
      'This is an accrual estimate. Cash availability and ZIF disbursements are not included.',
    ];
    return { month, currency: 'RWF', basis: 'ACCRUAL_ESTIMATE', platformEarnings, breakdown: { rideAndDeliveryCommission: rideDeliveryCommission, merchantCommission, shoppingEarnings }, operatingExpenses, payrollAccrual, payrollRunStatus: payrollRun?.status ?? 'NOT_CREATED', payrollApproved, netProfit, impactFundRatePercent: impactFundRate, impactFundContribution: contribution, alreadyClosed: !!existingZif, closedEntryId: existingZif?.id ?? null, expenseCount: approvedExpenses.length, pendingExpenseCount, activeStaffCount: staff.length, employeeStaffCount, contractorCount, legacySalaryExpenseCount, payrollLineCount, payrollCoverageMatches, canClose: canClose && payrollCoverageMatches && legacySalaryExpenseCount === 0 && pendingExpenseCount === 0, warnings };
  }

  async closeMonthlyProfit(month: string, actorId?: string) {
    const currentMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali', year: 'numeric', month: '2-digit' }).format(new Date());
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month >= currentMonth) throw new BadRequestException('Only a completed month can be closed for ZIF.');
    return this.prisma.$transaction(async tx => {
      const preview = await this.getMonthlyProfitability(month, tx);
      if (preview.alreadyClosed) throw new ConflictException('This month has already been closed for ZIF.');
      if (!preview.canClose) throw new BadRequestException('An approved payroll run covering every employee, contractor reconciliation, legacy salary review, or pending expense is still outstanding. Resolve the month-end blockers before closing.');
      const key = `MONTHLY_NET_PROFIT:${month}`;
      const existing = await tx.impactFundEntry.findUnique({ where: { idempotencyKey: key } });
      if (existing) throw new ConflictException('This month has already been closed for ZIF.');
      const entry = await tx.impactFundEntry.create({ data: { sourceType: 'NET_PROFIT', sourceId: month, eventType: 'ACCRUAL', grossAmount: preview.platformEarnings, platformCommission: Math.max(0, preview.netProfit), contributionAmount: preview.impactFundContribution, ratePercent: preview.impactFundRatePercent, status: 'ACCRUED', idempotencyKey: key, description: `Monthly net-profit allocation for ${month}; net profit RWF ${preview.netProfit}` } });
      await tx.auditLog.create({ data: { actorId, action: 'MONTHLY_FINANCIAL_PERIOD_CLOSED', entityType: 'ImpactFundEntry', entityId: entry.id, afterJson: JSON.stringify({ ...preview, entryId: entry.id }) } });
      return { ...preview, entry };
    }, { isolationLevel: 'Serializable' });
  }

  async getFinancialSnapshot() {
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali', year: 'numeric', month: '2-digit' }).format(new Date());
    const profitability = await this.getMonthlyProfitability(month);
    return { ...profitability, totalRevenue: profitability.platformEarnings, totalCommission: profitability.platformEarnings, totalExpenses: profitability.operatingExpenses, monthlySalaryBurden: profitability.payrollAccrual, netProfit: profitability.netProfit };
  }
}