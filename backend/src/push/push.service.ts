import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Push notifications via Firebase Cloud Messaging.
 *
 * Everything in Zana currently depends on the app being open — a rider misses
 * a job offer if their screen is off, a merchant misses an order. This closes
 * that gap.
 *
 * Silently does nothing when FCM is not configured, so the rest of the app
 * works unchanged until credentials are added.
 *
 * Environment:
 *   FCM_PROJECT_ID
 *   FCM_CLIENT_EMAIL     from the service account JSON
 *   FCM_PRIVATE_KEY      from the service account JSON, newlines as \n
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger('Push');
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  get isConfigured(): boolean {
    return Boolean(
      this.config.get('FCM_PROJECT_ID') &&
      this.config.get('FCM_CLIENT_EMAIL') &&
      this.config.get('FCM_PRIVATE_KEY'),
    );
  }

  /** Remember a device so we can reach it later. */
  async registerToken(userId: string, token: string, platform = 'android') {
    // A phone can change hands, so a token belongs to whoever registered it last.
    await this.prisma.pushToken.deleteMany({ where: { token } });
    return this.prisma.pushToken.create({
      data: { userId, token, platform } as any,
    });
  }

  async removeToken(token: string) {
    await this.prisma.pushToken.deleteMany({ where: { token } });
    return { removed: true };
  }

  /** Google OAuth token for the FCM v1 API, cached for its lifetime. */
  private async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken;

    const jwtLib = require('jsonwebtoken');
    const email = this.config.get<string>('FCM_CLIENT_EMAIL');
    const key = (this.config.get<string>('FCM_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n');

    const now = Math.floor(Date.now() / 1000);
    const assertion = jwtLib.sign(
      {
        iss: email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      },
      key,
      { algorithm: 'RS256' },
    );

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    const data: any = await res.json();
    if (!data?.access_token) throw new Error('FCM auth failed');

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken!;
  }

  /**
   * Send to every device a user has registered. Never throws — a failed push
   * must not break the request that triggered it.
   */
  async sendToUser(
    userId: string,
    notification: { title: string; body: string },
    data: Record<string, string> = {},
  ): Promise<{ sent: number }> {
    if (!this.isConfigured) return { sent: 0 };

    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return { sent: 0 };

    let sent = 0;
    try {
      const auth = await this.authenticate();
      const project = this.config.get<string>('FCM_PROJECT_ID');

      for (const t of tokens) {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${project}/messages:send`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${auth}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token: t.token,
                notification,
                data,
                android: {
                  priority: 'HIGH',
                  notification: { sound: 'default', channelId: 'zana' },
                },
              },
            }),
          },
        );

        if (res.ok) {
          sent++;
        } else if (res.status === 404 || res.status === 400) {
          // The app was uninstalled or the token rotated — stop trying.
          await this.prisma.pushToken.deleteMany({ where: { token: t.token } });
          this.logger.log(`Removed dead token for ${userId}`);
        }
      }
    } catch (e: any) {
      this.logger.error(`Push to ${userId} failed: ${e?.message}`);
    }

    return { sent };
  }

  /** Fan out to several people, e.g. every agent staffing a market. */
  async sendToUsers(
    userIds: string[],
    notification: { title: string; body: string },
    data: Record<string, string> = {},
  ) {
    const results = await Promise.all(
      userIds.map(id => this.sendToUser(id, notification, data)),
    );
    return { sent: results.reduce((s, r) => s + r.sent, 0) };
  }
}
