import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from './auth/roles.guard';
import { CurrentUser } from './auth/current-user.decorator';
import type { JwtPayload } from './auth/jwt.strategy';
import { PrismaService } from './prisma/prisma.service';

@Controller('support/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
export class CustomerSupportController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() body: any) {
    const subject = String(body?.subject ?? '').trim().slice(0, 180);
    const description = String(body?.description ?? '').trim().slice(0, 5000);
    if (!subject || !description) {
      throw new BadRequestException('Subject and description are required');
    }

    const categories = ['GENERAL', 'RIDE', 'DELIVERY', 'ORDER', 'PAYMENT', 'DRIVER', 'MERCHANT', 'SAFETY', 'ACCOUNT'];
    const relatedTypes = ['RIDE', 'DELIVERY', 'ORDER', 'PAYMENT', 'ACCOUNT', 'OTHER'];
    const category = String(body?.category ?? 'GENERAL').toUpperCase();
    const relatedType = body?.relatedType ? String(body.relatedType).toUpperCase() : undefined;
    if (!categories.includes(category)) throw new BadRequestException('Invalid support category');
    if (relatedType && !relatedTypes.includes(relatedType)) throw new BadRequestException('Invalid related record type');

    const customer = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { id: true, firstName: true, lastName: true, phone: true, role: true, status: true },
    });
    if (!customer || customer.role !== 'CUSTOMER' || customer.status !== 'ACTIVE') {
      throw new BadRequestException('An active customer account is required');
    }

    return this.prisma.supportTicket.create({
      data: {
        customerId: customer.id,
        customerName: [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || customer.phone,
        customerPhone: customer.phone,
        subject,
        description,
        category,
        priority: category === 'SAFETY' ? 'URGENT' : 'NORMAL',
        relatedType: relatedType ?? null,
        relatedReference: body?.relatedReference ? String(body.relatedReference).trim().slice(0, 160) : null,
        createdById: customer.id,
        lastUpdatedById: customer.id,
      },
      select: { id: true, ticketNumber: true, subject: true, category: true, status: true, createdAt: true },
    });
  }

  @Get('mine')
  async mine(@CurrentUser() user: JwtPayload) {
    return this.prisma.supportTicket.findMany({
      where: { customerId: user.sub },
      select: { id: true, ticketNumber: true, subject: true, category: true, status: true, resolution: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
