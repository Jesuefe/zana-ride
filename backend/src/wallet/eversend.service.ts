import { Injectable, BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createHash, createCipheriv, randomBytes, createDecipheriv } from 'crypto';

type EversendResponse = Record<string, any>;

@Injectable()
export class EversendService {
  private readonly defaultBaseUrl = 'https://api.eversend.co/v1';

  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  private encryptionKey(): Buffer {
    const master = this.config.get<string>('SETTINGS_ENCRYPTION_KEY') || this.config.get<string>('JWT_SECRET');
    if (!master) throw new ServiceUnavailableException('SETTINGS_ENCRYPTION_KEY_NOT_CONFIGURED');
    return createHash('sha256').update(master).digest();
  }

  private decrypt(value: string): string {
    const [ivHex, tagHex, dataHex] = value.split(':');
    if (!ivHex || !tagHex || !dataHex) throw new ServiceUnavailableException('INVALID_ENCRYPTED_SETTING');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  }

  private async settings() {
    const row = await this.prisma.auditLog.findFirst({
      where: { entityType: 'PAYMENT_SETTINGS', entityId: 'EVERSEND', action: 'EVERSEND_SETTINGS_UPDATED' },
      orderBy: { createdAt: 'desc' },
    });
    const stored = row?.afterJson ? JSON.parse(row.afterJson) : null;
    const envKey = this.config.get<string>('EVERSEND_API_KEY') || '';
    const envWebhook = this.config.get<string>('EVERSEND_WEBHOOK_SECRET') || '';
    return {
      enabled: stored?.enabled ?? Boolean(envKey),
      environment: stored?.environment === 'production' ? 'production' : 'sandbox',
      apiKey: stored?.apiKeyEncrypted ? this.decrypt(stored.apiKeyEncrypted) : envKey,
      webhookSecret: stored?.webhookSecretEncrypted ? this.decrypt(stored.webhookSecretEncrypted) : envWebhook,
      baseUrl: String(stored?.baseUrl || this.config.get<string>('EVERSEND_BASE_URL') || this.defaultBaseUrl).replace(/\/$/, ''),
      rail: stored?.rail === 'airtel_money' ? 'airtel_money' : (this.config.get<string>('EVERSEND_RWF_RAIL') === 'airtel_money' ? 'airtel_money' : 'mtn_momo'),
      minWithdrawal: Math.max(1000, Number(stored?.minWithdrawal || 1000)),
    };
  }

  async getPublicSettings() {
    const s = await this.settings();
    return { enabled: s.enabled, environment: s.environment, baseUrl: s.baseUrl, rail: s.rail, minWithdrawal: s.minWithdrawal, configured: Boolean(s.apiKey), apiKeyHint: s.apiKey ? s.apiKey.slice(0, 8) + '…' + s.apiKey.slice(-4) : null, webhookConfigured: Boolean(s.webhookSecret) };
  }

  async testConnection() {
    const s = await this.settings();
    if (!s.enabled || !s.apiKey) throw new ServiceUnavailableException('EVERSEND_NOT_CONFIGURED');
    const res = await fetch(s.baseUrl + '/balances', { headers: { Authorization: 'Bearer ' + s.apiKey, Accept: 'application/json' } });
    const raw = await res.text();
    let data: EversendResponse = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch {}
    if (!res.ok) throw new BadGatewayException(String(data?.message || data?.error || raw || 'Eversend connection failed'));
    return { ok: true, environment: s.environment, currency: 'RWF', rail: s.rail };
  }

  private normalizeRwandaPhone(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('250')) digits = digits.slice(3);
    digits = digits.replace(/^0+/, '');
    if (digits.length !== 9) throw new BadGatewayException('INVALID_RW_PHONE');
    return '+250' + digits;
  }

  private async request(path: string, init: RequestInit = {}) {
    const s = await this.settings();
    if (!s.enabled || !s.apiKey) throw new ServiceUnavailableException('EVERSEND_NOT_CONFIGURED');
    const headers = new Headers(init.headers);
    headers.set('Authorization', 'Bearer ' + s.apiKey);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const res = await fetch(s.baseUrl + path, { ...init, headers });
    const raw = await res.text();
    let data: EversendResponse = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!res.ok) throw new BadGatewayException(String(data?.message || data?.error || raw || 'Eversend request failed'));
    return data;
  }

  async collectMobileMoney(phone: string, amountRwf: number, transactionRef: string) {
    const data = await this.request('/collections', {
      method: 'POST',
      headers: { 'Idempotency-Key': transactionRef },
      body: JSON.stringify({ amount: amountRwf, currency: 'RWF', method: 'mobile_money', from: this.normalizeRwandaPhone(phone), country: 'RW', reference: transactionRef }),
    });
    return { ref: data.id ?? data.ref ?? data.transactionRef ?? transactionRef, status: this.normalizeStatus(data.status ?? data.state), raw: data };
  }

  async getCollectionStatus(ref: string) {
    const data = await this.request('/collections/' + encodeURIComponent(ref));
    return { ref, status: this.normalizeStatus(data.status ?? data.state), raw: data };
  }

  async refundCollection(ref: string, amountRwf?: number) {
    const body: Record<string, any> = { collection_id: ref };
    if (amountRwf) { body.amount = amountRwf; body.currency = 'RWF'; }
    const data = await this.request('/refunds', { method: 'POST', body: JSON.stringify(body) });
    return { ref: data.id ?? data.ref ?? ref, status: this.normalizeStatus(data.status ?? data.state), raw: data };
  }

  async payout(phone: string, amountRwf: number, reference: string) {
    const s = await this.settings();
    const data = await this.request('/payouts', {
      method: 'POST',
      headers: { 'Idempotency-Key': reference.replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 200) },
      body: JSON.stringify({ amount: amountRwf, currency: 'RWF', rail: s.rail, recipient: { phone: this.normalizeRwandaPhone(phone) }, reference }),
    });
    return { ref: data.id ?? data.ref ?? reference, status: this.normalizeStatus(data.status ?? data.state), raw: data };
  }

  async getPayoutStatus(ref: string) {
    const data = await this.request('/payouts/' + encodeURIComponent(ref));
    return { ref, status: this.normalizeStatus(data.status ?? data.state), raw: data };
  }

  private normalizeStatus(value: any): string {
    const s = String(value ?? 'pending').toLowerCase();
    if (['success', 'successful', 'settled', 'completed', 'received', 'delivered'].includes(s)) return 'successful';
    if (['failed', 'failure', 'reversed', 'cancelled', 'canceled', 'refunded'].includes(s)) return 'failed';
    return 'pending';
  }
}
