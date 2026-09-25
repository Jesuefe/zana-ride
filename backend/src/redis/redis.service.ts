import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.client = new Redis(redisUrl);
    this.client.on('error', (err) => console.error('[Redis]', err));
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) return this.client.setex(key, ttlSeconds, value);
    return this.client.set(key, value);
  }

  async get(key: string) {
    return this.client.get(key);
  }

  async del(key: string) {
    return this.client.del(key);
  }

  // Atomic increment — genuinely needed for rate limiting (OTP verify
  // attempts, etc.), where a naive get-then-set in application code
  // would have a real race under concurrent requests and quietly
  // undercount the very abuse it's meant to catch.
  async incr(key: string, ttlSeconds?: number) {
    const value = await this.client.incr(key);
    if (value === 1 && ttlSeconds) await this.client.expire(key, ttlSeconds);
    return value;
  }

  async publish(channel: string, message: string) {
    return this.client.publish(channel, message);
  }
}
