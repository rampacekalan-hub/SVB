import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
