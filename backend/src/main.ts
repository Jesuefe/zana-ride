import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Open for local development across the mobile apps (Expo Go on your phone),
  // admin dashboard, and merchant portal. Tighten this to your real domains
  // once everything moves off localhost / your home network.
  app.enableCors({ origin: true, credentials: true });

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Zana API running on http://0.0.0.0:${port}/api/v1`);
}
bootstrap();
