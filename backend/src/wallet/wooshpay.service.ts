import { Injectable, BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createHash, createDecipheriv } from 'crypto';

type WooshPayResponse = Record<string, any>;

@Injectable()
export class WooshPayService {
  private readonly testBaseUrl = 'https://apitest.wooshpay.com/v1';
  private readonly liveBaseUrl = 'https://api.wooshpay.com/v1';

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
      where: { entityType: 'PAYMENT_SETTINGS', entityId: 'WOOSHPAY', action: 'WOOSHPAY_SETTINGS_UPDATED' },
      orderBy: { createdAt: 'desc' },
    });
    const stored = row?.afterJson ? JSON.parse(row.afterJson) : null;
    const envKey = this.config.get<string>('WOOSHPAY_API_KEY') || '';
    const envWebhook = this.config.get<string>('WOOSHPAY_WEBHOOK_SECRET') || '';
    const environment = stored?.environment === 'production' ? 'production' : 'sandbox';
    return {
      enabled: stored?.enabled ?? Boolean(envKey),
      environment,
      apiKey: stored?.apiKeyEncrypted ? this.decrypt(stored.apiKeyEncrypted) : envKey,
      webhookSecret: stored?.webhookSecretEncrypted ? this.decrypt(stored.webhookSecretEncrypted) : envWebhook,
      baseUrl: String(stored?.baseUrl || (environment === 'production' ? this.liveBaseUrl : this.testBaseUrl)).replace(/\/$/, ''),
      provider: stored?.provider === 'airtel_rw' ? 'airtel_rw' : 'mtn_rw',
      minPayout: Math.max(980, Number(stored?.minPayout || 980)),
    };
  }

  async getMinimumWithdrawal() {
    const s = await this.settings();
    return s.minPayout;
  }

  async getPublicSettings() {
    const s = await this.settings();
    return {
      enabled: s.enabled,
      environment: s.environment,
      baseUrl: s.baseUrl,
      provider: s.provider,
      minPayout: s.minPayout,
      configured: Boolean(s.apiKey),
      apiKeyHint: s.apiKey ? s.apiKey.slice(0, 8) + '…' + s.apiKey.slice(-4) : null,
      webhookConfigured: Boolean(s.webhookSecret),
      capabilities: {
        currency: 'RWF',
        collection: true,
        payout: true,
        mobileMoney: ['mtn_rw', 'airtel_rw'],
        minimumPayout: 980,
        maximumPayout: 2000000,
      },
    };
  }

  async testConnection() {
    const s = await this.settings();
    if (!s.enabled || !s.apiKey) throw new ServiceUnavailableException('WOOSHPAY_NOT_CONFIGURED');

    // Validate authentication without creating a payment or payout. WooshPay
    // exposes PaymentIntent retrieval as a GET endpoint; an intentionally
    // nonexistent ID should return a normal authenticated API response.
    const auth = 'Basic ' + Buffer.from(s.apiKey + ':').toString('base64');
    const res = await fetch(s.baseUrl + '/payment_intents/zana_connection_test', {
      headers: { Authorization: auth, Accept: 'application/json' },
    });
    const raw = await res.text();
    let data: WooshPayResponse = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    // A 404 for this deliberately nonexistent ID still proves that the API
    // accepted the authenticated request. 401/403 and other failures do not.
    if (!res.ok && res.status !== 404) {
      throw new BadGatewayException(String(data?.message || data?.error || raw || 'WooshPay connection failed'));
    }
    return { ok: true, environment: s.environment, currency: 'RWF', provider: s.provider };
  }

  private async request(path: string, init: RequestInit = {}) {
    const s = await this.settings();
    if (!s.enabled || !s.apiKey) throw new ServiceUnavailableException('WOOSHPAY_NOT_CONFIGURED');
    const headers = new Headers(init.headers);
    headers.set('Authorization', 'Basic ' + Buffer.from(s.apiKey + ':').toString('base64'));
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    const res = await fetch(s.baseUrl + path, { ...init, headers });
    const raw = await res.text();
    let data: WooshPayResponse = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!res.ok) {
      throw new BadGatewayException(String(data?.message || data?.error || data?.error_description || raw || 'WooshPay request failed'));
    }
    return data;
  }

  private normalizeRwandaPhone(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('250')) digits = digits.slice(3);
    digits = digits.replace(/^0+/, '');
    if (digits.length !== 9) throw new BadGatewayException('INVALID_RW_PHONE');
    return '250' + digits;
  }

  async collectMobileMoney(phone: string, amountRwf: number, transactionRef: string, provider?: 'mtn_rw' | 'airtel_rw') {
    if (!Number.isInteger(amountRwf) || amountRwf < 980) throw new BadGatewayException('MIN_TOPUP:980');
    const msisdn = this.normalizeRwandaPhone(phone);
    const local = msisdn.slice(3);
    const detectedProvider = /^(078|079)/.test(local) ? 'mtn_rw' : /^(072|073)/.test(local) ? 'airtel_rw' : (provider || (await this.settings()).provider);
    const data = await this.request('/payment_intents', {
      method: 'POST',
      headers: { 'Idempotency-Key': transactionRef },
      body: JSON.stringify({
        amount: amountRwf,
        currency: 'RWF',
        confirm: true,
        payment_method_data: {
          type: 'mobile_money',
          mobile_money: {
            phone_number: msisdn,
            provider_code: detectedProvider as any,
          },
        },
        merchant_order_id: transactionRef,
        return_url: 'https://app.zanaride.rw/payment/complete',
      }),
    });
    return {
      ref: data.id ?? data.payment_intent ?? transactionRef,
      status: this.normalizeStatus(data.status),
      nextActionUrl: data?.next_action?.redirect_to_url?.url || null,
      raw: data,
    };
  }

  async getCollectionStatus(ref: string) {
    const data = await this.request('/payment_intents/' + encodeURIComponent(ref));
    return { ref, status: this.normalizeStatus(data.status), raw: data };
  }

  async payout(phone: string, amountRwf: number, reference: string, provider?: 'mtn_rw' | 'airtel_rw', name = 'ZANA Recipient') {
    if (!Number.isInteger(amountRwf) || amountRwf < 980) throw new BadGatewayException('MIN_PAYOUT:980');
    if (amountRwf > 2000000) throw new BadGatewayException('MAX_PAYOUT:2000000');
    const s = await this.settings();
    const data = await this.request('/payouts', {
      method: 'POST',
      headers: { 'Idempotency-Key': reference.replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 200) },
      body: JSON.stringify({
        payment_amount: amountRwf,
        source_amount: amountRwf,
        payment_currency: 'RWF',
        source_currency: 'RWF',
        beneficiary_data: {
          nickname: reference,
          destination_data: {
            destination_type: 'mobile_money',
            mobile_money: {
              msisdn: this.normalizeRwandaPhone(phone),
              provider: provider || s.provider,
              name,
            },
          },
        },
        merchant_payout_id: reference,
      }),
    });
    return { ref: data.id ?? data.payout_id ?? reference, status: this.normalizeStatus(data.status), raw: data };
  }

  async getPayoutStatus(ref: string) {
    const data = await this.request('/payouts/' + encodeURIComponent(ref));
    return { ref, status: this.normalizeStatus(data.status), raw: data };
  }

  private normalizeStatus(value: any): string {
    const s = String(value ?? 'pending').toLowerCase();
    if (['succeeded', 'success', 'successful', 'settled', 'completed', 'paid', 'received'].includes(s)) return 'successful';
    if (['failed', 'failure', 'reversed', 'cancelled', 'canceled', 'refunded'].includes(s)) return 'failed';
    return 'pending';
  }
}
