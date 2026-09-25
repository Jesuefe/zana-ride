import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { MerchantService } from './merchant.service';
import { WalletService } from '../wallet/wallet.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../deliveries/storage.service';
import { MerchantCategory } from '@prisma/client';

@Controller('merchant')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MERCHANT')
export class MerchantController {
  constructor(
    private merchantService: MerchantService,
    private walletService: WalletService,
    private storageService: StorageService,
    private prisma: PrismaService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.merchantService.findByUserId(user.sub);
  }

  // Previously didn't exist at all — the merchant app's wallet page called
  // both of these routes and neither one was registered on the backend.
  // The wallet balance was never a real zero; it was a 404 dressed up by
  // the frontend's own fallback handling as if it were an empty wallet.
  @Get('wallet')
  wallet(@CurrentUser() user: JwtPayload) {
    return this.walletService.findByUserId(user.sub);
  }

  @Post('wallet/withdraw')
  withdrawWallet(@CurrentUser() user: JwtPayload, @Body() body: { amount: number }) {
    return this.walletService.withdraw(user.sub, body.amount);
  }

  @Post('products')
  async createProduct(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; description?: string; price: number; category: MerchantCategory; imageUrl?: string; imageBase64?: string; stock?: number },
  ) {
    const merchant = await this.merchantService.findByUserId(user.sub);
    return this.merchantService.createProduct(merchant.id, body);
  }

  @Get('products')
  async getMyProducts(@CurrentUser() user: JwtPayload) {
    const merchant = await this.merchantService.findByUserId(user.sub);
    return this.merchantService.getMyProducts(merchant.id);
  }

  @Patch('products/:id')
  async updateProduct(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const merchant = await this.merchantService.findByUserId(user.sub);
    return this.merchantService.updateProduct(id, merchant.id, body);
  }

  @Delete('products/:id')
  async deleteProduct(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.merchantService.deleteProduct(user.sub, id);
  }

  @Patch('location')
  async updateLocation(
    @CurrentUser() user: JwtPayload,
    @Body() body: { lat: number; lng: number; address?: string },
  ) {
    return this.merchantService.updateLocation(user.sub, body.lat, body.lng, body.address);
  }

  @Post('products/:id/image')
  async uploadProductImage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { imageBase64: string },
  ) {
    const merchant = await this.merchantService.findByUserId(user.sub);
    return this.merchantService.updateProductImage(merchant.id, id, body.imageBase64);
  }

  @Patch('timings')
  updateTimings(
    @CurrentUser() user: JwtPayload,
    @Body() body: { prepMinutes?: number; deliveryMinutes?: number },
  ) {
    return this.merchantService.updateTimings(user.sub, body.prepMinutes, body.deliveryMinutes);
  }

  @Patch('branding')
  updateBranding(
    @CurrentUser() user: JwtPayload,
    @Body() body: { logoBase64?: string; coverBase64?: string },
  ) {
    return this.merchantService.updateBranding(user.sub, body);
  }
}

@Controller('products')
export class PublicProductsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll(@Query('category') category?: MerchantCategory) {
    return this.prisma.product.findMany({
      where: {
        status: 'APPROVED',
        available: true,
        ...(category ? { category } : {}),
        merchant: { status: 'APPROVED' },
      },
      include: { merchant: { select: { businessName: true, branch: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
