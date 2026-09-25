import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Ambiguous characters (0/O, 1/I/L) are left out so codes read cleanly over
// the phone or in a WhatsApp message without being mistyped.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 5;
const DEFAULT_TTL_MINUTES = 15;

@Injectable()
export class LocationCodeService {
  constructor(private prisma: PrismaService) {}

  private generateCode(): string {
    let out = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return `ZANA-${out}`;
  }

  // Creates a short-lived code standing in for the caller's exact position.
  // Codes are single-use and expire, so sharing one doesn't hand over an
  // open-ended window into someone's whereabouts.
  async create(data: { lat: number; lng: number; address?: string; createdBy?: string; ttlMinutes?: number }) {
    const ttl = data.ttlMinutes ?? DEFAULT_TTL_MINUTES;

    // Retry on the (very unlikely) chance of a collision with a live code.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.generateCode();
      const existing = await this.prisma.locationCode.findUnique({ where: { code } });
      if (existing) continue;

      return this.prisma.locationCode.create({
        data: {
          code,
          lat: data.lat,
          lng: data.lng,
          address: data.address,
          createdBy: data.createdBy,
          expiresAt: new Date(Date.now() + ttl * 60 * 1000),
        },
      });
    }
    throw new BadRequestException('Could not generate a location code, please try again');
  }

  // Looks up a code without consuming it, so the sender can preview the
  // location on the map before committing to the delivery.
  async resolve(rawCode: string) {
    const code = this.normalize(rawCode);
    const entry = await this.prisma.locationCode.findUnique({ where: { code } });

    if (!entry) throw new NotFoundException('That location code was not found');
    if (entry.usedAt) throw new BadRequestException('That location code has already been used');
    if (entry.expiresAt < new Date()) throw new BadRequestException('That location code has expired');

    return { code: entry.code, lat: entry.lat, lng: entry.lng, address: entry.address, expiresAt: entry.expiresAt };
  }

  // Marks a code as spent — called once a delivery actually uses it.
  async consume(rawCode: string) {
    const code = this.normalize(rawCode);
    await this.resolve(code); // re-validates expiry/usage
    return this.prisma.locationCode.update({ where: { code }, data: { usedAt: new Date() } });
  }

  // Accepts "zana-8xk29", "8XK29", or "ZANA-8XK29" — people retype these
  // from messages, so be forgiving about case and the prefix.
  private normalize(raw: string): string {
    const cleaned = raw.trim().toUpperCase().replace(/\s/g, '');
    return cleaned.startsWith('ZANA-') ? cleaned : `ZANA-${cleaned}`;
  }
}
