import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// A generic "send this SMS" service for admin-initiated messages —
// deliberately separate from auth.service.ts's own inline OTP-sending
// code, which stays exactly as it is (a proven, working flow with its
// own careful rate-limiting) rather than risk it by routing it through
// a new abstraction. Same Africa's Talking credentials, same provider,
// just a second, independent caller.
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private config: ConfigService) {}

  async send(phone: string, message: string): Promise<boolean> {
    const apiKey = this.config.get<string>('AT_API_KEY');
    const username = this.config.get<string>('AT_USERNAME');

    if (!apiKey || !username) {
      this.logger.log(`[SMS DEV] To: ${phone} | ${message} (set AT_API_KEY + AT_USERNAME to actually send)`);
      return false;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AfricasTalking = require('africastalking');
      const at = AfricasTalking({ apiKey, username });
      const senderId = this.config.get<string>('AT_SENDER_ID');
      const payload: any = { to: [phone], message };
      if (senderId && senderId.trim()) payload.from = senderId;
      await at.SMS.send(payload);
      return true;
    } catch (e: any) {
      this.logger.error(`SMS to ${phone} failed: ${e?.message}`);
      return false;
    }
  }
}
