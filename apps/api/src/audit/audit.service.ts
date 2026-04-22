import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditInput {
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  payload?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput) {
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.auditEvent.findFirst({
        orderBy: { occurredAt: 'desc' },
        select: { hash: true },
      });
      const prevHash = last?.hash ?? null;
      const occurredAt = new Date();
      const material = JSON.stringify({
        prevHash,
        occurredAt: occurredAt.toISOString(),
        actorId: input.actorId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        payload: input.payload ?? null,
      });
      const hash = createHash('sha256').update(material).digest('hex');

      return tx.auditEvent.create({
        data: {
          occurredAt,
          actorId: input.actorId ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId ?? null,
          payload: input.payload as object | undefined,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          prevHash,
          hash,
        },
      });
    });
  }

  /**
   * Udalosti viazané na konkrétnu budovu — kombinácia resourceId === buildingId
   * a eventov viazaných na sub-resources (membershipy, hlasy, faktúry) v budove.
   * Pre jednoduchosť filtrujeme dva spôsoby:
   *   1) payload.buildingId === buildingId (ak bol uložený)
   *   2) resourceId je priamo buildingId
   *   3) resourceId je podzdroj budovy — dotiahneme join per typ
   * Vráti zoznam + počet a verifyChain stav.
   */
  async buildingTimeline(buildingId: string, limit = 200) {
    // Získame eventy podľa viacerých kritérií cez SQL OR.
    const membershipIds = await this.prisma.membership.findMany({
      where: { buildingId }, select: { id: true },
    });
    const apartmentIds = await this.prisma.apartment.findMany({
      where: { buildingId }, select: { id: true },
    });
    const votingIds = await this.prisma.voting.findMany({
      where: { buildingId }, select: { id: true },
    });
    const meetingIds = await this.prisma.meeting.findMany({
      where: { buildingId }, select: { id: true },
    });
    const ticketIds = await this.prisma.ticket.findMany({
      where: { buildingId }, select: { id: true },
    });
    const invoiceIds = await this.prisma.invoice.findMany({
      where: { buildingId }, select: { id: true },
    });
    const announcementIds = await this.prisma.announcement.findMany({
      where: { buildingId }, select: { id: true },
    });
    const revisionIds = await this.prisma.revision.findMany({
      where: { buildingId }, select: { id: true },
    });
    const allIds = new Set<string>([
      buildingId,
      ...membershipIds.map((m) => m.id),
      ...apartmentIds.map((a) => a.id),
      ...votingIds.map((v) => v.id),
      ...meetingIds.map((m) => m.id),
      ...ticketIds.map((t) => t.id),
      ...invoiceIds.map((i) => i.id),
      ...announcementIds.map((a) => a.id),
      ...revisionIds.map((r) => r.id),
    ]);

    const events = await this.prisma.auditEvent.findMany({
      where: { resourceId: { in: Array.from(allIds) } },
      include: { actor: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });

    return events.map((e) => ({
      id: e.id,
      occurredAt: e.occurredAt,
      action: e.action,
      resourceType: e.resourceType,
      resourceId: e.resourceId,
      actor: e.actor ? { name: `${e.actor.firstName} ${e.actor.lastName}`, email: e.actor.email } : null,
      actorSystemName: !e.actor ? 'SYSTEM' : null,
      payload: e.payload,
      hash: e.hash,
      prevHash: e.prevHash,
    }));
  }

  async verifyChain(): Promise<{ valid: boolean; brokenAt?: string }> {
    const events = await this.prisma.auditEvent.findMany({
      orderBy: { occurredAt: 'asc' },
    });
    let prevHash: string | null = null;
    for (const ev of events) {
      const material: string = JSON.stringify({
        prevHash,
        occurredAt: ev.occurredAt.toISOString(),
        actorId: ev.actorId,
        action: ev.action,
        resourceType: ev.resourceType,
        resourceId: ev.resourceId,
        payload: ev.payload ?? null,
      });
      const expected: string = createHash('sha256').update(material).digest('hex');
      if (expected !== ev.hash || ev.prevHash !== prevHash) {
        return { valid: false, brokenAt: ev.id };
      }
      prevHash = ev.hash;
    }
    return { valid: true };
  }
}
