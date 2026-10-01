import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { ZanaAiService } from './zana-ai.service';

@Controller('zana-ai')
@UseGuards(JwtAuthGuard)
export class ZanaAiController {
  constructor(private readonly ai: ZanaAiService) {}

  @Post('chat')
  chat(
    @CurrentUser() user: JwtPayload,
    @Body() body: {
      message: string;
      history?: Array<{ role: 'user' | 'model'; text: string }>;
      location?: { lat: number; lng: number; address?: string };
    },
  ) {
    return this.ai.chat(user.sub, body.message, body.history ?? [], body.location);
  }

  @Post('market/execute')
  executeMarketDraft(
    @CurrentUser() user: JwtPayload,
    @Body() body: { draftId: string; paymentMethod?: 'WALLET' | 'MOBILE_MONEY' },
  ) {
    return this.ai.executeMarketDraft(user.sub, body.draftId, body.paymentMethod ?? 'WALLET');
  }
}
