import { Module } from '@nestjs/common';
import { GatewayModule } from '../gateway/gateway.module';
import { SosController } from './sos.controller';

@Module({
  imports: [GatewayModule], controllers: [SosController] })
export class SosModule {}
