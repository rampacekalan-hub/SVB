import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        locale: true,
        seniorMode: true,
        totpEnabled: true,
        memberships: {
          include: {
            building: { select: { id: true, name: true, city: true, country: true } },
            apartment: { select: { id: true, unitNumber: true, floor: true, area: true, ownershipShare: true } },
          },
        },
      },
    });
  }

  updatePreferences(userId: string, input: { locale?: 'SK' | 'CS'; seniorMode?: boolean }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        locale: input.locale,
        seniorMode: input.seniorMode,
      },
      select: { id: true, locale: true, seniorMode: true },
    });
  }
}
