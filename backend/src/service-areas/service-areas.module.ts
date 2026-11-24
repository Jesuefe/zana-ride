import { Module } from '@nestjs/common';
import { ServiceAreasController } from './service-areas.controller';

@Module({ controllers: [ServiceAreasController] })
export class ServiceAreasModule {}
