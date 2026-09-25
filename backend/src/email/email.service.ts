import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

// Wraps Resend for transactional email. Two concrete uses right now:
// (1) email verification for customers whose phone number can't
// reliably receive SMS through Africa's Talking — foreign numbers
// aren't what AT's African-carrier routing is built for, so a
// traveller on their home-country SIM needs an alternative path in;
// (2) the admin Notifications feature, previously a UI shell with
// nothing behind it.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private client: Resend | null = null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.client = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY not set — emails will be logged, not sent');
    }
  }

  private get fromAddress(): string {
    return this.config.get<string>('RESEND_FROM') ?? 'Zana Ride <noreply@zanaride.rw>';
  }

  // Shared branded wrapper — a real letterhead (header bar, logo
  // mark, footer) rather than every email inventing its own bare
  // HTML. Anything passed as bodyHtml is dropped into the middle.
  private letterhead(bodyHtml: string): string {
    return `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff;">
        <div style="background: #00A082; padding: 28px 32px; text-align: center;">
          <span style="color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">ZANA RIDE</span>
        </div>
        <div style="padding: 32px; color: #1F2937; font-size: 15px; line-height: 1.6;">
          ${bodyHtml}
        </div>
        <div style="background: #F7F5EF; padding: 20px 32px; border-top: 3px solid #FFC244;">
          <p style="margin: 0; color: #6B7280; font-size: 12px;">
            Zana Ride &middot; Kigali, Rwanda<br />
            This email was sent by Zana Ride. If you weren't expecting it, you can safely ignore it.
          </p>
        </div>
      </div>`;
  }

  async send(to: string, subject: string, html: string, replyTo?: string): Promise<boolean> {
    if (!this.client) {
      this.logger.log(`[EMAIL DEV] To: ${to} | Subject: ${subject} (set RESEND_API_KEY to actually send)`);
      return false;
    }
    try {
      // Previously every send used the same "noreply" from address with
      // no reply-to at all — fine for a one-way OTP code, but a real
      // problem for anything expecting a reply (partnership outreach,
      // the admin "To Any Email" composer): the sender would have no
      // way to know their reply went nowhere. Falls back to a
      // configured default reply-to so this applies everywhere without
      // every caller needing to pass one explicitly.
      const finalReplyTo = replyTo || this.config.get<string>('RESEND_REPLY_TO');
      const replyToList = finalReplyTo ? finalReplyTo.split(',').map(s => s.trim()).filter(Boolean) : undefined;
      const { error } = await this.client.emails.send({
        from: this.fromAddress,
        to,
        subject,
        html,
        ...(replyToList && replyToList.length ? { replyTo: replyToList } : {}),
      });
      if (error) {
        this.logger.error(`Email to ${to} failed: ${error.message}`);
        return false;
      }
      return true;
    } catch (e: any) {
      this.logger.error(`Email to ${to} failed: ${e?.message}`);
      return false;
    }
  }

  async sendVerificationCode(to: string, code: string): Promise<boolean> {
    return this.send(
      to,
      'Your Zana verification code',
      this.letterhead(`
        <p>Your verification code is:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #00A082;">${code}</p>
        <p style="color: #6B7280; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
      `),
    );
  }

  // Admin's "compose to any email" tool — subject/body typed by the
  // admin, always wrapped in the same branded letterhead as every
  // other Zana email, rather than going out as bare unstyled text.
  async sendCustom(to: string, subject: string, message: string): Promise<boolean> {
    // Preserve line breaks from a plain-text textarea without letting
    // the admin's own text inject arbitrary HTML.
    const escaped = message
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />');
    return this.send(to, subject, this.letterhead(`<p>${escaped}</p>`));
  }
}
