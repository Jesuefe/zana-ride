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

  async updateLanguage(userId: string, language: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { language } });
  }

  async getSavedPlaces(userId: string) {
    return this.prisma.savedPlace.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  async addSavedPlace(userId: string, data: { label: string; address: string; lat: number; lng: number }) {
    const count = await this.prisma.savedPlace.count({ where: { userId } });
    if (count >= 5) throw new Error('Maximum 5 saved places allowed');
    return this.prisma.savedPlace.create({ data: { userId, ...data } });
  }

  async deleteSavedPlace(userId: string, placeId: string) {
    return this.prisma.savedPlace.deleteMany({ where: { id: placeId, userId } });
  }

}