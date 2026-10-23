import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller('merchant-registration')
export class MerchantRegistrationController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Body() body: {
    businessName?: string; contactName?: string; category?: string; phone?: string;
    whatsappPhone?: string; businessAddress?: string; locationsCount?: string;
    deliveryPreference?: string; notes?: string;
  }) {
    const businessName = body.businessName?.trim();
    const contactName = body.contactName?.trim();
    const phone = body.phone?.trim();
    const businessAddress = body.businessAddress?.trim();
    const category = body.category?.trim();
    // Delivery is coordinated by Zana; the public enquiry form intentionally does not ask merchants to choose a delivery arrangement.
    const deliveryPreference = body.deliveryPreference?.trim() || 'Zana delivery support';
    if (!businessName || !contactName || !phone || !businessAddress || !category) {
      throw new BadRequestException('Please complete all required fields.');
    }
    if (businessName.length > 150 || contactName.length > 120 || phone.length > 30 || businessAddress.length > 250) {
      throw new BadRequestException('One or more fields exceed the allowed length.');
    }
    return this.prisma.merchantLead.create({
      data: {
        businessName, contactName, phone, businessAddress, category, deliveryPreference,
        whatsappPhone: body.whatsappPhone?.trim().slice(0, 30) || null,
        locationsCount: body.locationsCount?.trim().slice(0, 30) || '1',
        notes: body.notes?.trim().slice(0, 1500) || null,
      },
      select: { id: true, createdAt: true, status: true },
    });
  }
}
