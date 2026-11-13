import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

  // Account deletion (App Store Guideline 5.1.1(v)). Trips, payments and wallet
  // history must be kept for financial/legal records, so personal data is
  // anonymised and the account is blocked from signing in, rather than the row
  // being removed.
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { wallet: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== 'CUSTOMER') throw new BadRequestException('Only customer accounts can be deleted here. Contact support.');
    const activeTrips = await this.prisma.trip.count({
      where: {
        customerId: userId,
        status: { in: ['REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'RIDE_IN_PROGRESS'] },
      },
    });
    if (activeTrips > 0) throw new BadRequestException('Finish or cancel your active ride before deleting your account.');
    if ((user.wallet?.balance ?? 0) > 0) {
      throw new BadRequestException('Your wallet still has a balance. Contact support@zanaride.rw to withdraw it before deleting your account.');
    }
    await this.prisma.$transaction([
      this.prisma.savedPlace.deleteMany({ where: { userId } }),
      this.prisma.pushToken.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          phone: `deleted-${userId}`,
          email: null,
          password: null,
          firstName: 'Deleted',
          lastName: 'User',
          status: 'BANNED',
        },
      }),
    ]);
    return { deleted: true };
  }

}
