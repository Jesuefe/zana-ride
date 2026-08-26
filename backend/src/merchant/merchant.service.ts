import { Injectable, NotFoundException } from '@nestjs/common';
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

  async updateStatus(deliveryId: string, status: DeliveryStatus) {
    return this.prisma.delivery.update({ where: { id: deliveryId }, data: { status } });
  }
}
