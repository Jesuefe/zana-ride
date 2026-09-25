import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { ChatService } from './chat.service';
import { TranslationService } from './translation.service';
import type { Lang } from './translation.service';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private chatService: ChatService,
    private translationService: TranslationService,
  ) {}

  @Post(':context/:id')
  async send(
    @CurrentUser() user: JwtPayload,
    @Param('context') context: 'trip' | 'delivery',
    @Param('id') id: string,
    @Body() body: { content: string; senderLang?: Lang },
  ) {
    return this.chatService.sendMessage({
      senderId: user.sub,
      tripId: context === 'trip' ? id : undefined,
      deliveryId: context === 'delivery' ? id : undefined,
      content: body.content,
      senderLang: body.senderLang ?? 'en',
    });
  }

  @Get(':context/:id')
  async getMessages(
    @Param('context') context: 'trip' | 'delivery',
    @Param('id') id: string,
    @Query('lang') lang: Lang = 'en',
  ) {
    return this.chatService.getMessages(context, id, lang);
  }

  // Returns the full nav phrase dictionary for the requested language —
  // the driver app loads this once and uses it to translate all UI text
  // without making individual API calls.
  @Get('phrases/:lang')
  getPhrases(@Param('lang') lang: Lang) {
    return this.translationService.getAllPhrases(lang);
  }
}

@Controller('admin/trips')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminTripDetailController {
  constructor(private chatService: ChatService) {}

  @Get(':id/detail')
  getTripDetail(@Param('id') id: string) {
    return this.chatService.getAdminTripDetail(id);
  }
}
