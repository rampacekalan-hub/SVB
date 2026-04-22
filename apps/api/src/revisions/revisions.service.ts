import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RevisionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { PushService } from '../push/push.service';

interface AuthedUser {
  id: string;
  memberships: Array<{ buildingId: string; role: string }>;
}

/**
 * Preventívne revízie (zákonne povinné).
 * Predvolené intervaly pre SR:
 *   BOILER / GAS     1 rok
 *   ELEVATOR         3 mesiace (úradná skúška 3 roky)
 *   CHIMNEY          1 rok (tuhé palivo) / 2 roky (plyn)
 *   ELECTRICAL       5 rokov (STN 33 1500)
 *   FIRE_SAFETY      1 rok
 *   LIGHTNING_ROD    2–4 roky (podľa tried LPS)
 *
 * 30 dní pred dueDate pošleme pripomienku (mail + push) predsedovi/správcovi.
 */
@Injectable()
export class RevisionsService {
  private readonly log = new Logger(RevisionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly push: PushService,
  ) {}

  async create(
    user: AuthedUser,
    input: {
      buildingId: string;
      type: RevisionType;
      title: string;
      dueDate: Date;
      intervalMonths?: number;
      contractorName?: string;
      contractorPhone?: string;
      contractorEmail?: string;
      notes?: string;
    },
  ) {
    this.assertAdmin(user, input.buildingId);
    const r = await this.prisma.revision.create({ data: input });
    await this.audit.record({
      actorId: user.id,
      action: 'REVISION_SCHEDULED',
      resourceType: 'Revision',
      resourceId: r.id,
      payload: { type: r.type, dueDate: r.dueDate },
    });
    return r;
  }

  async list(user: AuthedUser, buildingId: string) {
    this.assertMember(user, buildingId);
    return this.prisma.revision.findMany({
      where: { buildingId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async complete(
    user: AuthedUser,
    id: string,
    input: { completedAt: Date; reportPdfKey?: string; notes?: string },
  ) {
    const r = await this.prisma.revision.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    this.assertAdmin(user, r.buildingId);
    const next = r.intervalMonths
      ? addMonths(input.completedAt, r.intervalMonths)
      : null;
    const updated = await this.prisma.revision.update({
      where: { id },
      data: {
        completedAt: input.completedAt,
        lastDoneAt: input.completedAt,
        reportPdfKey: input.reportPdfKey,
        notes: input.notes ?? r.notes,
      },
    });
    // Automaticky vygeneruj ďalší termín ak máme interval
    if (next) {
      await this.prisma.revision.create({
        data: {
          buildingId: r.buildingId,
          type: r.type,
          title: r.title,
          dueDate: next,
          intervalMonths: r.intervalMonths ?? undefined,
          contractorName: r.contractorName ?? undefined,
          contractorPhone: r.contractorPhone ?? undefined,
          contractorEmail: r.contractorEmail ?? undefined,
        },
      });
    }
    await this.audit.record({
      actorId: user.id,
      action: 'REVISION_COMPLETED',
      resourceType: 'Revision',
      resourceId: id,
      payload: { nextDueDate: next },
    });
    return updated;
  }

  async remove(user: AuthedUser, id: string) {
    const r = await this.prisma.revision.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    this.assertAdmin(user, r.buildingId);
    await this.prisma.revision.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Každý deň o 07:00 — pozri revízie splatné do 30 dní, pošli pripomienku
   * ak ešte nebola poslaná (reminderSentAt).
   */
  @Cron('0 7 * * *')
  async dailyReminders() {
    const in30 = new Date(Date.now() + 30 * 86400_000);
    const due = await this.prisma.revision.findMany({
      where: {
        dueDate: { lte: in30 },
        completedAt: null,
        reminderSentAt: null,
      },
      include: { building: { include: { memberships: { where: { role: { in: ['CHAIRMAN', 'MANAGER'] }, userId: { not: null } }, include: { user: true } } } } },
    });
    for (const r of due) {
      const users = r.building.memberships.map((m) => m.user!).filter(Boolean);
      const daysLeft = Math.max(0, Math.round((r.dueDate.getTime() - Date.now()) / 86400_000));
      for (const u of users) {
        await this.mail
          .send({
            to: u.email,
            subject: `DomovPlus — pripomienka revízie: ${r.title}`,
            text:
              `Dobrý deň ${u.firstName},\n\n` +
              `revízia "${r.title}" v budove ${r.building.name} je splatná o ${daysLeft} dní ` +
              `(${r.dueDate.toLocaleDateString('sk-SK')}).\n` +
              (r.contractorName
                ? `Kontakt: ${r.contractorName} ${r.contractorPhone ?? ''} ${r.contractorEmail ?? ''}\n`
                : 'Kontakt: dodávateľ ešte nie je uložený.\n') +
              `\nDomovPlus`,
          })
          .catch(() => void 0);
        await this.push
          .sendToUser(u.id, {
            title: `Revízia: ${r.title}`,
            body: `Splatná o ${daysLeft} dní. Prosím naplánujte návštevu.`,
            url: `/building/${r.buildingId}`,
          })
          .catch(() => void 0);
      }
      await this.prisma.revision.update({
        where: { id: r.id },
        data: { reminderSentAt: new Date() },
      });
      this.log.log(`Revision reminder sent: ${r.title} (${r.id})`);
    }
  }

  private assertAdmin(user: AuthedUser, buildingId: string) {
    const ok = user.memberships.some(
      (m) => m.buildingId === buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (!ok) throw new ForbiddenException();
  }

  private assertMember(user: AuthedUser, buildingId: string) {
    if (!user.memberships.some((m) => m.buildingId === buildingId)) {
      throw new ForbiddenException();
    }
  }
}

function addMonths(d: Date, months: number): Date {
  const n = new Date(d);
  n.setMonth(n.getMonth() + months);
  return n;
}
