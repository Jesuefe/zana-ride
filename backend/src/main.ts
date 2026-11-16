import { NestFactory } from '@nestjs/core';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Behind cloudflared: trust one proxy hop so req.ip (used by the throttler) is the real client IP.
  (app as any).set('trust proxy', 1);
  // CSP disabled: the API serves small inline-script HTML pages (rider form / admin dashboard).
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

  // Base64 images can be large — allow up to 10MB per request.
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Set CORS_ORIGINS="https://a.com,https://b.com" in production to restrict browser origins.
  // Unset keeps the previous permissive behaviour so existing deployments don't break.
  const corsOrigins = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: corsOrigins.length ? corsOrigins : true, credentials: true });

  if (!process.env.SETTINGS_ENCRYPTION_KEY) {
    console.warn('[SECURITY] SETTINGS_ENCRYPTION_KEY is not set; encrypted settings and TOTP secrets fall back to JWT_SECRET. Set a dedicated key.');
  }

  const port = process.env.PORT ?? 4000;
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.listen(port, '0.0.0.0');
  console.log(`Zana API running on http://0.0.0.0:${port}/api/v1`);
}
bootstrap();
