import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PaypackService } from './paypack.service';

/** Compatibility adapter for existing ride/delivery/order flows. All provider traffic goes to Paypack. */
@Injectable()
export class PaypackPaymentAdapter {
  constructor(private readonly paypack: PaypackService) {}

  async getMinimumWithdrawal() { return 1000; }
  async getPublicSettings() { return this.paypack.getPublicSettings(); }
  async testConnection() { return this.paypack.testConnection(); }

  async collectMobileMoney(phone: string, amountRwf: number, transactionRef: string) {
    return this.paypack.cashin(phone, amountRwf, transactionRef);
  }
  async getCollectionStatus(ref: string) {
    const txn = await this.paypack.getTransaction(ref);
    return { ref: txn.ref, status: txn.status, raw: txn.raw };
  }
  async payout(phone: string, amountRwf: number, reference: string) {
    return this.paypack.cashout(phone, amountRwf, reference);
  }
  async getPayoutStatus(ref: string) {
    const txn = await this.paypack.getTransaction(ref);
    return { ref: txn.ref, status: txn.status, raw: txn.raw };
  }
  async refundCollection(_ref: string, _amountRwf?: number) {
    throw new ServiceUnavailableException('PAYPACK_REFUNDS_NOT_SUPPORTED');
  }
}
