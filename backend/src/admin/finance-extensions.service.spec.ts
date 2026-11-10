import { FinanceExtensionsService } from './finance-extensions.service';

describe('FinanceExtensionsService', () => {
  it('issues a salary advance only to an active non-contractor and audits it', async () => {
    const tx: any = {
      salaryAdvance: { aggregate: jest.fn().mockResolvedValue({ _sum: { outstandingAmount: 0 } }), create: jest.fn().mockResolvedValue({ id: 'adv-1', principalAmount: 100000, outstandingAmount: 100000 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = { staffMember: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-1', active: true, employmentType: 'EMPLOYEE' }) }, $transaction: jest.fn(fn => fn(tx)) };
    const service = new FinanceExtensionsService(prisma);
    const result = await service.issueAdvance('admin-1', { staffMemberId: 'staff-1', principalAmount: 100000, monthlyDeduction: 20000 });
    expect(result.id).toBe('adv-1');
    expect(tx.salaryAdvance.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ principalAmount: 100000, monthlyDeduction: 20000 }) }));
    expect(tx.auditLog.create).toHaveBeenCalled();
  });

  it('calculates contractor withholding and net payable using the explicitly supplied rate', async () => {
    const prisma: any = {
      staffMember: { findUnique: jest.fn() },
      contractorInvoice: { create: jest.fn().mockResolvedValue({ id: 'inv-1', grossAmount: 100000, withholdingAmount: 15000, netPayable: 85000 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new FinanceExtensionsService(prisma);
    const result = await service.createContractorInvoice('admin-1', { contractorName: 'Vendor Ltd', invoiceNumber: 'INV-01', invoiceDate: '2026-10-01', description: 'Delivery services', grossAmount: 100000, withholdingRate: 15 });
    expect(result.withholdingAmount).toBe(15000);
    expect(prisma.contractorInvoice.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ netPayable: 85000, withholdingRate: 15 }) }));
  });

  it('does not allow payment above the contractor invoice net payable', async () => {
    const tx: any = { contractorInvoice: { findUnique: jest.fn().mockResolvedValue({ id: 'inv-1', status: 'APPROVED', amountPaid: 80000, netPayable: 85000 }) } };
    const prisma: any = { $transaction: jest.fn(fn => fn(tx)) };
    const service = new FinanceExtensionsService(prisma);
    await expect(service.payContractorInvoice('admin-1', 'inv-1', { amount: 10000, paymentReference: 'TX-1234', paymentMethod: 'MOMO' })).rejects.toThrow('PAYMENT_EXCEEDS_NET_PAYABLE');
  });
});