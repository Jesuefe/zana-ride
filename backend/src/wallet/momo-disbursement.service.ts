import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

/**
 * MTN MoMo Disbursements.
 *
 * Paypack refuses any cashout under 10,000 RWF, which makes same-day payouts
 * impossible for a rider earning a few hundred per trip. MTN's disbursement
 * API has no such floor, so this is the rail for instant payouts.
 *
 * Zana holds a funded disbursement account and pushes money straight to the
 * rider's MoMo. Balance is checked before every transfer so we never promise
 * money the float cannot cover.
 *
 * Required environment:
 *   MOMO_DISBURSE_SUBSCRIPTION_KEY  Ocp-Apim-Subscription-Key from the portal
 *   MOMO_DISBURSE_API_USER          API user UUID
 *   MOMO_DISBURSE_API_KEY           API key for that user
 *   MOMO_DISBURSE_ENV               "sandbox" or "mtnrwanda"
 *   MOMO_DISBURSE_CURRENCY          "EUR" in sandbox, "RWF" in production
 */
@Injectable()
export class MomoDisbursementService {
  private readonly logger = new Logger('MomoDisbursement');
  private token: string | null = null;
  private tokenExpiry = 0;

  constructor(private config: ConfigService) {}

  private get subscriptionKey() {
    return this.config.get<string>('MOMO_DISBURSE_SUBSCRIPTION_KEY') ?? '';
  }
  private get apiUser() {
    return this.config.get<string>('MOMO_DISBURSE_API_USER') ?? '';
  }
  private get apiKey() {
    return this.config.get<string>('MOMO_DISBURSE_API_KEY') ?? '';
  }
  private get targetEnv() {
    return this.config.get<string>('MOMO_DISBURSE_ENV') ?? 'sandbox';
  }
  private get currency() {
    // Sandbox only accepts EUR; production Rwanda uses RWF.
    return this.config.get<string>('MOMO_DISBURSE_CURRENCY')
      ?? (this.targetEnv === 'sandbox' ? 'EUR' : 'RWF');
  }
  private get baseUrl() {
    return this.targetEnv === 'sandbox'
      ? 'https://sandbox.momodeveloper.mtn.com'
      : 'https://proxy.momoapi.mtn.com';
  }

  get isConfigured(): boolean {
    return Boolean(this.subscriptionKey && this.apiUser && this.apiKey);
  }

  /** MTN tokens last an hour; cache and refresh a minute early. */
  private async authenticate(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) return this.token;

    const basic = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString('base64');
    const res = await fetch(`${this.baseUrl}/disbursement/token/`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Token failed: ${res.status} ${body}`);
      throw new BadGatewayException('MOMO_AUTH_FAILED');
    }

    const data: any = await res.json();
    this.token = data.access_token;
    this.tokenExpiry = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000;
    return this.token!;
  }

  /** MTN wants a bare MSISDN — no plus, no leading zero. */
  private toMsisdn(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('250')) return digits;
    if (digits.startsWith('0')) return `250${digits.slice(1)}`;
    return `250${digits}`;
  }

  /**
   * Confirm the number is a registered active MoMo account before sending.
   * Catching a wrong number here is far better than a failed transfer that
   * has to be traced and refunded.
   */
  async isAccountActive(phone: string): Promise<boolean> {
    if (!this.isConfigured) return true; // nothing to check against

    try {
      const token = await this.authenticate();
      const res = await fetch(
        `${this.baseUrl}/disbursement/v1_0/accountholder/msisdn/${this.toMsisdn(phone)}/active`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Target-Environment': this.targetEnv,
            'Ocp-Apim-Subscription-Key': this.subscriptionKey,
          },
        },
      );
      if (!res.ok) return false;
      const body = await res.text();
      return body.trim() === 'true' || body.includes('true');
    } catch {
      // Don't block a payout because validation was unreachable.
      return true;
    }
  }

  /** What Zana has left to pay out. */
  async getBalance(): Promise<{ available: number; currency: string } | null> {
    if (!this.isConfigured) return null;
    try {
      const token = await this.authenticate();
      const res = await fetch(`${this.baseUrl}/disbursement/v1_0/account/balance`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Target-Environment': this.targetEnv,
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        },
      });
      if (!res.ok) return null;
      const data: any = await res.json();
      return {
        available: Number(data.availableBalance ?? 0),
        currency: data.currency ?? this.currency,
      };
    } catch {
      return null;
    }
  }

  /**
   * Push money to a rider or merchant. Returns immediately with a reference —
   * MTN settles asynchronously, so the reconciler confirms it afterwards.
   */
  async transfer(phone: string, amount: number, note = 'Zana payout'): Promise<{ ref: string }> {
    if (!this.isConfigured) throw new BadGatewayException('MOMO_NOT_CONFIGURED');

    const token = await this.authenticate();
    const ref = randomUUID();

    const res = await fetch(`${this.baseUrl}/disbursement/v1_0/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Reference-Id': ref,
        'X-Target-Environment': this.targetEnv,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(amount),
        currency: this.currency,
        externalId: ref,
        payee: { partyIdType: 'MSISDN', partyId: this.toMsisdn(phone) },
        payerMessage: note,
        payeeNote: note,
      }),
    });

    // 202 Accepted is the success case — the transfer is queued.
    if (res.status !== 202) {
      const body = await res.text();
      this.logger.error(`Transfer failed: ${res.status} ${body}`);
      throw new BadGatewayException(`MOMO_TRANSFER_FAILED: ${body.slice(0, 200)}`);
    }

    this.logger.log(`Transfer ${ref} queued — ${amount} ${this.currency} to ${phone}`);
    return { ref };
  }

  /** SUCCESSFUL, PENDING or FAILED. */
  async getTransferStatus(ref: string): Promise<{ status: string; reason?: string }> {
    if (!this.isConfigured) return { status: 'PENDING' };

    try {
      const token = await this.authenticate();
      const res = await fetch(`${this.baseUrl}/disbursement/v1_0/transfer/${ref}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Target-Environment': this.targetEnv,
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        },
      });

      if (!res.ok) return { status: 'PENDING' };

      const data: any = await res.json();
      return {
        status: String(data.status ?? 'PENDING').toUpperCase(),
        reason: data.reason?.message ?? data.reason,
      };
    } catch {
      return { status: 'PENDING' };
    }
  }
}
