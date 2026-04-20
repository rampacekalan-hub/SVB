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
