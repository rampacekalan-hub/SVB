import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';

interface AuthedUser {
  id: string;
  memberships: Array<{ buildingId: string; apartmentId: string | null; role: string }>;
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async create(
    user: AuthedUser,
    input: {
      buildingId: string;
      apartmentId?: string;
      title: string;
      description: string;
      priority?: TicketPriority;
    },
  ) {
    if (!user.memberships.some((m) => m.buildingId === input.buildingId)) {
      throw new ForbiddenException();
    }
    const ticket = await this.prisma.ticket.create({
      data: {
        buildingId: input.buildingId,
        apartmentId: input.apartmentId,
        creatorId: user.id,
        title: input.title,
        description: input.description,
        priority: input.priority ?? 'NORMAL',
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'TICKET_CREATED',
      resourceType: 'Ticket',
      resourceId: ticket.id,
    });
    return ticket;
  }

  async setStatus(user: AuthedUser, ticketId: string, status: TicketStatus) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException();
    const allowed = user.memberships.some(
      (m) =>
        m.buildingId === ticket.buildingId &&
        ['MAINTENANCE', 'MANAGER', 'CHAIRMAN', 'ADMIN'].includes(m.role),
    );
    if (!allowed) throw new ForbiddenException();
    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status,
        resolvedAt: status === 'RESOLVED' ? new Date() : ticket.resolvedAt,
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'TICKET_STATUS_CHANGED',
      resourceType: 'Ticket',
      resourceId: ticketId,
      payload: { status },
    });
    return updated;
  }

  async assign(user: AuthedUser, ticketId: string, assigneeId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException();
    const allowed = user.memberships.some(
      (m) => m.buildingId === ticket.buildingId && ['MANAGER', 'CHAIRMAN', 'ADMIN'].includes(m.role),
    );
    if (!allowed) throw new ForbiddenException();
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { assigneeId, status: 'IN_PROGRESS' },
    });
  }

  async comment(user: AuthedUser, ticketId: string, body: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException();
    if (!user.memberships.some((m) => m.buildingId === ticket.buildingId)) {
      throw new ForbiddenException();
    }
    return this.prisma.ticketComment.create({
      data: { ticketId, authorId: user.id, body },
    });
  }

  async attach(
    user: AuthedUser,
    ticketId: string,
    file: { buffer: Buffer; mimeType: string },
  ) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException();
    if (!user.memberships.some((m) => m.buildingId === ticket.buildingId)) {
      throw new ForbiddenException();
    }
    const key = `tickets/${ticketId}/${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { sha256, size } = await this.storage.put(key, file.buffer, file.mimeType);
    return this.prisma.ticketAttachment.create({
      data: {
        ticketId,
        storageKey: key,
        mimeType: file.mimeType,
        sizeBytes: size,
        sha256,
      },
    });
  }

  async list(user: AuthedUser, buildingId: string) {
    if (!user.memberships.some((m) => m.buildingId === buildingId)) {
      throw new ForbiddenException();
    }
    return this.prisma.ticket.findMany({
      where: { buildingId },
      include: {
        apartment: { select: { unitNumber: true } },
        assignee: { select: { firstName: true, lastName: true } },
        _count: { select: { attachments: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async detail(user: AuthedUser, id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        comments: { orderBy: { createdAt: 'asc' } },
        attachments: true,
        apartment: true,
      },
    });
    if (!ticket) throw new NotFoundException();
    if (!user.memberships.some((m) => m.buildingId === ticket.buildingId)) {
      throw new ForbiddenException();
    }
    return ticket;
  }
}
