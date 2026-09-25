import { Injectable, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type PaypackTokenResponse = { access: string; expires: string };
type PaypackCashinResponse = { ref: string; status: string; amount: number };
type PaypackTransactionResponse = { ref: string; status: string; amount: number; kind: string };

@Injectable()
export class PaypackService {
  private readonly baseUrl = 'https://payments.paypack.rw/api';
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(private config: ConfigService) {}

  private async authenticate(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.token;
    }

    const res = await fetch(`${this.baseUrl}/auth/agents/authorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.get<string>('PAYPACK_CLIENT_ID'),
        client_secret: this.config.get<string>('PAYPACK_CLIENT_SECRET'),
      }),
    });

    if (!res.ok) {
      throw new BadGatewayException('Could not authenticate with the payment provider');
    }

    const data = (await res.json()) as PaypackTokenResponse;
    // Cache with a minute of headroom before actual expiry.
    this.cachedToken = { token: data.access, expiresAt: Date.now() + 4 * 60 * 1000 };
    return data.access;
  }

  // Normalizes any reasonable input format (+250796682924, 250796682924,
  // 0796682924, or even a mistakenly double-prefixed 2500796682924) down to
  // Paypack's expected local format: a single leading 0 followed by 9 digits.
  private toLocalFormat(phoneNumber: string): string {
    let digits = phoneNumber.replace(/\D/g, '');
    if (digits.startsWith('250')) digits = digits.slice(3);
    digits = digits.replace(/^0+/, '');
    return `0${digits}`;
  }

  // Pulls funds FROM a customer's mobile money account INTO the Zana
  // merchant Paypack account — used for wallet top-ups. The customer
  // approves the request via a USSD/mobile money prompt on their phone.
  async cashin(phoneNumber: string, amountRwf: number): Promise<PaypackCashinResponse> {
    const token = await this.authenticate();
    const localNumber = this.toLocalFormat(phoneNumber);

    const res = await fetch(`${this.baseUrl}/transactions/cashin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ number: localNumber, amount: amountRwf }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new BadGatewayException(`Payment request failed: ${body}`);
    }

    return res.json();
  }

  /**
   * Look up a transaction by reference.
   *
   * Paypack's find endpoint does not return a `status` field. It returns the
   * transaction record itself once the transaction has settled — complete
   * with the fee charged and a settlement timestamp. A transaction that has
   * not settled yet returns 404.
   *
   * So we derive the status: a record that comes back with a timestamp has
   * settled; a 404 means still pending; anything else is a real error.
   */
  async findTransaction(ref: string): Promise<PaypackTransactionResponse & { status: string }> {
    const token = await this.authenticate();
    const res = await fetch(`${this.baseUrl}/transactions/find/${ref}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });

    if (res.status === 404) {
      return { ref, status: 'pending' } as any;
    }

    if (!res.ok) {
      throw new BadGatewayException('Could not check payment status');
    }

    const body: any = await res.json();

    // Paypack may add an explicit status later; honour it if present.
    if (body?.status) {
      return { ...body, status: String(body.status).toLowerCase() };
    }

    // Otherwise the record existing with a settlement timestamp is the signal.
    const settled = Boolean(body?.timestamp || body?.processed_at || body?.created_at);
    return { ...body, status: settled ? 'successful' : 'pending' };
  }

  async cashout(phoneNumber: string, amountRwf: number) {
    const token = await this.authenticate();
    const localNumber = this.toLocalFormat(phoneNumber);
    const res = await fetch(`${this.baseUrl}/transactions/cashout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ number: localNumber, amount: amountRwf }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new BadGatewayException(`Cashout failed: ${body}`);
    }
    return res.json();
  }

}