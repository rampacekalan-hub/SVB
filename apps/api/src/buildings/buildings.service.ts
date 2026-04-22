import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { randomBytes } from 'crypto';

interface AuthedUser {
  id: string;
  memberships: Array<{ buildingId: string; role: string }>;
}

@Injectable()
export class BuildingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listForUser(userId: string) {
    return this.prisma.building.findMany({
      where: { memberships: { some: { userId } } },
      include: {
        _count: { select: { apartments: true, votings: true, tickets: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async detail(user: AuthedUser, buildingId: string) {
    const b = await this.prisma.building.findUnique({
      where: { id: buildingId },
      include: { apartments: true },
    });
    if (!b) throw new NotFoundException();
    if (!user.memberships.some((m) => m.buildingId === buildingId)) {
      throw new ForbiddenException();
    }
    return b;
  }

  /**
   * Založí novú budovu a prihláseného používateľa nastaví ako CHAIRMAN.
   * Použité v onboarding wizarde pri prvom spustení admin účtu.
   */
  async create(
    userId: string,
    input: {
      name: string;
      address: string;
      city: string;
      zip: string;
      country?: string;
      legalForm?: string;
      ico?: string;
    },
  ) {
    if (!input.name.trim()) throw new BadRequestException('Chýba názov budovy.');
    const building = await this.prisma.$transaction(async (tx) => {
      const b = await tx.building.create({
        data: {
          name: input.name.trim(),
          address: input.address.trim(),
          city: input.city.trim(),
          zip: input.zip.trim(),
          country: (input.country ?? 'SK').trim().toUpperCase(),
          legalForm: input.legalForm,
          ico: input.ico,
        },
      });
      await tx.membership.create({
        data: {
          userId,
          buildingId: b.id,
          role: 'CHAIRMAN',
          verifiedAt: new Date(),
        },
      });
      return b;
    });
    await this.audit.record({
      actorId: userId,
      action: 'BUILDING_CREATED',
      resourceType: 'Building',
      resourceId: building.id,
      payload: { name: building.name, city: building.city, country: building.country },
    });
    return building;
  }

  /**
   * Agregované štatistiky pre dashboard admina (predsedu/správcu).
   * Zobrazujú sa vedľa budovy: % registrovaných vlastníkov, aktívne poruchy,
   * najbližšia schôdza, otvorené hlasovanie, celkový nedoplatok za budovu.
   */
  async adminStats(user: AuthedUser, buildingId: string) {
    const ok = user.memberships.some(
      (m) => m.buildingId === buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (!ok) throw new ForbiddenException();

    const [
      apartmentsCount,
      registeredMemberships,
      pendingCodes,
      openTickets,
      activeVoting,
      nextMeeting,
      outstandingAgg,
    ] = await Promise.all([
      this.prisma.apartment.count({ where: { buildingId } }),
      this.prisma.membership.count({
        where: { buildingId, role: 'OWNER', userId: { not: null } },
      }),
      this.prisma.membership.count({
        where: { buildingId, role: 'OWNER', userId: null, activationCode: { not: null } },
      }),
      this.prisma.ticket.count({
        where: { buildingId, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] } },
      }),
      this.prisma.voting.findFirst({
        where: { buildingId, status: 'OPEN' },
        orderBy: { closesAt: 'asc' },
        select: { id: true, title: true, closesAt: true },
      }),
      this.prisma.meeting.findFirst({
        where: { buildingId, status: 'SCHEDULED', scheduledAt: { gt: new Date() } },
        orderBy: { scheduledAt: 'asc' },
        select: { id: true, title: true, scheduledAt: true },
      }),
      this.prisma.invoice.aggregate({
        where: { buildingId, status: { in: ['DUE', 'OVERDUE'] } },
        _sum: { amount: true },
      }),
    ]);

    // Participation metrics
    const totalAnnouncements = await this.prisma.announcement.count({ where: { buildingId } });
    const totalReceipts = await this.prisma.notificationReceipt.count({
      where: { announcement: { buildingId } },
    });
    const readReceipts = await this.prisma.notificationReceipt.count({
      where: { announcement: { buildingId }, readAt: { not: null } },
    });
    const announcementReadRate =
      totalReceipts > 0 ? Number((readReceipts / totalReceipts).toFixed(3)) : 0;

    const totalClosedVotings = await this.prisma.voting.count({
      where: { buildingId, status: 'CLOSED' },
    });
    const acceptedVotings = await this.prisma.votingResult.count({
      where: { voting: { buildingId }, accepted: true },
    });
    const votingAcceptanceRate =
      totalClosedVotings > 0 ? Number((acceptedVotings / totalClosedVotings).toFixed(3)) : 0;

    const upcomingRevisionsCount = await this.prisma.revision.count({
      where: {
        buildingId,
        completedAt: null,
        dueDate: { lte: new Date(Date.now() + 60 * 86400_000) },
      },
    });

    const registrationRate = apartmentsCount > 0 ? registeredMemberships / apartmentsCount : 0;
    return {
      apartmentsCount,
      registeredOwners: registeredMemberships,
      pendingActivationCodes: pendingCodes,
      registrationRate: Number(registrationRate.toFixed(3)),
      openTickets,
      activeVoting,
      nextMeeting,
      outstandingTotalEur: outstandingAgg._sum.amount?.toString() ?? '0',
      totalAnnouncements,
      announcementReadRate,
      totalClosedVotings,
      votingAcceptanceRate,
      upcomingRevisionsCount,
    };
  }

  async generateActivationCode(
    user: AuthedUser,
    input: { buildingId: string; apartmentId: string; role: 'OWNER' | 'CHAIRMAN' | 'MAINTENANCE' },
  ) {
    const isManager = user.memberships.some(
      (m) => m.buildingId === input.buildingId && ['MANAGER', 'CHAIRMAN', 'ADMIN'].includes(m.role),
    );
    if (!isManager) throw new ForbiddenException('Iba správca / predseda môže generovať kódy.');

    const code = randomBytes(6).toString('hex').toUpperCase();
    const membership = await this.prisma.membership.create({
      data: {
        buildingId: input.buildingId,
        apartmentId: input.apartmentId,
        role: input.role,
        activationCode: code,
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'ACTIVATION_CODE_ISSUED',
      resourceType: 'Membership',
      resourceId: membership.id,
      payload: { buildingId: input.buildingId, apartmentId: input.apartmentId, role: input.role },
    });
    return { code };
  }
}
