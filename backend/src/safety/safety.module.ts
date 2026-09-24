import { Module } from '@nestjs/common';
import { SafetyController } from './safety.controller';

@Module({
  controllers: [SafetyController],
})
export class SafetyModule {}
