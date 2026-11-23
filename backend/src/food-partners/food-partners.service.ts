import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException, ForbiddenException, TooManyRequestsException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { DeliveryStatus, PackageWeight } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveriesService } from '../deliveries/deliveries.service';

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');
const newApiKey = () => `zana_live_${randomBytes(32).toString('base64url')}`;

@Injectable()
export class FoodPartnersService {
  async registerPortalAccount(input: { businessName: string; email: string; phone: string; password: string; contactName?: string }) {
    const businessName = String(input.businessName || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const phone = String(input.phone || '').trim();
    const password = String(input.password || '');
    if (!businessName || businessName.length > 120) throw new BadRequestException('BUSINESS_NAME_REQUIRED_MAX_120');
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) throw new BadRequestException('VALID_EMAIL_REQUIRED');
    if (phone.replace(/\\D/g, '').length < 9) throw new BadRequestException('VALID_PHONE_REQUIRED');
    if (password.length < 10) throw new BadRequestException('PASSWORD_MINIMUM_10_CHARACTERS');
    const passwordHash = await bcrypt.hash(password, 12);
    const apiKey = newApiKey();
    try {
      const partner = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            phone, email, password: passwordHash,
            firstName: input.contactName?.trim() || businessName,
            role: 'CUSTOMER',
            status: 'ACTIVE',
          },
        });
        return tx.foodDeliveryPartner.create({
          data: {
            userId: user.id, name: businessName, contactEmail: email, status: 'PENDING',
            apiKeyHash: hashKey(apiKey), apiKeyPrefix: apiKey.slice(0, 18),
          },
          select: { id: true, name: true, contactEmail: true, status: true, balance: true, apiKeyPrefix: true, createdAt: true },
        });
      });
      return { partner, message: 'Application received. Zana will review your business before API access is activated.' };
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('EMAIL_OR_PHONE_ALREADY_REGISTERED');
      throw error;
    }
  }

  async portalPartner(userId: string) {
    const partner = await this.prisma.foodDeliveryPartner.findUnique({
      where: { userId },
      select: { id: true, name: true, contactEmail: true, status: true, balance: true, apiKeyPrefix: true, createdAt: true },
    });
    if (!partner) throw new ForbiddenException('BUSINESS_PARTNER_ACCOUNT_REQUIRED');
    return partner;
  }

  async portalOverview(userId: string) {
    const partner = await this.portalPartner(userId);
    const [totalDeliveries, statusCounts, spend, recentDeliveries, recentTransactions] = await Promise.all([
      this.prisma.delivery.count({ where: { partnerId: partner.id } }),
      this.prisma.delivery.groupBy({ by: ['status'], where: { partnerId: partner.id }, _count: { _all: true } }),
      this.prisma.partnerWalletTransaction.aggregate({ where: { partnerId: partner.id, amount: { lt: 0 } }, _sum: { amount: true } }),
      this.prisma.delivery.findMany({ where: { partnerId: partner.id }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, partnerOrderRef: true, trackingCode: true, status: true, fee: true, createdAt: true, pickupAddress: true, dropoffAddress: true } }),
      this.prisma.partnerWalletTransaction.findMany({ where: { partnerId: partner.id }, orderBy: { createdAt: 'desc' }, take: 5, select: { amount: true, balanceAfter: true, reference: true, description: true, createdAt: true } }),
    ]);
    return {
      partner, currency: 'RWF', totalDeliveries,
      totalSpent: Math.abs(spend._sum.amount || 0),
      statusCounts: Object.fromEntries(statusCounts.map(item => [item.status, item._count._all])),
      recentDeliveries, recentTransactions,
    };
  }

  async portalDeliveries(userId: string, limit = 50) {
    const partner = await this.portalPartner(userId);
    const safeLimit = Math.min(100, Math.max(1, Number.isInteger(limit) ? limit : 50));
    return this.prisma.delivery.findMany({
      where: { partnerId: partner.id }, orderBy: { createdAt: 'desc' }, take: safeLimit,
      select: { id: true, partnerOrderRef: true, trackingCode: true, status: true, fee: true, distanceKm: true, paid: true, pickupAddress: true, dropoffAddress: true, receiverName: true, createdAt: true, assignedAt: true, pickedUpAt: true, deliveredAt: true },
    });
  }

  async portalRotateKey(userId: string) {
    const partner = await this.portalPartner(userId);
    if (partner.status !== 'ACTIVE') throw new ForbiddenException('PARTNER_NOT_ACTIVE');
    return this.rotateKey(partner.id);
  }

  constructor(private prisma: PrismaService, private deliveries: DeliveriesService) {}

  async createPartner(input: { name: string; contactEmail?: string }) {
    if (!input.name?.trim()) throw new BadRequestException('PARTNER_NAME_REQUIRED');
    const apiKey = newApiKey();
    const partner = await this.prisma.foodDeliveryPartner.create({
      data: {
        name: input.name.trim(),
        contactEmail: input.contactEmail?.trim() || null,
        apiKeyHash: hashKey(apiKey),
        apiKeyPrefix: apiKey.slice(0, 18),
      },
      select: { id: true, name: true, contactEmail: true, status: true, balance: true, apiKeyPrefix: true, createdAt: true },
    });
    // The raw API key is returned once only. Only its SHA-256 hash is persisted.
    return { partner, apiKey };
  }

  async listPartners() {
    return this.prisma.foodDeliveryPartner.findMany({
      select: { id: true, name: true, contactEmail: true, status: true, balance: true, apiKeyPrefix: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async rotateKey(partnerId: string) {
    const apiKey = newApiKey();
    const result = await this.prisma.foodDeliveryPartner.updateMany({
      where: { id: partnerId },
      data: { apiKeyHash: hashKey(apiKey), apiKeyPrefix: apiKey.slice(0, 18) },
    });
    if (!result.count) throw new NotFoundException('PARTNER_NOT_FOUND');
    return { apiKey };
  }

  async setPartnerStatus(partnerId: string, status: 'ACTIVE' | 'SUSPENDED') {
    const result = await this.prisma.foodDeliveryPartner.updateMany({ where: { id: partnerId }, data: { status } });
    if (!result.count) throw new NotFoundException('PARTNER_NOT_FOUND');
    return { id: partnerId, status };
  }

  async topUp(partnerId: string, amount: number, reference?: string) {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new BadRequestException('TOP_UP_AMOUNT_MUST_BE_POSITIVE_INTEGER_RWF');
    return this.prisma.$transaction(async (tx) => {
      const partner = await tx.foodDeliveryPartner.findUnique({ where: { id: partnerId } });
      if (!partner) throw new NotFoundException('PARTNER_NOT_FOUND');
      const updated = await tx.foodDeliveryPartner.update({
        where: { id: partnerId }, data: { balance: { increment: amount } },
        select: { balance: true },
      });
      await tx.partnerWalletTransaction.create({
        data: {
          partnerId, amount, balanceBefore: partner.balance, balanceAfter: updated.balance,
          reference: reference?.trim() || null, description: 'Admin prepaid wallet top-up',
        },
      });
      return { partnerId, balance: updated.balance, credited: amount, currency: 'RWF' };
    });
  }

  quote(input: { pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number }) {
    this.validateCoordinates(input.pickupLat, input.pickupLng, 'PICKUP');
    this.validateCoordinates(input.dropoffLat, input.dropoffLng, 'DROPOFF');
    return { ...this.deliveries.quote(input.pickupLat, input.pickupLng, input.dropoffLat, input.dropoffLng, PackageWeight.UNDER_1KG), currency: 'RWF', vehicleType: 'MOTO' };
  }

  async createDelivery(partnerId: string, input: {
    partnerOrderRef: string; itemDescription?: string;
    pickupAddress: string; pickupLat: number; pickupLng: number;
    dropoffAddress: string; dropoffLat: number; dropoffLng: number;
    receiverName?: string; receiverPhone: string;
  }) {
    if (!input.partnerOrderRef?.trim() || input.partnerOrderRef.length > 100) throw new BadRequestException('PARTNER_ORDER_REF_REQUIRED_MAX_100');
    if (!input.pickupAddress?.trim() || !input.dropoffAddress?.trim()) throw new BadRequestException('PICKUP_AND_DROPOFF_ADDRESSES_REQUIRED');
    if (!input.receiverPhone?.trim() || input.receiverPhone.replace(/\\D/g, '').length < 9) throw new BadRequestException('INVALID_RECEIVER_PHONE');
    this.validateCoordinates(input.pickupLat, input.pickupLng, 'PICKUP');
    this.validateCoordinates(input.dropoffLat, input.dropoffLng, 'DROPOFF');

    const existing = await this.prisma.delivery.findUnique({
      where: { partnerId_partnerOrderRef: { partnerId, partnerOrderRef: input.partnerOrderRef.trim() } },
    });
    if (existing) return this.deliveryResponse(existing, true);

    const quote = this.quote(input);
    try {
      const delivery = await this.prisma.$transaction(async (tx) => {
        const partner = await tx.foodDeliveryPartner.findUnique({ where: { id: partnerId } });
        if (!partner || partner.status !== 'ACTIVE') throw new NotFoundException('PARTNER_INACTIVE');
        const debit = await tx.foodDeliveryPartner.updateMany({
          where: { id: partnerId, status: 'ACTIVE', balance: { gte: quote.fee } },
          data: { balance: { decrement: quote.fee } },
        });
        if (debit.count !== 1) throw new ConflictException('INSUFFICIENT_PARTNER_WALLET_BALANCE');
        const delivery = await tx.delivery.create({
          data: {
            partnerId,
            partnerOrderRef: input.partnerOrderRef.trim(),
            itemDescription: input.itemDescription?.trim() || `Food order ${input.partnerOrderRef.trim()}`,
            weight: PackageWeight.UNDER_1KG,
            pickupAddress: input.pickupAddress.trim(),
            pickupLat: input.pickupLat,
            pickupLng: input.pickupLng,
            dropoffAddress: input.dropoffAddress.trim(),
            dropoffLat: input.dropoffLat,
            dropoffLng: input.dropoffLng,
            receiverName: input.receiverName?.trim() || null,
            receiverPhone: input.receiverPhone.trim(),
            distanceKm: quote.distanceKm,
            fee: quote.fee,
            paid: true,
            paymentMethod: 'PARTNER_WALLET',
            status: DeliveryStatus.REQUESTED,
            trackingCode: `ZFD-${randomBytes(5).toString('hex').toUpperCase()}`,
          },
        });
        await tx.partnerWalletTransaction.create({
          data: {
            partnerId, deliveryId: delivery.id, amount: -quote.fee,
            balanceBefore: partner.balance, balanceAfter: partner.balance - quote.fee,
            reference: input.partnerOrderRef.trim(), description: 'Food delivery dispatch fee',
          },
        });
        return delivery;
      });
      return this.deliveryResponse(delivery, false);
    } catch (error: any) {
      // A duplicate request racing with the first is idempotent: it returns the original delivery and never double-debits.
      if (error?.code === 'P2002') {
        const duplicate = await this.prisma.delivery.findUnique({
          where: { partnerId_partnerOrderRef: { partnerId, partnerOrderRef: input.partnerOrderRef.trim() } },
        });
        if (duplicate) return this.deliveryResponse(duplicate, true);
      }
      throw error;
    }
  }

  async getDelivery(partnerId: string, deliveryId: string) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id: deliveryId, partnerId },
      include: { driver: { select: { id: true, user: { select: { firstName: true, phone: true } } } } },
    });
    if (!delivery) throw new NotFoundException('DELIVERY_NOT_FOUND');
    return {
      id: delivery.id, partnerOrderRef: delivery.partnerOrderRef, trackingCode: delivery.trackingCode,
      status: delivery.status, fee: delivery.fee, currency: 'RWF', paid: delivery.paid,
      pickupAddress: delivery.pickupAddress, dropoffAddress: delivery.dropoffAddress,
      createdAt: delivery.createdAt, assignedAt: delivery.assignedAt,
      pickedUpAt: delivery.pickedUpAt, deliveredAt: delivery.deliveredAt,
      driver: delivery.driver ? { name: delivery.driver.user.firstName, phone: delivery.driver.user.phone } : null,
    };
  }

  async cancelDelivery(partnerId: string, deliveryId: string) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.findFirst({ where: { id: deliveryId, partnerId } });
      if (!delivery) throw new NotFoundException('DELIVERY_NOT_FOUND');
      if (delivery.status !== DeliveryStatus.REQUESTED || delivery.driverId) throw new ConflictException('DELIVERY_ALREADY_DISPATCHED_OR_IN_PROGRESS');
      const changed = await tx.delivery.updateMany({
        where: { id: deliveryId, partnerId, status: DeliveryStatus.REQUESTED, driverId: null },
        data: { status: DeliveryStatus.CANCELLED },
      });
      if (!changed.count) throw new ConflictException('DELIVERY_STATE_CHANGED_RETRY');
      const partner = await tx.foodDeliveryPartner.findUnique({ where: { id: partnerId } });
      if (!partner) throw new NotFoundException('PARTNER_NOT_FOUND');
      const updated = await tx.foodDeliveryPartner.update({ where: { id: partnerId }, data: { balance: { increment: delivery.fee } }, select: { balance: true } });
      await tx.partnerWalletTransaction.create({
        data: {
          partnerId, amount: delivery.fee, balanceBefore: partner.balance,
          balanceAfter: updated.balance, reference: delivery.partnerOrderRef,
          description: 'Refund for cancelled undispached delivery',
        },
      });
      return { id: deliveryId, status: DeliveryStatus.CANCELLED, refunded: delivery.fee, balance: updated.balance, currency: 'RWF' };
    });
  }

  async wallet(partnerId: string) {
    const partner = await this.prisma.foodDeliveryPartner.findUnique({
      where: { id: partnerId },
      select: { balance: true, status: true, name: true },
    });
    if (!partner) throw new NotFoundException('PARTNER_NOT_FOUND');
    return { partner: partner.name, status: partner.status, balance: partner.balance, currency: 'RWF' };
  }

  async transactions(partnerId: string) {
    return this.prisma.partnerWalletTransaction.findMany({
      where: { partnerId }, orderBy: { createdAt: 'desc' }, take: 100,
      select: { amount: true, balanceBefore: true, balanceAfter: true, reference: true, description: true, createdAt: true },
    });
  }

  private validateCoordinates(lat: number, lng: number, label: string) {
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new BadRequestException(`INVALID_${label}_COORDINATES`);
    }
  }

  private deliveryResponse(delivery: any, duplicate: boolean) {
    return {
      id: delivery.id, partnerOrderRef: delivery.partnerOrderRef,
      trackingCode: delivery.trackingCode, status: delivery.status,
      fee: delivery.fee, currency: 'RWF', paid: delivery.paid,
      duplicate, createdAt: delivery.createdAt,
    };
  }
}

@Injectable()
export class FoodPartnerApiKeyGuard {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: any) {
    const request = context.switchToHttp().getRequest();
    const rawKey = request.headers['x-zana-api-key'];
    if (typeof rawKey !== 'string' || !rawKey.startsWith('zana_live_')) {
      throw new UnauthorizedException('INVALID_API_KEY');
    }
    const partner = await this.prisma.foodDeliveryPartner.findUnique({
      where: { apiKeyHash: hashKey(rawKey) },
      select: { id: true, status: true },
    });
    if (!partner || partner.status !== 'ACTIVE') {
      throw new UnauthorizedException('INVALID_API_KEY');
    }
    request.foodPartner = partner;
    return true;
  }
}
