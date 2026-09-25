import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../deliveries/storage.service';
import { haversineKm } from '../trips/fare.util';

// Same shape as the merchant delivery fee so pricing stays consistent
// across the whole marketplace.
function calcDeliveryFee(distKm: number): number {
  const base = 700;
  const perKm = 250;
  return Math.max(700, Math.round((base + distKm * perKm) / 50) * 50);
}

@Injectable()
export class MarketsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // ── Customer-facing ───────────────────────────────────────────────────────

  // Markets a customer can shop from, with distance-based delivery fee.
  async listForCustomer(customerLat?: number, customerLng?: number) {
    const markets = await this.prisma.market.findMany({
      where: { active: true },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });

    return markets.map(m => {
      const distKm = (customerLat != null && customerLng != null)
        ? haversineKm(customerLat, customerLng, m.lat, m.lng)
        : 3;
      return {
        ...m,
        productCount: (m as any)._count?.products ?? 0,
        deliveryFee: calcDeliveryFee(distKm),
        distKm: Math.round(distKm * 10) / 10,
        distanceText: distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`,
        etaMinutes: m.prepMinutes + Math.round(distKm * 4),
      };
    });
  }

  async getMarketWithProducts(marketId: string) {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      include: {
        products: {
          where: { status: 'APPROVED', available: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!market) throw new NotFoundException('Market not found');
    return market;
  }

  // ── Agent-facing ──────────────────────────────────────────────────────────

  private async requireAgent(userId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { userId },
      include: { market: true },
    });
    if (!agent) throw new ForbiddenException('NOT_AN_AGENT');
    if (!agent.active) throw new ForbiddenException('AGENT_DEACTIVATED');
    if (!agent.marketId) throw new BadRequestException('AGENT_HAS_NO_MARKET');
    return agent;
  }

  async getMyMarket(userId: string) {
    const agent = await this.requireAgent(userId);
    return { agent, market: agent.market };
  }

  // Agents stock the market themselves — they walk the stalls and list
  // what is actually available today.
  async addProduct(userId: string, data: {
    name: string; description?: string; price: number; referenceCost?: number;
    imageBase64?: string; stock?: number;
  }) {
    const agent = await this.requireAgent(userId);

    let imageUrl: string | undefined;
    if (data.imageBase64) {
      try {
        const uploaded = await this.storage.uploadImage(data.imageBase64, 'market-products');
        if (uploaded) imageUrl = uploaded;
      } catch (e: any) {
        console.error('[MARKET] Product image upload failed:', e?.message);
      }
    }

    return this.prisma.product.create({
      data: {
        marketId: agent.marketId!,
        name: data.name,
        description: data.description,
        price: data.price,
        referenceCost: data.referenceCost,
        category: 'GOODS',
        imageUrl,
        stock: data.stock ?? 0,
        status: 'APPROVED', // agents are trusted staff, no admin review needed
      } as any,
    });
  }

  async getMyProducts(userId: string) {
    const agent = await this.requireAgent(userId);
    return this.prisma.product.findMany({
      where: { marketId: agent.marketId! },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateProduct(userId: string, productId: string, data: any) {
    const agent = await this.requireAgent(userId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, marketId: agent.marketId! },
    });
    if (!product) throw new NotFoundException('Product not found in your market');
    return this.prisma.product.update({ where: { id: productId }, data });
  }

  async deleteProduct(userId: string, productId: string) {
    const agent = await this.requireAgent(userId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, marketId: agent.marketId! },
    });
    if (!product) throw new NotFoundException('Product not found in your market');
    return this.prisma.product.delete({ where: { id: productId } });
  }

  // The agent's queue — everything customers have ordered from this market.
  async getMyOrders(userId: string) {
    const agent = await this.requireAgent(userId);
    return this.prisma.order.findMany({
      where: { marketId: agent.marketId! },
      include: {
        items: { include: { product: true } },
        customer: { select: { firstName: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async updateOrderStatus(
    userId: string,
    orderId: string,
    status: string,
    actualPrices?: Record<string, number>,
  ) {
    const agent = await this.requireAgent(userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, marketId: agent.marketId! },
    });
    if (!order) throw new NotFoundException('Order not found in your market');

    // Recorded whenever the agent actually provides it — most naturally
    // when marking items picked up, once they know what they genuinely
    // paid at the stall. This is what the margin split at completion
    // actually keys off; without it, there's nothing to distinguish a
    // negotiated saving from the reference stall price at all.
    if (actualPrices) {
      for (const [orderItemId, actualPurchasePrice] of Object.entries(actualPrices)) {
        await this.prisma.orderItem.updateMany({
          where: { id: orderItemId, orderId },
          data: { actualPurchasePrice },
        });
      }
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: status as any, agentId: agent.id } as any,
    });
  }
}
