import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin wrapper over Africa's Talking so SMS has one home.
 * Silently no-ops when credentials are absent, and never throws —
 * a failed SMS must not take down the request that triggered it.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private config: ConfigService) {}

  async send(to: string, message: string): Promise<boolean> {
    const apiKey = this.config.get<string>('AT_API_KEY');
    const username = this.config.get<string>('AT_USERNAME');

    if (!apiKey || !username) {
      this.logger.warn(`SMS not configured — would have sent to ${to}: ${message.slice(0, 60)}`);
      return false;
    }

    try {
      const AfricasTalking = require('africastalking');
      const at = AfricasTalking({ apiKey, username });
      await at.SMS.send({ to: [to], message });
      this.logger.log(`SMS sent to ${to}`);
      return true;
    } catch (e: any) {
      this.logger.error(`SMS to ${to} failed: ${e?.message}`);
      return false;
    }
  }
}
