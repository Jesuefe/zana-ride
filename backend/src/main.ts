// Zana API entry point — webhook auto-deploy test (harmless comment, no functional change)
import { NestFactory } from '@nestjs/core';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Base64 images can be large — allow up to 10MB per request.
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: true, credentials: true });

  const port = process.env.PORT ?? 4000;
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.listen(port, '0.0.0.0');
  console.log(`Zana API running on http://0.0.0.0:${port}/api/v1`);
}
bootstrap();
