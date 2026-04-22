import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClassifiedStatus, ClassifiedType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface AuthedUser {
  id: string;
  memberships: Array<{ buildingId: string; role: string }>;
}

@Injectable()
export class ClassifiedsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    user: AuthedUser,
    input: {
      buildingId: string;
      type: ClassifiedType;
      title: string;
      body: string;
      priceEur?: string;
      contactPhone?: string;
      contactApartment?: string;
    },
  ) {
    this.assertMember(user, input.buildingId);
    const c = await this.prisma.classified.create({
      data: {
        buildingId: input.buildingId,
        authorId: user.id,
        type: input.type,
        title: input.title,
        body: input.body,
        priceEur: input.priceEur,
        contactPhone: input.contactPhone,
        contactApartment: input.contactApartment,
        expiresAt: new Date(Date.now() + 60 * 86400_000), // 60 dní default
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'CLASSIFIED_CREATED',
      resourceType: 'Classified',
      resourceId: c.id,
      payload: { type: c.type, title: c.title },
    });
    return c;
  }

  async list(user: AuthedUser, buildingId: string, type?: ClassifiedType) {
    this.assertMember(user, buildingId);
    return this.prisma.classified.findMany({
      where: {
        buildingId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        ...(type ? { type } : {}),
      },
      include: { author: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async close(user: AuthedUser, id: string) {
    const c = await this.prisma.classified.findUnique({ where: { id } });
    if (!c) throw new NotFoundException();
    // autor alebo admin budovy
    const isAdmin = user.memberships.some(
      (m) => m.buildingId === c.buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (c.authorId !== user.id && !isAdmin) throw new ForbiddenException();
    return this.prisma.classified.update({
      where: { id },
      data: { status: ClassifiedStatus.CLOSED },
    });
  }

  private assertMember(user: AuthedUser, buildingId: string) {
    if (!user.memberships.some((m) => m.buildingId === buildingId)) {
      throw new ForbiddenException();
    }
  }
}
