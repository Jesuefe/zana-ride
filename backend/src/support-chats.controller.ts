import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles, RolesGuard } from './auth/roles.guard';
import { CurrentUser } from './auth/current-user.decorator';
import type { JwtPayload } from './auth/jwt.strategy';
import { PrismaService } from './prisma/prisma.service';

const chatInclude = {
  user: { select: { id: true, firstName: true, lastName: true, phone: true, language: true, createdAt: true } },
  assignedStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
  messages: { orderBy: { createdAt: 'desc' as const }, take: 1 },
};

@Controller('support/chats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
export class CustomerSupportChatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async openOrCreate(@CurrentUser() user: JwtPayload) {
    const customer = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { id: true, role: true, status: true } });
    if (!customer || customer.role !== 'CUSTOMER' || customer.status !== 'ACTIVE') throw new BadRequestException('An active customer account is required');
    const existing = await this.prisma.supportChat.findFirst({ where: { userId: user.sub, status: { in: ['open', 'assigned'] } }, include: { messages: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } });
    if (existing) return existing;
    return this.prisma.supportChat.create({ data: { userId: user.sub }, include: { messages: true } });
  }

  @Get()
  async mine(@CurrentUser() user: JwtPayload) {
    return this.prisma.supportChat.findMany({ where: { userId: user.sub }, include: { messages: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' }, take: 20 });
  }

  @Get(':id/messages')
  async messages(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const chat = await this.prisma.supportChat.findFirst({ where: { id, userId: user.sub } });
    if (!chat) throw new NotFoundException('Support chat not found');
    return this.prisma.supportMessage.findMany({ where: { chatId: id, sender: { in: ['customer', 'staff'] } }, orderBy: { createdAt: 'asc' } });
  }

  @Post(':id/messages')
  async send(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { text?: string }) {
    const text = String(body?.text ?? '').trim();
    if (!text || text.length > 4000) throw new BadRequestException('Message must contain 1–4000 characters');
    const chat = await this.prisma.supportChat.findFirst({ where: { id, userId: user.sub } });
    if (!chat) throw new NotFoundException('Support chat not found');
    return this.prisma.$transaction(async tx => {
      await tx.supportChat.update({ where: { id }, data: { lastCustomerMessageAt: new Date(), ...(chat.status === 'completed' ? { status: 'open', closedAt: null, resolvedAt: null } : {}) } });
      return tx.supportMessage.create({ data: { chatId: id, sender: 'customer', text } });
    });
  }
}

@Controller('admin/support/chats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'STAFF')
export class AdminSupportChatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload, @Query('tab') tab = 'open', @Query('search') search = '', @Query('priority') priority = '', @Query('category') category = '') {
    const where: any = {};
    if (tab === 'mine') { where.assignedStaffId = user.sub; where.status = { in: ['open', 'assigned'] }; }
    else if (tab === 'completed') where.status = 'completed';
    else where.status = { in: ['open', 'assigned'] };
    if (['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority.toUpperCase())) where.priority = priority.toUpperCase();
    if (category.trim() && /^[A-Z_]{2,40}$/.test(category.toUpperCase())) where.category = category.toUpperCase();
    if (search.trim()) where.user = { OR: [
      { firstName: { contains: search.trim(), mode: 'insensitive' } },
      { lastName: { contains: search.trim(), mode: 'insensitive' } },
      { phone: { contains: search.trim() } },
    ] };
    const chats = await this.prisma.supportChat.findMany({ where, include: chatInclude, orderBy: [{ createdAt: 'desc' }], take: 150 });
    return chats.map(chat => ({ ...chat, lastMessage: chat.messages[0] ?? null, unread: Boolean(chat.lastCustomerMessageAt && (!chat.lastStaffReadAt || chat.lastCustomerMessageAt > chat.lastStaffReadAt) && (!chat.lastStaffMessageAt || chat.lastCustomerMessageAt > chat.lastStaffMessageAt)) }))
      .sort((a, b) => (['URGENT','HIGH','NORMAL','LOW'].indexOf(a.priority) - ['URGENT','HIGH','NORMAL','LOW'].indexOf(b.priority)) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  @Get(':id/messages')
  async messages(@Param('id') id: string) {
    const chat = await this.prisma.supportChat.findUnique({ where: { id }, select: { id: true } });
    if (!chat) throw new NotFoundException('Support chat not found');
    return this.prisma.supportMessage.findMany({ where: { chatId: id }, orderBy: { createdAt: 'asc' } });
  }

  @Post(':id/messages')
  async send(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { text?: string; sender?: string }) {
    const text = String(body?.text ?? '').trim();
    const sender = body?.sender === 'note' ? 'note' : 'staff';
    if (!text || text.length > 4000) throw new BadRequestException('Message must contain 1–4000 characters');
    const chat = await this.prisma.supportChat.findUnique({ where: { id }, select: { id: true, status: true, firstResponseAt: true } });
    if (!chat) throw new NotFoundException('Support chat not found');
    return this.prisma.$transaction(async tx => {
      await tx.supportChat.update({ where: { id }, data: {
        ...(sender === 'staff' && chat.status === 'completed' ? { status: 'assigned', closedAt: null, resolvedAt: null } : {}),
        ...(sender === 'staff' ? { assignedStaffId: user.sub, status: 'assigned', lastStaffMessageAt: new Date(), ...(chat.firstResponseAt ? {} : { firstResponseAt: new Date() }) } : {}),
      } });
      return tx.supportMessage.create({ data: { chatId: id, sender, text } });
    });
  }

  @Patch(':id/read')
  async markRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const chat = await this.prisma.supportChat.findUnique({ where: { id }, select: { id: true, lastCustomerMessageAt: true, lastStaffReadAt: true } });
    if (!chat) throw new NotFoundException('Support chat not found');
    if (chat.lastCustomerMessageAt && (!chat.lastStaffReadAt || chat.lastCustomerMessageAt > chat.lastStaffReadAt)) {
      return this.prisma.supportChat.update({ where: { id }, data: { lastStaffReadAt: new Date() }, select: { id: true, lastStaffReadAt: true } });
    }
    return { id, lastStaffReadAt: chat.lastStaffReadAt };
  }

  @Patch(':id/metadata')
  async updateMetadata(@Param('id') id: string, @Body() body: { priority?: string; category?: string }) {
    const data: Record<string, string> = {};
    if (body.priority !== undefined) {
      const value = body.priority.toUpperCase();
      if (!['LOW','NORMAL','HIGH','URGENT'].includes(value)) throw new BadRequestException('Invalid priority');
      data.priority = value;
    }
    if (body.category !== undefined) {
      const value = body.category.toUpperCase();
      if (!['GENERAL','PAYMENT','RIDE','DELIVERY','DRIVER','MERCHANT','ACCOUNT','SAFETY','REFUND'].includes(value)) throw new BadRequestException('Invalid category');
      data.category = value;
    }
    if (!Object.keys(data).length) throw new BadRequestException('Priority or category is required');
    const chat = await this.prisma.supportChat.findUnique({ where: { id }, select: { id: true } });
    if (!chat) throw new NotFoundException('Support chat not found');
    return this.prisma.supportChat.update({ where: { id }, data, include: chatInclude });
  }

  @Patch(':id/assign')
  async assign(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const chat = await this.prisma.supportChat.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!chat) throw new NotFoundException('Support chat not found');
    return this.prisma.supportChat.update({ where: { id }, data: { assignedStaffId: user.sub, status: 'assigned', closedAt: null, resolvedAt: null }, include: chatInclude });
  }

  @Patch(':id/complete')
  async complete(@Param('id') id: string) {
    const chat = await this.prisma.supportChat.findUnique({ where: { id }, select: { id: true } });
    if (!chat) throw new NotFoundException('Support chat not found');
    return this.prisma.supportChat.update({ where: { id }, data: { status: 'completed', closedAt: new Date(), resolvedAt: new Date() }, include: chatInclude });
  }
}

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'STAFF')
export class AdminCustomerSummaryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id/summary')
  async summary(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, firstName: true, lastName: true, phone: true, language: true, createdAt: true,
        wallet: { select: { balance: true, transactions: { orderBy: { createdAt: 'desc' }, where: { amount: { gt: 0 } }, take: 5, select: { amount: true, status: true, description: true, createdAt: true, reference: true } } } },
        tripsAsCustomer: { orderBy: { requestedAt: 'desc' }, take: 5, select: { id: true, status: true, estimatedFare: true, finalFare: true, requestedAt: true, driver: { select: { user: { select: { firstName: true, lastName: true, phone: true } } } } } },
        reportsReceived: { orderBy: { createdAt: 'desc' }, take: 5, select: { reason: true, details: true, createdAt: true } },
        tripReports: { orderBy: { createdAt: 'desc' }, take: 5, select: { reason: true, details: true, status: true, createdAt: true } },
        supportChats: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, createdAt: true, closedAt: true, messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { text: true, sender: true, createdAt: true } } } },
      },
    });
    if (!user) throw new NotFoundException('Customer not found');
    const { tripsAsCustomer, reportsReceived, tripReports, supportChats, wallet, ...profile } = user;
    const activeRide = await this.prisma.trip.findFirst({
      where: { customerId: id, status: { in: ['REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'RIDE_IN_PROGRESS'] } },
      orderBy: { requestedAt: 'desc' },
      select: { id: true, status: true, estimatedFare: true, finalFare: true, requestedAt: true, driver: { select: { user: { select: { firstName: true, lastName: true, phone: true } } } } },
    });
    return { ...profile, walletBalance: wallet?.balance ?? 0, topups: wallet?.transactions ?? [], rides: tripsAsCustomer.map(t => ({ ...t, fare: t.finalFare ?? t.estimatedFare, driver: t.driver?.user ?? null })), activeRide: activeRide ? { ...activeRide, fare: activeRide.finalFare ?? activeRide.estimatedFare, driver: activeRide.driver?.user ?? null } : null, complaints: [...reportsReceived, ...tripReports].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5), earlierChats: supportChats };
  }
}
