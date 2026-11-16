import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PartnerApiService } from './partner-api.service';

describe('PartnerApiService prepaid wallet', () => {
  const partnerId = 'partner-1';
  const scopes = ['wallet:reserve', 'wallet:settle', 'wallet:release', 'wallet:read'];
  let prisma: any;
  let paypack: any;
  let service: PartnerApiService;

  beforeEach(() => {
    prisma = { $transaction: jest.fn() };
    paypack = { cashin: jest.fn(), getTransaction: jest.fn() };
    service = new PartnerApiService(prisma, paypack);
  });

  it('rejects wallet operations without the required scope', async () => {
    await expect(service.reserve(partnerId, [], 'order-123', 2500))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects non-positive or fractional RWF amounts', async () => {
    await expect(service.reserve(partnerId, scopes, 'order-123', 0))
      .rejects.toThrow('AMOUNT_MUST_BE_A_POSITIVE_INTEGER_IN_RWF');
    await expect(service.reserve(partnerId, scopes, 'order-123', 10.5))
      .rejects.toThrow('AMOUNT_MUST_BE_A_POSITIVE_INTEGER_IN_RWF');
  });

  it('rejects insufficient prepaid balance without writing a reservation', async () => {
    const wallet = { id: 'wallet-1', partnerId, available: 1000, reserved: 0, currency: 'RWF', suspendedAt: null };
    const tx = {
      apiPartnerWalletTransaction: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      apiPartnerWallet: {
        findUnique: jest.fn().mockResolvedValue(wallet),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    prisma.$transaction.mockImplementation((callback: (client: any) => Promise<any>) => callback(tx));

    await expect(service.reserve(partnerId, scopes, 'order-123', 2500))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.apiPartnerWallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ available: { gte: 2500 } }),
    }));
    expect(tx.apiPartnerWalletTransaction.create).not.toHaveBeenCalled();
  });

  it('reserves prepaid funds and records the balance movement atomically', async () => {
    const wallet = { id: 'wallet-1', partnerId, available: 10000, reserved: 0, currency: 'RWF', suspendedAt: null };
    const after = { ...wallet, available: 7500, reserved: 2500 };
    const tx = {
      apiPartnerWalletTransaction: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      apiPartnerWallet: {
        findUnique: jest.fn().mockResolvedValue(wallet),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(after),
      },
    };
    prisma.$transaction.mockImplementation((callback: (client: any) => Promise<any>) => callback(tx));

    const result = await service.reserve(partnerId, scopes, 'order-123', 2500);

    expect(result).toMatchObject({ secured: true, status: 'RESERVED', available: 7500, reserved: 2500 });
    expect(tx.apiPartnerWalletTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'RESERVED',
        amount: 2500,
        availableBefore: 10000,
        availableAfter: 7500,
        reservedBefore: 0,
        reservedAfter: 2500,
      }),
    }));
  });
});
