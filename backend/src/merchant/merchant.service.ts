import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryStatus } from '@prisma/client';

@Injectable()
export class MerchantService {
  constructor(private prisma: PrismaService) {}

  async findByUserId(userId: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId } });
    if (!merchant) throw new NotFoundException('Merchant profile not found');
    return merchant;
  }

  async createDelivery(
    merchantId: string,
    data: { receiverName: string; receiverPhone: string; dropoffAddress: string; packageType: string; fee: number },
  ) {
    return this.prisma.delivery.create({ data: { merchantId, ...data, status: DeliveryStatus.REQUESTED } });
  }

  async listDeliveries(merchantId: string) {
    return this.prisma.delivery.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelDelivery(deliveryId: string, merchantId: string, reason?: string) {
    const delivery = await this.prisma.delivery.findFirst({ where: { id: deliveryId, merchantId } });
    if (!delivery) throw new NotFoundException('Delivery not found');

    const cancellable: DeliveryStatus[] = [
      DeliveryStatus.REQUESTED,
      DeliveryStatus.ACCEPTED,
      DeliveryStatus.SEARCHING_RIDER,
      DeliveryStatus.RIDER_ASSIGNED,
    ];
    if (!cancellable.includes(delivery.status)) {
      throw new BadRequestException('This delivery can no longer be cancelled');
    }

    return this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: DeliveryStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason?.trim() || null,
      },
    });
  }

  async updateStatus(deliveryId: string, status: DeliveryStatus) {
    return this.prisma.delivery.update({ where: { id: deliveryId }, data: { status } });
  }
}
