import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService) {}

  // ─── EXPENSES ──────────────────────────────────────────────────────────

  async createExpense(data: { title: string; amount: number; category: string; description?: string; date?: Date }) {
    return this.prisma.expense.create({ data });
  }

  async getExpenses() {
    return this.prisma.expense.findMany({ orderBy: { date: 'desc' }, take: 200 });
  }

  async deleteExpense(id: string) {
    return this.prisma.expense.delete({ where: { id } });
  }

  async getAccountingLedger(limit = 500) {
    const take = Math.min(Math.max(limit, 50), 1000);
    const [wallet, commissions, debts, debtSettlements, merchantSettlements, agentSettlements, expenses, trips, deliveries, orders] = await Promise.all([
      this.prisma.walletTransaction.findMany({ take, orderBy: { createdAt: 'desc' }, include: { wallet: { select: { user: { select: { firstName: true, lastName: true, phone: true, role: true } } } } } }),
      this.prisma.commission.findMany({ take, orderBy: { createdAt: 'desc' } }),
      this.prisma.commissionDebt.findMany({ take, orderBy: { createdAt: 'desc' } }),
      this.prisma.debtSettlement.findMany({ take, orderBy: { createdAt: 'desc' } }),
      this.prisma.merchantSettlement.findMany({ take, orderBy: { createdAt: 'desc' } }),
      this.prisma.agentSettlement.findMany({ take, orderBy: { createdAt: 'desc' } }),
      this.prisma.expense.findMany({ take, orderBy: { createdAt: 'desc' } }),
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
      ...expenses.map(t => ({ at: t.createdAt, type: 'EXPENSE', direction: 'DEBIT', amount: t.amount, reference: t.id, status: 'RECORDED', entityId: t.id, description: t.title, account: t.category })),
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
      counts: { rides: trips.length, deliveries: deliveries.length, orders: orders.length, ledgerRows: rows.length },
      rows,
    };
  }

  async getExpenseSummary() {
    const expenses = await this.prisma.expense.findMany();
    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
      total += e.amount;
    }
    return { total, byCategory };
  }

  // ─── STAFF & SALARY ────────────────────────────────────────────────────

  async createStaff(data: { name: string; role: string; phone?: string; email?: string; salary: number; startDate?: Date }) {
    return this.prisma.staffMember.create({ data });
  }

  async getStaff() {
    return this.prisma.staffMember.findMany({
      where: { active: true },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 3 } },
      orderBy: { name: 'asc' },
    });
  }

  async updateStaff(id: string, data: Partial<{ name: string; role: string; salary: number; active: boolean }>) {
    return this.prisma.staffMember.update({ where: { id }, data });
  }

  async recordSalaryPayment(staffMemberId: string, month: string, amount?: number, note?: string) {
    const staff = await this.prisma.staffMember.findUnique({ where: { id: staffMemberId } });
    if (!staff) throw new NotFoundException('Staff member not found');
    return this.prisma.salaryPayment.create({
      data: {
        staffMemberId,
        month,
        amount: amount ?? staff.salary,
        paid: true,
        paidAt: new Date(),
        note,
      },
    });
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


  async getFinancialSnapshot() {
    const [
      totalRevenue,
      commissions,
      expenses,
      salaryBurden,
      unpaidPayments,
      deliveryRevenue,
    ] = await Promise.all([
      this.prisma.trip.aggregate({ where: { status: 'RIDE_COMPLETED' }, _sum: { finalFare: true, estimatedFare: true } }),
      this.prisma.commission.aggregate({ _sum: { amount: true } }),
      this.prisma.expense.aggregate({ _sum: { amount: true } }),
      this.getMonthlySalaryBurden(),
      this.prisma.salaryPayment.findMany({ where: { paid: false }, include: { staff: true } }),
      // Same gap as the dashboard overview — this snapshot is meant to
      // be the comprehensive financial view, and it was silently
      // excluding an entire real revenue stream.
      this.prisma.delivery.aggregate({ where: { status: 'DELIVERED' }, _sum: { fee: true } }),
    ]);

    const revenue = totalRevenue._sum.finalFare ?? totalRevenue._sum.estimatedFare ?? 0;
    const commission = commissions._sum.amount ?? 0;
    const expenseTotal = expenses._sum.amount ?? 0;

    return {
      totalRevenue: revenue,
      deliveryRevenue: deliveryRevenue._sum.fee ?? 0,
      totalCommission: commission,
      totalExpenses: expenseTotal,
      monthlySalaryBurden: salaryBurden,
      // Previously never actually subtracted salary at all — staff pay
      // was shown right alongside this figure as if informational only,
      // while "net profit" silently excluded the company's largest
      // recurring cost entirely, overstating it by the full monthly
      // burden every time.
      netProfit: commission - expenseTotal - salaryBurden,
      unpaidPayrolls: unpaidPayments,
    };
  }
}
