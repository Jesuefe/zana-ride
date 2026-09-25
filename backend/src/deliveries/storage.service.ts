import { Injectable, BadGatewayException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

// Wraps Bunny.net Storage. Package photos are short-lived by design — they
// exist so a driver knows what they're collecting, not as a permanent record —
// so they're deleted a week after the delivery is confirmed.
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private config: ConfigService) {}

  private get zone() {
    return this.config.get<string>('BUNNY_STORAGE_ZONE') ?? '';
  }

  private get accessKey() {
    return this.config.get<string>('BUNNY_ACCESS_KEY') ?? '';
  }

  private get host() {
    // Region-specific endpoints (e.g. ny.storage.bunnycdn.com) — falls back
    // to the default Falkenstein host when no region is configured.
    const region = this.config.get<string>('BUNNY_REGION');
    return region ? `https://${region}.storage.bunnycdn.com` : 'https://storage.bunnycdn.com';
  }

  private get publicBase() {
    // The pull-zone URL images are actually served from.
    return this.config.get<string>('BUNNY_PULL_ZONE_URL') ?? '';
  }

  get isConfigured() {
    return Boolean(this.zone && this.accessKey && this.publicBase);
  }

  // Accepts a base64 data URL from the client (already compressed browser-side)
  // and stores it, returning the public CDN URL.
  async uploadPackageImage(base64DataUrl: string): Promise<string | null> {
    if (!this.isConfigured) {
      this.logger.warn('Bunny.net storage not configured — skipping image upload');
      return null;
    }

    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(base64DataUrl);
    if (!match) throw new BadGatewayException('Invalid image data');

    const extension = match[1].split('/')[1].replace('jpeg', 'jpg');
    const buffer = Buffer.from(match[2], 'base64');
    const path = `packages/${randomUUID()}.${extension}`;

    const res = await fetch(`${this.host}/${this.zone}/${path}`, {
      method: 'PUT',
      headers: { AccessKey: this.accessKey, 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Bunny upload failed: ${res.status} ${body}`);
      throw new BadGatewayException('Could not upload the package image');
    }

    return `${this.publicBase.replace(/\/$/, '')}/${path}`;
  }


  // Generic image upload — used for merchant products, logos, avatars.
  // `folder` keeps things tidy in the storage zone (e.g. "products").
  async uploadImage(base64DataUrl: string, folder = 'uploads'): Promise<string | null> {
    if (!this.isConfigured) {
      this.logger.warn('Bunny.net storage not configured — skipping image upload');
      return null;
    }

    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(base64DataUrl);
    if (!match) throw new BadGatewayException('Invalid image data');

    const extension = match[1].split('/')[1].replace('jpeg', 'jpg');
    const buffer = Buffer.from(match[2], 'base64');
    const path = `${folder}/${randomUUID()}.${extension}`;

    const res = await fetch(`${this.host}/${this.zone}/${path}`, {
      method: 'PUT',
      headers: { AccessKey: this.accessKey, 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Bunny upload failed: ${res.status} ${body}`);
      throw new BadGatewayException('Could not upload the image');
    }

    const url = `${this.publicBase.replace(/\/$/, '')}/${path}`;
    this.logger.log(`[BUNNY] Uploaded ${path}`);
    return url;
  }

  async deleteByUrl(url: string): Promise<void> {
    if (!this.isConfigured || !url.startsWith(this.publicBase)) return;
    const path = url.slice(this.publicBase.replace(/\/$/, '').length + 1);

    const res = await fetch(`${this.host}/${this.zone}/${path}`, {
      method: 'DELETE',
      headers: { AccessKey: this.accessKey },
    });

    if (!res.ok && res.status !== 404) {
      this.logger.warn(`Bunny delete failed for ${path}: ${res.status}`);
    }
  }
}
