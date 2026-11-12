import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../deliveries/storage.service';
import { ProductStatus, MerchantCategory } from '@prisma/client';

@Injectable()
export class MerchantService {
  constructor(
    private storage: StorageService,
    private prisma: PrismaService) {}

  async findByUserId(userId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { user: { include: { wallet: true } } },
    });
    if (!merchant) throw new NotFoundException('Merchant profile not found');
    return merchant;
  }

  async createProduct(merchantId: string, data: {
    name: string;
    description?: string;
    price: number;
    category: MerchantCategory;
    imageUrl?: string;
    imageBase64?: string;
    stock?: number;
  }) {
    // A base64 upload from the merchant dashboard goes to Bunny CDN first.
    let imageUrl = data.imageUrl;
    if (data.imageBase64) {
      try {
        const uploaded = await this.storage.uploadImage(data.imageBase64, 'products');
        if (uploaded) imageUrl = uploaded;
      } catch (e: any) {
        console.error('[MERCHANT] Product image upload failed:', e?.message);
      }
    }

    return this.prisma.product.create({
      data: {
        merchantId,
        name: data.name,
        description: data.description,
        price: data.price,
        category: data.category,
        imageUrl,
        stock: data.stock ?? 0,
        status: ProductStatus.PENDING,
      },
    });
  }


  async createPromotion(merchantId: string, data: { title: string; description?: string; productIds: string[]; comboPrice: number; startsAt: string; endsAt: string }) {
    const title = String(data.title ?? '').trim();
    const productIds = [...new Set((data.productIds ?? []).map(id => String(id)))];
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(data.endsAt);
    if (!title || title.length > 100) throw new BadRequestException('Promotion title is required (maximum 100 characters).');
    if (productIds.length < 2) throw new BadRequestException('A combo promotion must contain at least two different products.');
    if (!Number.isInteger(data.comboPrice) || data.comboPrice <= 0) throw new BadRequestException('Enter a valid combo price.');
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) throw new BadRequestException('Choose valid promotion dates.');
    const durationDays = Math.ceil((endsAt.getTime() - startsAt.getTime()) / 86400000);
    if (startsAt.getUTCFullYear() !== endsAt.getUTCFullYear() || startsAt.getUTCMonth() !== endsAt.getUTCMonth()) throw new BadRequestException('A promotion must start and finish within the same calendar month.');
    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId }, select: { promoExempt: true } });
    if (!merchant) throw new NotFoundException('Merchant not found.');
    if (!merchant.promoExempt && durationDays > 7) throw new BadRequestException('Promotions may run for a maximum of 7 consecutive days per calendar month unless Zana grants your store an exemption.');
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds }, merchantId, status: ProductStatus.APPROVED, available: true } });
    if (products.length !== productIds.length) throw new BadRequestException('Every combo item must be an approved, available product belonging to your store.');
    const regularTotal = products.reduce((sum, p) => sum + p.price, 0);
    if (data.comboPrice >= regularTotal) throw new BadRequestException('Combo price must be lower than the combined regular product price.');
    if (!merchant.promoExempt) {
      const monthStart = new Date(Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth() + 1, 1));
      const existing = await this.prisma.merchantPromotion.findMany({
        where: { merchantId, status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] }, startsAt: { lt: monthEnd }, endsAt: { gt: monthStart } },
        select: { startsAt: true, endsAt: true },
      });
      const used = new Set<number>();
      for (const promo of existing) {
        for (let day = Date.UTC(promo.startsAt.getUTCFullYear(), promo.startsAt.getUTCMonth(), promo.startsAt.getUTCDate()); day < promo.endsAt.getTime(); day += 86400000) {
          if (day >= monthStart.getTime() && day < monthEnd.getTime()) used.add(day);
        }
      }
      for (let day = Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth(), startsAt.getUTCDate()); day < endsAt.getTime(); day += 86400000) {
        if (day >= monthStart.getTime() && day < monthEnd.getTime()) used.add(day);
      }
      if (used.size > 7) throw new BadRequestException('Your store has a maximum of 7 promotion days per calendar month. Contact Zana to request an exemption.');
    }
    return this.prisma.merchantPromotion.create({
      data: { merchantId, title, description: data.description?.trim() || null, comboPrice: data.comboPrice, startsAt, endsAt,
        items: { create: productIds.map(productId => ({ productId })) } },
      include: { items: { include: { product: true } } },
    });
  }

  async getMyPromotions(merchantId: string) {
    return this.prisma.merchantPromotion.findMany({
      where: { merchantId }, include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateProductImage(merchantId: string, productId: string, imageBase64: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, merchantId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const uploaded = await this.storage.uploadImage(imageBase64, 'products');
    if (!uploaded) throw new BadRequestException('IMAGE_UPLOAD_UNAVAILABLE');

    return this.prisma.product.update({
      where: { id: productId },
      data: { imageUrl: uploaded },
    });
  }

  async getMyProducts(merchantId: string) {
    return this.prisma.product.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateProduct(productId: string, merchantId: string, data: Partial<{
    name: string;
    description: string;
    price: number;
    stock: number;
    available: boolean;
    imageUrl: string;
  }>) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.merchantId !== merchantId) throw new ForbiddenException('Not your product');

    // Editing an approved product re-queues it for admin review.
    const requiresReview = ['name', 'description', 'price', 'stock'].some((key) => Object.prototype.hasOwnProperty.call(data, key));
    const status = requiresReview && product.status === ProductStatus.APPROVED ? ProductStatus.PENDING : product.status;
    return this.prisma.product.update({ where: { id: productId }, data: { ...data, status } });
  }

  async updateLocation(userId: string, lat: number, lng: number, address?: string) {
    const merchant = await this.findByUserId(userId);
    return this.prisma.merchant.update({
      where: { id: merchant.id },
      data: { businessLat: lat, businessLng: lng, businessAddress: address },
    });
  }


  async deleteProduct(userId: string, productId: string) {
    const merchant = await this.findByUserId(userId);
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.merchantId !== merchant.id) throw new Error('Not your product');
    return this.prisma.product.delete({ where: { id: productId } });
  }

  // Merchant controls how long they need to prepare an order and how long
  // delivery usually takes — the customer sees the sum as an ETA.
  async updateTimings(userId: string, prepMinutes?: number, deliveryMinutes?: number) {
    const merchant = await this.findByUserId(userId);
    const data: any = {};
    if (typeof prepMinutes === 'number') {
      if (!Number.isInteger(prepMinutes) || prepMinutes < 1 || prepMinutes > 240) throw new BadRequestException('PREP_MINUTES_OUT_OF_RANGE');
      data.prepMinutes = prepMinutes;
    }
    if (typeof deliveryMinutes === 'number') {
      if (!Number.isInteger(deliveryMinutes) || deliveryMinutes < 1 || deliveryMinutes > 240) throw new BadRequestException('DELIVERY_MINUTES_OUT_OF_RANGE');
      data.deliveryMinutes = deliveryMinutes;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('TIMING_REQUIRED');
    return this.prisma.merchant.update({ where: { id: merchant.id }, data });
  }


  // Storefront imagery — the logo and cover shown on the merchant card.
  async updateBranding(userId: string, data: { logoBase64?: string; coverBase64?: string }) {
    const merchant = await this.findByUserId(userId);
    const patch: any = {};

    if (data.logoBase64) {
      const url = await this.storage.uploadImage(data.logoBase64, 'merchant-logos');
      if (url) patch.logoUrl = url;
    }
    if (data.coverBase64) {
      const url = await this.storage.uploadImage(data.coverBase64, 'merchant-covers');
      if (url) patch.coverUrl = url;
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('NO_IMAGE_PROVIDED');
    }

    return this.prisma.merchant.update({ where: { id: merchant.id }, data: patch });
  }

}