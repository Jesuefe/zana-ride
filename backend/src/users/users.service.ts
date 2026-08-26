import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { wallet: true, driver: true, merchant: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, data: { firstName?: string; lastName?: string; email?: string }) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async myTrips(id: string) {
    return this.prisma.trip.findMany({
      where: { customerId: id },
      orderBy: { requestedAt: 'desc' },
      include: { driver: { include: { user: true } } },
    });
  }
}
