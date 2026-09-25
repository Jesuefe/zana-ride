import { Global, Module } from '@nestjs/common';
import { PushService } from './push.service';
import { PushController } from './push.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
