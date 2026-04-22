import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface AuthedUser {
  id: string;
  memberships: Array<{ buildingId: string; role: string }>;
}

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async publish(
    user: AuthedUser,
    input: {
      buildingId: string;
      title: string;
      body: string;
      severity?: AnnouncementSeverity;
      expiresAt?: Date;
    },
  ) {
    const allowed = user.memberships.some(
      (m) => m.buildingId === input.buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (!allowed) throw new ForbiddenException();

    const announcement = await this.prisma.announcement.create({
      data: {
        buildingId: input.buildingId,
        authorId: user.id,
        title: input.title,
        body: input.body,
        severity: input.severity ?? 'INFO',
        expiresAt: input.expiresAt,
      },
    });

    // Vytvor receipty pre všetkých vlastníkov bytov v danej budove
    const memberships = await this.prisma.membership.findMany({
      where: { buildingId: input.buildingId, userId: { not: null } },
      select: { userId: true },
    });
    const uniqueUsers = Array.from(new Set(memberships.map((m) => m.userId!).filter(Boolean)));
    if (uniqueUsers.length > 0) {
      await this.prisma.notificationReceipt.createMany({
        data: uniqueUsers.map((userId) => ({
          announcementId: announcement.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    await this.audit.record({
      actorId: user.id,
      action: 'ANNOUNCEMENT_PUBLISHED',
      resourceType: 'Announcement',
      resourceId: announcement.id,
    });
    return announcement;
  }

  async feed(user: AuthedUser) {
    return this.prisma.notificationReceipt.findMany({
      where: { userId: user.id },
      orderBy: { deliveredAt: 'desc' },
      include: {
        announcement: {
          include: { building: { select: { id: true, name: true } } },
        },
      },
      take: 100,
    });
  }

  /**
   * Kompletný zoznam oznamov budovy — pre chairman/správcu, ktorí potrebujú
   * vidieť všetko, čo budova uverejnila (nielen „moje neprečítané").
   * Obsahuje čítanosť: koľko ľudí ho dostalo, koľko si ho prečítalo.
   */
  async buildingFeed(user: AuthedUser, buildingId: string) {
    const ok = user.memberships.some(
      (m) => m.buildingId === buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (!ok) throw new ForbiddenException();
    const items = await this.prisma.announcement.findMany({
      where: { buildingId },
      orderBy: { publishedAt: 'desc' },
      include: {
        _count: { select: { receipts: true } },
        receipts: { where: { readAt: { not: null } }, select: { id: true } },
      },
    });
    return items.map((a) => {
      const delivered = (a as any)._count.receipts as number;
      const readCount = (a as any).receipts.length as number;
      return {
        id: a.id,
        title: a.title,
        body: a.body,
        severity: a.severity,
        publishedAt: a.publishedAt,
        expiresAt: a.expiresAt,
        delivered,
        readCount,
        readRate: delivered > 0 ? Number((readCount / delivered).toFixed(3)) : 0,
      };
    });
  }

  async acknowledge(user: AuthedUser, receiptId: string) {
    const receipt = await this.prisma.notificationReceipt.findUnique({
      where: { id: receiptId },
    });
    if (!receipt) throw new NotFoundException();
    if (receipt.userId !== user.id) throw new ForbiddenException();
    return this.prisma.notificationReceipt.update({
      where: { id: receiptId },
      data: { readAt: new Date() },
    });
  }
}
