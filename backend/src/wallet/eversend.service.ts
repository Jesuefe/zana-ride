import { Injectable, BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type EversendResponse = Record<string, any>;

@Injectable()
export class EversendService {
  private readonly baseUrl: string;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (
      this.config.get<string>('EVERSEND_BASE_URL') ||
      'https://api.eversend.co/v1'
    ).replace(/\/$/, '');
  }

  private async token(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.token;
    }

    const clientId = this.config.get<string>('EVERSEND_CLIENT_ID');
    const clientSecret = this.config.get<string>('EVERSEND_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('EVERSEND_NOT_CONFIGURED');
    }

    const res = await fetch(`${this.baseUrl}/auth/token`, {
      method: 'GET',
      headers: {
        clientId,
        clientSecret,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new BadGatewayException('Could not authenticate with Eversend');
    }

    const data = (await res.json()) as EversendResponse;
    const token = data.token ?? data.access_token;
    if (!token) throw new BadGatewayException('Eversend authentication returned no token');

    this.cachedToken = {
      token,
      expiresAt: Date.now() + 4 * 60 * 1000,
    };
    return token;
  }

  private normalizeRwandaPhone(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('250')) digits = digits.slice(3);
    digits = digits.replace(/^0+/, '');
    if (digits.length !== 9) throw new BadGatewayException('INVALID_RRW_PHONE');
    return `+250${digits}`;
  }

  private async request(path: string, init: RequestInit = {}) {
    const token = await this.token();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const raw = await res.text();
    let data: EversendResponse = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }

    if (!res.ok) {
      const message = data?.message || data?.error || raw || 'Eversend request failed';
      throw new BadGatewayException(String(message));
    }
    return data;
  }

  async collectMobileMoney(phone: string, amountRwf: number, transactionRef: string) {
    const data = await this.request('/collections/momo', {
      method: 'POST',
      body: JSON.stringify({
        phone: this.normalizeRwandaPhone(phone),
        amount: amountRwf,
        country: 'RW',
        currency: 'RWF',
        transactionRef,
      }),
    });
    return {
      ref: data.id ?? data.ref ?? data.transactionRef ?? transactionRef,
      status: String(data.status ?? 'pending').toLowerCase(),
      raw: data,
    };
  }

  async getCollectionStatus(ref: string) {
    const data = await this.request(`/collections/${encodeURIComponent(ref)}`);
    return {
      ref,
      status: this.normalizeStatus(data.status ?? data.state),
      raw: data,
    };
  }

  async payout(phone: string, amountRwf: number, reference: string) {
    const normalizedPhone = this.normalizeRwandaPhone(phone);
    const idempotencyKey = reference.replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 200);
    const data = await this.request('/payouts', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        amount: amountRwf,
        currency: 'RWF',
        rail: this.config.get<string>('EVERSEND_RWF_RAIL') || 'mtn_momo',
        recipient: { phone: normalizedPhone },
        reference,
      }),
    });
    return {
      ref: data.id ?? data.ref ?? reference,
      status: this.normalizeStatus(data.status ?? data.state),
      raw: data,
    };
  }

  async getPayoutStatus(ref: string) {
    const data = await this.request(`/payouts/${encodeURIComponent(ref)}`);
    return {
      ref,
      status: this.normalizeStatus(data.status ?? data.state),
      raw: data,
    };
  }

  private normalizeStatus(value: any): string {
    const s = String(value ?? 'pending').toLowerCase();
    if (['success', 'successful', 'settled', 'completed', 'received'].includes(s)) return 'successful';
    if (['failed', 'failure', 'reversed', 'cancelled', 'canceled'].includes(s)) return 'failed';
    return 'pending';
  }
}
