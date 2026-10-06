import { Injectable, BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type PaypackResponse = Record<string, any>;

@Injectable()
export class PaypackService {
  private readonly baseUrl = 'https://payments.paypack.rw/api';
  private accessToken = '';
  private refreshToken = '';
  private accessExpiresAt = 0;

  constructor(private readonly config: ConfigService) {}

  private credentials() {
    const clientId = this.config.get<string>('PAYPACK_CLIENT_ID') || '';
    const clientSecret = this.config.get<string>('PAYPACK_CLIENT_SECRET') || '';
    const webhookSecret = this.config.get<string>('PAYPACK_WEBHOOK_SECRET') || '';
    const webhookMode = this.config.get<string>('PAYPACK_WEBHOOK_MODE') === 'development' ? 'development' : 'production';
    if (!clientId || !clientSecret) throw new ServiceUnavailableException('PAYPACK_NOT_CONFIGURED');
    return { clientId, clientSecret, webhookSecret, webhookMode };
  }

  private normalizeRwandaPhone(phone: string): string {
    let digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('250')) digits = digits.slice(3);
    digits = digits.replace(/^0+/, '');
    if (digits.length !== 9 || !/^7\d{8}$/.test(digits)) throw new BadGatewayException('INVALID_RW_PHONE');
    return '0' + digits;
  }

  private async authorize() {
    const c = this.credentials();
    if (this.accessToken && Date.now() < this.accessExpiresAt - 30_000) return this.accessToken;

    const res = await fetch(this.baseUrl + '/auth/agents/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: c.clientId, client_secret: c.clientSecret }),
    });
    const raw = await res.text();
    let data: PaypackResponse = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!res.ok || !data.access) {
      throw new BadGatewayException(String(data?.message || data?.error || raw || 'Paypack authentication failed'));
    }
    this.accessToken = data.access;
    this.refreshToken = data.refresh || '';
    const expires = Number(data.expires || 900);
    this.accessExpiresAt = Date.now() + (expires > 100000 ? expires : expires * 1000);
    return this.accessToken;
  }

  private async request(path: string, init: RequestInit = {}, retry = true) {
    let token = await this.authorize();
    const c = this.credentials();
    const headers = new Headers(init.headers);
    headers.set('Authorization', 'Bearer ' + token);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    headers.set('X-Webhook-Mode', c.webhookMode);

    let res = await fetch(this.baseUrl + path, { ...init, headers });
    if ((res.status === 401 || res.status === 403) && retry) {
      this.accessToken = '';
      this.accessExpiresAt = 0;
      token = await this.authorize();
      headers.set('Authorization', 'Bearer ' + token);
      res = await fetch(this.baseUrl + path, { ...init, headers });
    }
    const raw = await res.text();
    let data: PaypackResponse = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!res.ok) throw new BadGatewayException(String(data?.message || data?.error || data?.detail || raw || 'Paypack request failed'));
    return data;
  }

  async getPublicSettings() {
    const c = this.credentials();
    return {
      enabled: true,
      configured: true,
      environment: c.webhookMode,
      baseUrl: this.baseUrl,
      mobileMoney: ['mtn', 'airtel', 'tigo'],
      cashin: true,
      cashout: true,
      webhookConfigured: Boolean(c.webhookSecret),
    };
  }

  async testConnection() {
    await this.authorize();
    return { ok: true, provider: 'PAYPACK', environment: this.credentials().webhookMode, currency: 'RWF', cashin: true, cashout: true };
  }

  async cashin(phone: string, amountRwf: number, reference: string) {
    if (!Number.isInteger(amountRwf) || amountRwf <= 0) throw new BadGatewayException('INVALID_AMOUNT');
    const data = await this.request('/transactions/cashin', {
      method: 'POST',
      headers: { 'Idempotency-Key': reference.slice(0, 32) },
      body: JSON.stringify({ amount: amountRwf, number: this.normalizeRwandaPhone(phone) }),
    });
    return { ref: data.ref ?? reference, status: this.normalizeStatus(data.status), amount: Number(data.amount ?? amountRwf), raw: data };
  }

  async cashout(phone: string, amountRwf: number, reference: string) {
    if (!Number.isInteger(amountRwf) || amountRwf <= 0) throw new BadGatewayException('INVALID_AMOUNT');
    const data = await this.request('/transactions/cashout', {
      method: 'POST',
      headers: { 'Idempotency-Key': reference.slice(0, 32) },
      body: JSON.stringify({ amount: amountRwf, number: this.normalizeRwandaPhone(phone) }),
    });
    return { ref: data.ref ?? reference, status: this.normalizeStatus(data.status), amount: Number(data.amount ?? amountRwf), raw: data };
  }

  async getTransaction(ref: string) {
    const data = await this.request('/transactions/find/' + encodeURIComponent(ref));
    return { ref: data.ref ?? ref, status: this.normalizeStatus(data.status), kind: data.kind, amount: Number(data.amount ?? 0), fee: Number(data.fee ?? 0), raw: data };
  }

  private normalizeStatus(value: any): string {
    const s = String(value ?? 'pending').toLowerCase();
    if (['successful', 'success', 'processed', 'completed', 'settled'].includes(s)) return 'successful';
    if (['failed', 'failure', 'rejected', 'cancelled', 'canceled', 'refunded'].includes(s)) return 'failed';
    return 'pending';
  }
}
