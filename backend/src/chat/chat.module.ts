import { Module } from '@nestjs/common';
import { ChatController, AdminTripDetailController } from './chat.controller';
import { ChatService } from './chat.service';
import { TranslationService } from './translation.service';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [GatewayModule],
  controllers: [ChatController, AdminTripDetailController],
  providers: [ChatService, TranslationService],
  exports: [ChatService, TranslationService],
})
export class ChatModule {}
