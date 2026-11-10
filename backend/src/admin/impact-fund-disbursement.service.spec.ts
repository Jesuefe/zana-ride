import { ImpactFundDisbursementService } from './impact-fund-disbursement.service';

describe('ImpactFundDisbursementService', () => {
  const make = (balance = 100000) => {
    const row: any = {
      id: 'disb-1', amount: 30000, recipientName: 'Community School', recipientType: 'SCHOOL',
      purpose: 'Learning materials for vulnerable pupils', status: 'REQUESTED', requestedBy: 'requester',
      approvedBy: null, paidBy: null,
    };
    const tx: any = {
      impactFundEntry: { aggregate: jest.fn().mockResolvedValue({ _sum: { contributionAmount: balance } }) },
      impactFundDisbursement: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockImplementation(async () => row),
        create: jest.fn().mockImplementation(async ({ data }) => ({ ...row, ...data })),
        update: jest.fn().mockImplementation(async ({ data }) => Object.assign(row, data)),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma: any = {
      ...tx,
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    return { service: new ImpactFundDisbursementService(prisma), prisma, tx, row };
  };

  it('rejects a request that exceeds the unreserved ZIF balance', async () => {
    const { service, tx } = make(10000);
    await expect(service.request('finance-1', {
      amount: 30000, recipientName: 'Community School', recipientType: 'SCHOOL',
      purpose: 'Learning materials for vulnerable pupils',
    })).rejects.toThrow('INSUFFICIENT_ZIF_AVAILABLE_BALANCE');
    expect(tx.impactFundDisbursement.create).not.toHaveBeenCalled();
  });

  it('records a request and an audit event while reserving the amount', async () => {
    const { service, tx } = make(100000);
    const result = await service.request('finance-1', {
      amount: 30000, recipientName: 'Community School', recipientType: 'SCHOOL',
      purpose: 'Learning materials for vulnerable pupils',
    });
    expect(result.balanceAfterRequest).toBe(70000);
    expect(tx.impactFundDisbursement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 30000, requestedBy: 'finance-1', status: 'REQUESTED' }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalled();
  });

  it('prevents the requester from approving their own disbursement', async () => {
    const { service } = make();
    await expect(service.approve('requester', 'disb-1')).rejects.toThrow('A requester cannot approve their own disbursement');
  });

  it('prevents the approver from also marking the payout as paid', async () => {
    const { service, tx, row } = make();
    row.status = 'APPROVED';
    row.approvedBy = 'approver';
    await expect(service.markPaid('approver', 'disb-1', {
      paymentMethod: 'MOBILE_MONEY', paymentReference: 'TX-12345',
    })).rejects.toThrow('The approver cannot also mark this disbursement as paid');
    expect(tx.impactFundDisbursement.update).not.toHaveBeenCalled();
  });
});