import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

/**
 * Pesapal — card and bank collections.
 *
 * Paypack covers MTN mobile money well but cannot take a Visa or Mastercard,
 * which matters for visitors to Kigali, corporate accounts and merchant
 * settlements. Pesapal fills that gap: Visa, Mastercard and mobile money,
 * settling to a bank account.
 *
 * This is a *collections* rail. Rider payouts stay on Paypack or MTN.
 *
 * Environment:
 *   PESAPAL_CONSUMER_KEY
 *   PESAPAL_CONSUMER_SECRET
 *   PESAPAL_ENV          "sandbox" or "live"
 *   PESAPAL_IPN_ID       returned when you register the callback URL
 *   PESAPAL_CALLBACK_URL where the customer lands after paying
 */
@Injectable()
export class PesapalService {
  private readonly logger = new Logger('Pesapal');
  private token: string | null = null;
  private tokenExpiry = 0;

  constructor(private config: ConfigService) {}

  private get consumerKey() {
    return this.config.get<string>('PESAPAL_CONSUMER_KEY') ?? '';
  }
  private get consumerSecret() {
    return this.config.get<string>('PESAPAL_CONSUMER_SECRET') ?? '';
  }
  private get baseUrl() {
    return (this.config.get<string>('PESAPAL_ENV') ?? 'sandbox') === 'live'
      ? 'https://pay.pesapal.com/v3'
      : 'https://cybqa.pesapal.com/pesapalv3';
  }
  private get ipnId() {
    return this.config.get<string>('PESAPAL_IPN_ID') ?? '';
  }
  private get callbackUrl() {
    return this.config.get<string>('PESAPAL_CALLBACK_URL')
      ?? 'https://zana-ride.pages.dev/payment/complete';
  }

  get isConfigured(): boolean {
    return Boolean(this.consumerKey && this.consumerSecret);
  }

  /** Pesapal tokens last five minutes; cache and refresh a little early. */
  private async authenticate(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) return this.token;

    const res = await fetch(`${this.baseUrl}/api/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        consumer_key: this.consumerKey,
        consumer_secret: this.consumerSecret,
      }),
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data?.token) {
      this.logger.error(`Auth failed: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
      throw new BadGatewayException('PESAPAL_AUTH_FAILED');
    }

    this.token = data.token;
    this.tokenExpiry = Date.now() + 4 * 60 * 1000;
    return this.token!;
  }

  /**
   * Register the notification URL. Run this once — Pesapal returns an IPN id
   * that every payment request must reference. Store it as PESAPAL_IPN_ID.
   */
  async registerIpn(url: string): Promise<{ ipn_id: string }> {
    const token = await this.authenticate();
    const res = await fetch(`${this.baseUrl}/api/URLSetup/RegisterIPN`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url, ipn_notification_type: 'GET' }),
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ipn_id) {
      throw new BadGatewayException(`IPN registration failed: ${JSON.stringify(data).slice(0, 200)}`);
    }
    this.logger.log(`IPN registered: ${data.ipn_id}`);
    return data;
  }

  /**
   * Start a payment. Returns a hosted checkout URL where the customer enters
   * their card or picks mobile money — Zana never touches card details, which
   * keeps PCI scope off our servers.
   */
  async createPayment(input: {
    amount: number;
    description: string;
    reference?: string;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ orderTrackingId: string; redirectUrl: string; reference: string }> {
    if (!this.isConfigured) throw new BadGatewayException('PESAPAL_NOT_CONFIGURED');

    const token = await this.authenticate();
    const reference = input.reference ?? randomUUID();

    const res = await fetch(`${this.baseUrl}/api/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: reference,
        currency: 'RWF',
        amount: input.amount,
        description: input.description.slice(0, 100),
        callback_url: this.callbackUrl,
        notification_id: this.ipnId,
        billing_address: {
          email_address: input.email ?? undefined,
          phone_number: input.phone ?? undefined,
          first_name: input.firstName ?? undefined,
          last_name: input.lastName ?? undefined,
        },
      }),
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data?.redirect_url) {
      this.logger.error(`Payment failed: ${JSON.stringify(data).slice(0, 300)}`);
      throw new BadGatewayException(
        `PESAPAL_PAYMENT_FAILED: ${data?.error?.message ?? 'unknown'}`,
      );
    }

    this.logger.log(`Payment ${reference} created — ${input.amount} RWF`);
    return {
      orderTrackingId: data.order_tracking_id,
      redirectUrl: data.redirect_url,
      reference,
    };
  }

  /** COMPLETED, FAILED, INVALID or PENDING. */
  async getStatus(orderTrackingId: string): Promise<{
    status: string;
    amount?: number;
    method?: string;
  }> {
    if (!this.isConfigured) return { status: 'PENDING' };

    try {
      const token = await this.authenticate();
      const res = await fetch(
        `${this.baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
        {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        },
      );

      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) return { status: 'PENDING' };

      // Pesapal returns both a numeric code and a description.
      // 0 = invalid, 1 = completed, 2 = failed, 3 = reversed.
      const code = Number(data?.status_code);
      const status =
        code === 1 ? 'COMPLETED'
        : code === 2 ? 'FAILED'
        : code === 3 ? 'REVERSED'
        : String(data?.payment_status_description ?? 'PENDING').toUpperCase();

      return {
        status,
        amount: data?.amount ? Number(data.amount) : undefined,
        method: data?.payment_method,
      };
    } catch {
      return { status: 'PENDING' };
    }
  }
}
