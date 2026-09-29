import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TranslationService, Lang } from './translation.service';
import { ZanaGateway } from '../gateway/zana.gateway';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private translationService: TranslationService,
    private gateway: ZanaGateway,
  ) {}

  async sendMessage(data: {
    senderId: string;
    tripId?: string;
    deliveryId?: string;
    content: string;
    senderLang: Lang;
  }) {
    if (!data.tripId && !data.deliveryId) {
      throw new Error('Either tripId or deliveryId is required');
    }

    // Translate immediately so the recipient always sees their language
    // without waiting for a separate API call.
    const translations = await this.translationService.translateAll(data.content, data.senderLang);

    const message = await this.prisma.chatMessage.create({
      data: {
        senderId: data.senderId,
        tripId: data.tripId,
        deliveryId: data.deliveryId,
        content: data.content,
        originalLang: data.senderLang,
        translatedEn: translations.en,
        translatedFr: translations.fr,
        translatedRw: translations.rw,
        hiddenFromUsers: false,
      },
      include: { sender: { select: { id: true, firstName: true, role: true } } },
    });

    // Previously there was no real-time push for chat at all — the
    // other party only ever saw a new message if they happened to have
    // the chat panel open already, since it only polled while mounted.
    // Closing the panel meant zero indication anything arrived: no
    // badge, no sound, nothing. This is what lets the trip page itself
    // (not just the chat panel) know a message came in, so it can show
    // an unread badge regardless of whether the panel is open.
    const recipientId = await this.resolveRecipientId(data);
    if (recipientId) {
      this.gateway.sendToUser(recipientId, 'chat:message', {
        tripId: data.tripId,
        deliveryId: data.deliveryId,
        senderId: data.senderId,
        senderName: message.sender.firstName,
        preview: data.content,
      });
    }

    return message;
  }

  private async resolveRecipientId(data: { senderId: string; tripId?: string; deliveryId?: string }): Promise<string | null> {
    if (data.tripId) {
      const trip = await this.prisma.trip.findUnique({
        where: { id: data.tripId },
        select: { customerId: true, driver: { select: { userId: true } } },
      });
      if (!trip) return null;
      return trip.customerId === data.senderId ? (trip.driver?.userId ?? null) : trip.customerId;
    }
    if (data.deliveryId) {
      const delivery = await this.prisma.delivery.findUnique({
        where: { id: data.deliveryId },
        select: {
          customerId: true,
          driver: { select: { userId: true } },
          order: { select: { agent: { select: { userId: true } } } },
        },
      });
      if (!delivery) return null;

      // Market deliveries are a private operational conversation between
      // the market agent and the rider. Do not route those messages to the
      // customer or expose the customer's delivery details to the rider.
      const agentId = delivery.order?.agent?.userId ?? null;
      if (agentId) {
        return data.senderId === agentId
          ? (delivery.driver?.userId ?? null)
          : data.senderId === delivery.driver?.userId
            ? agentId
            : null;
      }

      return data.senderId === delivery.customerId ? (delivery.driver?.userId ?? null) : delivery.customerId;
    }
    return null;
  }

  async getMessages(context: 'trip' | 'delivery', contextId: string, lang: Lang = 'en', adminView = false, userId?: string) {
    const where = context === 'trip'
      ? { tripId: contextId }
      : { deliveryId: contextId };

    if (!adminView && userId) {
      const allowed = await this.isParticipant(context, contextId, userId);
      if (!allowed) throw new ForbiddenException('You are not a participant in this chat');
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: adminView ? where : { ...where, hiddenFromUsers: false },
      include: { sender: { select: { id: true, firstName: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Return the translation matching the requesting user's language.
    return messages.map(m => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.sender.firstName ?? 'User',
      senderRole: m.sender.role,
      content: this.getTranslation(m, lang),
      originalContent: m.content,
      originalLang: m.originalLang,
      createdAt: m.createdAt,
    }));
  }

  private async isParticipant(context: 'trip' | 'delivery', contextId: string, userId: string): Promise<boolean> {
    if (context === 'trip') {
      const trip = await this.prisma.trip.findUnique({
        where: { id: contextId },
        select: { customerId: true, driver: { select: { userId: true } } },
      });
      return !!trip && (trip.customerId === userId || trip.driver?.userId === userId);
    }

    const delivery = await this.prisma.delivery.findUnique({
      where: { id: contextId },
      select: {
        customerId: true,
        driver: { select: { userId: true } },
        order: { select: { agent: { select: { userId: true } } } },
      },
    });
    if (!delivery) return false;

    const agentId = delivery.order?.agent?.userId ?? null;
    if (agentId) {
      return delivery.driver?.userId === userId || agentId === userId;
    }
    return delivery.customerId === userId || delivery.driver?.userId === userId;
  }

  private getTranslation(message: any, lang: Lang): string {
    if (lang === 'fr' && message.translatedFr) return message.translatedFr;
    if (lang === 'rw' && message.translatedRw) return message.translatedRw;
    return message.translatedEn ?? message.content;
  }

  // Called when a ride/delivery ends — hides messages from users but keeps
  // them permanently for admin review.
  async archiveMessages(context: 'trip' | 'delivery', contextId: string) {
    const where = context === 'trip'
      ? { tripId: contextId }
      : { deliveryId: contextId };

    return this.prisma.chatMessage.updateMany({
      where,
      data: { hiddenFromUsers: true },
    });
  }

  async getAdminTripDetail(tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        driver: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
        messages: {
          include: { sender: { select: { firstName: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
        ratings: true,
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }
}
