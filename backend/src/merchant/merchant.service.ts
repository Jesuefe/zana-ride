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
    const status = product.status === ProductStatus.APPROVED ? ProductStatus.PENDING : product.status;
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
      if (prepMinutes < 1 || prepMinutes > 240) throw new BadRequestException('PREP_MINUTES_OUT_OF_RANGE');
      data.prepMinutes = prepMinutes;
    }
    if (typeof deliveryMinutes === 'number') {
      if (deliveryMinutes < 1 || deliveryMinutes > 240) throw new BadRequestException('DELIVERY_MINUTES_OUT_OF_RANGE');
      data.deliveryMinutes = deliveryMinutes;
    }
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