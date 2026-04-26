import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, InvoiceCategory, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { PushService } from '../push/push.service';

interface AuthedUser {
  id: string;
  memberships: Array<{ buildingId: string; apartmentId: string | null; role: string }>;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string));
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly push: PushService,
  ) {}

  /**
   * Vytvorenie faktúry pre byt (správca/predseda).
   * V reálnom nasadení by bola hromadne — pre jednoduchosť tu po jednej.
   */
  async createInvoice(
    user: AuthedUser,
    input: {
      buildingId: string;
      apartmentId: string;
      number: string;
      category: InvoiceCategory;
      period: string;
      amount: string;
      dueDate: Date;
      note?: string;
    },
  ) {
    this.assertAdmin(user, input.buildingId);
    const invoice = await this.prisma.invoice.create({
      data: {
        buildingId: input.buildingId,
        apartmentId: input.apartmentId,
        number: input.number,
        category: input.category,
        period: input.period,
        amount: input.amount,
        dueDate: input.dueDate,
        note: input.note,
        status: 'DUE',
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'INVOICE_CREATED',
      resourceType: 'Invoice',
      resourceId: invoice.id,
      payload: { number: invoice.number, amount: input.amount },
    });
    return invoice;
  }

  /** Zoznam faktúr pre konkrétny byt — vidí ich vlastník aj správca. */
  async listForApartment(user: AuthedUser, apartmentId: string) {
    const membership = user.memberships.find((m) => m.apartmentId === apartmentId);
    const isAdminOfBuilding = (bId: string) =>
      user.memberships.some(
        (m) => m.buildingId === bId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
      );
    const apt = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      select: { buildingId: true },
    });
    if (!apt) throw new NotFoundException();
    if (!membership && !isAdminOfBuilding(apt.buildingId)) {
      throw new ForbiddenException();
    }
    return this.prisma.invoice.findMany({
      where: { apartmentId },
      orderBy: { issuedAt: 'desc' },
      include: { payments: true },
    });
  }

  /**
   * Zostatok = súčet zostatkov neuhradených faktúr (amount - už priradené platby).
   * Pozitívne = vlastník dlhuje. Nula / záporné = bez nedoplatku.
   */
  async balanceForApartment(user: AuthedUser, apartmentId: string) {
    const invoices = await this.listForApartment(user, apartmentId);
    let outstanding = new Prisma.Decimal(0);
    let unpaidCount = 0;
    for (const inv of invoices) {
      if (inv.status !== 'DUE' && inv.status !== 'OVERDUE') continue;
      const paidForThis = inv.payments.reduce(
        (s, p) => s.plus(p.amount),
        new Prisma.Decimal(0),
      );
      const remaining = new Prisma.Decimal(inv.amount).minus(paidForThis);
      if (remaining.gt(0)) {
        outstanding = outstanding.plus(remaining);
        unpaidCount++;
      }
    }
    const unpaid = invoices.filter((i) => i.status === 'DUE' || i.status === 'OVERDUE');
    return {
      apartmentId,
      currency: 'EUR',
      outstanding: outstanding.toString(),
      unpaidCount,
      oldestDueDate: unpaid
        .map((i) => i.dueDate)
        .sort((a, b) => a.getTime() - b.getTime())[0],
    };
  }

  /**
   * Prehľad histórie platieb zoskupený po mesiacoch — pre chart na dashboarde.
   * Vracia posledných 12 mesiacov {month: '2026-04', paid: 169.50}.
   */
  async paymentHistory(user: AuthedUser, apartmentId: string) {
    const apt = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      select: { buildingId: true },
    });
    if (!apt) throw new NotFoundException();
    const isMine = user.memberships.some((m) => m.apartmentId === apartmentId);
    const isAdmin = user.memberships.some(
      (m) => m.buildingId === apt.buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (!isMine && !isAdmin) throw new ForbiddenException();

    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    since.setDate(1);
    const payments = await this.prisma.payment.findMany({
      where: { apartmentId, paidAt: { gte: since } },
      orderBy: { paidAt: 'asc' },
    });
    const byMonth = new Map<string, { paid: number; count: number }>();
    for (const p of payments) {
      const key = p.paidAt.toISOString().slice(0, 7); // YYYY-MM
      const bucket = byMonth.get(key) ?? { paid: 0, count: 0 };
      bucket.paid += Number(p.amount);
      bucket.count += 1;
      byMonth.set(key, bucket);
    }
    // Naplň chýbajúce mesiace nulou (12 mesiacov)
    const result: Array<{ month: string; paid: number; count: number }> = [];
    const cursor = new Date(since);
    for (let i = 0; i < 13; i++) {
      const key = cursor.toISOString().slice(0, 7);
      const bucket = byMonth.get(key) ?? { paid: 0, count: 0 };
      result.push({ month: key, paid: Number(bucket.paid.toFixed(2)), count: bucket.count });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return result;
  }

  /**
   * Hromadné vystavenie rovnakej faktúry všetkým bytom v budove.
   * Používa sa pri mesačnej dávke („zálohy za teplo za apríl 2026").
   * Číslo faktúry = <period>-<unitNumber> napr. 2026-04-01 aby bolo unikátne.
   */
  async issueBulkForBuilding(
    user: AuthedUser,
    input: {
      buildingId: string;
      category: InvoiceCategory;
      period: string;
      amount: string;
      dueDate: Date;
      note?: string;
    },
  ): Promise<{ created: number; skipped: number; rows: Array<{ apartmentId: string; invoiceId: string; number: string }>; errors: Array<{ apartmentId: string; unitNumber: string; message: string }> }> {
    const admin = user.memberships.some(
      (m) => m.buildingId === input.buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (!admin) throw new ForbiddenException();

    const apartments = await this.prisma.apartment.findMany({
      where: { buildingId: input.buildingId },
      orderBy: { unitNumber: 'asc' },
    });

    const result = { created: 0, skipped: 0, rows: [] as any[], errors: [] as any[] };
    for (const apt of apartments) {
      const number = `${input.period}-${apt.unitNumber}`;
      try {
        // Ak už existuje (buildingId + number unique), preskočíme idempotentne.
        const exists = await this.prisma.invoice.findUnique({
          where: { buildingId_number: { buildingId: input.buildingId, number } },
        });
        if (exists) {
          result.skipped++;
          continue;
        }
        const inv = await this.prisma.invoice.create({
          data: {
            buildingId: input.buildingId,
            apartmentId: apt.id,
            number,
            category: input.category,
            period: input.period,
            amount: input.amount,
            dueDate: input.dueDate,
            note: input.note,
            status: 'DUE',
          },
        });
        result.created++;
        result.rows.push({ apartmentId: apt.id, invoiceId: inv.id, number });
      } catch (e) {
        result.errors.push({ apartmentId: apt.id, unitNumber: apt.unitNumber, message: (e as Error).message });
      }
    }
    await this.audit.record({
      actorId: user.id,
      action: 'INVOICES_BULK_ISSUED',
      resourceType: 'Building',
      resourceId: input.buildingId,
      payload: { period: input.period, category: input.category, created: result.created, skipped: result.skipped },
    });
    return result;
  }

  /**
   * Prehľad platieb pre celú budovu — pre stránku Platby v admin shell.
   * Agreguje po bytoch: koľko dlží, koľko zaplatil, najstaršia neuhradená.
   */
  async buildingPaymentsOverview(user: AuthedUser, buildingId: string) {
    const admin = user.memberships.some(
      (m) => m.buildingId === buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (!admin) throw new ForbiddenException();

    const apartments = await this.prisma.apartment.findMany({
      where: { buildingId },
      orderBy: { unitNumber: 'asc' },
      include: {
        memberships: {
          where: { role: 'OWNER' },
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
        invoices: { include: { payments: true }, orderBy: { dueDate: 'asc' } },
      },
    });

    let totalOutstanding = new Prisma.Decimal(0);
    let totalPaid = new Prisma.Decimal(0);
    const rows = apartments.map((a) => {
      let outstanding = new Prisma.Decimal(0);
      let paid = new Prisma.Decimal(0);
      let unpaid = 0;
      let oldestDueDate: Date | null = null;
      for (const inv of a.invoices) {
        if (inv.status === 'DUE' || inv.status === 'OVERDUE') {
          const paidFor = inv.payments.reduce((s, p) => s.plus(p.amount), new Prisma.Decimal(0));
          const rem = new Prisma.Decimal(inv.amount).minus(paidFor);
          if (rem.gt(0)) {
            outstanding = outstanding.plus(rem);
            unpaid++;
            if (!oldestDueDate || inv.dueDate < oldestDueDate) oldestDueDate = inv.dueDate;
          }
        }
        for (const p of inv.payments) paid = paid.plus(p.amount);
      }
      totalOutstanding = totalOutstanding.plus(outstanding);
      totalPaid = totalPaid.plus(paid);
      const owner = a.memberships[0]?.user;
      return {
        apartmentId: a.id,
        unitNumber: a.unitNumber,
        floor: a.floor,
        owner: owner ? `${owner.firstName} ${owner.lastName}` : null,
        ownerEmail: owner?.email ?? null,
        outstanding: outstanding.toString(),
        paid: paid.toString(),
        unpaidCount: unpaid,
        oldestDueDate,
        daysOverdue: oldestDueDate ? Math.max(0, Math.round((Date.now() - oldestDueDate.getTime()) / 86400_000)) : 0,
      };
    });

    rows.sort((a, b) => Number(b.outstanding) - Number(a.outstanding));

    return {
      buildingId,
      totalOutstanding: totalOutstanding.toString(),
      totalPaid: totalPaid.toString(),
      apartmentsCount: apartments.length,
      unpaidApartments: rows.filter((r) => Number(r.outstanding) > 0).length,
      rows,
    };
  }

  /**
   * Poslanie upomienky konkrétnemu vlastníkovi bytu.
   * Vypočíta nedoplatok, pošle email (ak máme ownerov email), push notifikáciu
   * a zapíše audit event. Keď SMTP/VAPID nie sú nakonfigurované, správa sa iba
   * loguje — business logika zostáva idempotentná.
   */
  async sendReminder(user: AuthedUser, apartmentId: string) {
    const apt = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      include: {
        building: { select: { name: true } },
        memberships: {
          where: { role: 'OWNER' },
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
        invoices: {
          where: { status: { in: ['DUE', 'OVERDUE'] } },
          include: { payments: true },
          orderBy: { dueDate: 'asc' },
        },
      },
    });
    if (!apt) throw new NotFoundException();
    const admin = user.memberships.some(
      (m) => m.buildingId === apt.buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (!admin) throw new ForbiddenException();

    // Výpočet nedoplatku
    let outstanding = new Prisma.Decimal(0);
    const lines: string[] = [];
    for (const inv of apt.invoices) {
      const paidFor = inv.payments.reduce((s, p) => s.plus(p.amount), new Prisma.Decimal(0));
      const rem = new Prisma.Decimal(inv.amount).minus(paidFor);
      if (rem.gt(0)) {
        outstanding = outstanding.plus(rem);
        const dueDate = inv.dueDate.toLocaleDateString('sk-SK');
        lines.push(`• ${inv.number} (${inv.period}) — ${Number(rem).toFixed(2)} € · splatnosť ${dueDate}`);
      }
    }

    const owner = apt.memberships[0]?.user;
    const sender = user as unknown as { firstName?: string; lastName?: string; email?: string };

    // Pošli email adresátom, ktorí ho majú uvedený
    const recipients = apt.memberships
      .map((m) => m.user)
      .filter((u): u is NonNullable<typeof u> => !!u && !!u.email);

    const totalStr = outstanding.toFixed(2);
    for (const r of recipients) {
      await this.mail
        .send({
          to: r.email,
          subject: `Floory — pripomenutie platby ${totalStr} € (byt ${apt.unitNumber})`,
          text:
            `Dobrý deň ${r.firstName},\n\n` +
            `pripomíname vám neuhradené platby za byt ${apt.unitNumber} v budove ` +
            `${apt.building.name}. Aktuálny nedoplatok je ${totalStr} €.\n\n` +
            (lines.length > 0 ? `Nezaplatené faktúry:\n${lines.join('\n')}\n\n` : '') +
            `Úhradu môžete urobiť priamo z appky cez QR kód (funkcia „Faktúry"), ` +
            `alebo bankovým prevodom — číslo faktúry použite ako variabilný symbol.\n\n` +
            `Ak už bola platba odoslaná, tento email ignorujte — spárovanie ` +
            `môže trvať 1–2 dni po príchode na účet SVB.\n\n` +
            `S pozdravom,\n` +
            `správa budovy ${apt.building.name}`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
              <h2 style="color:#b45309;margin:0 0 12px">Pripomenutie platby</h2>
              <p>Dobrý deň ${escapeHtml(r.firstName)},</p>
              <p>pripomíname vám neuhradené platby za byt <strong>${escapeHtml(apt.unitNumber)}</strong>
                 v budove <strong>${escapeHtml(apt.building.name)}</strong>.</p>
              <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:16px 0">
                <div style="color:#78716c;font-size:13px">Aktuálny nedoplatok</div>
                <div style="font-size:28px;font-weight:700;color:#b45309">${totalStr} €</div>
              </div>
              ${lines.length > 0 ? `<ul style="color:#44403c">${lines.map((l) => `<li>${escapeHtml(l.replace(/^•\s*/, ''))}</li>`).join('')}</ul>` : ''}
              <p style="color:#44403c;font-size:14px">
                Úhradu urobíte priamo z appky cez QR kód, alebo bankovým prevodom —
                číslo faktúry použite ako variabilný symbol.
              </p>
              <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0" />
              <p style="color:#a8a29e;font-size:12px">
                Ak už bola platba odoslaná, tento email ignorujte — spárovanie môže trvať 1–2 dni.
              </p>
            </div>`,
        })
        .catch((e) => this.auditAnd(user.id, 'PAYMENT_REMINDER_MAIL_FAILED', r.id, { error: (e as Error).message }));
    }

    // Push notifikácia (ak je VAPID nakonfigurovaný)
    if (owner) {
      await this.push
        .sendToUser(owner.id, {
          title: 'Pripomenutie platby',
          body: `Nedoplatok ${totalStr} € za byt ${apt.unitNumber}. Otvoriť faktúry.`,
          url: '/moj-dom/faktury',
        })
        .catch(() => void 0);
    }

    await this.audit.record({
      actorId: user.id,
      action: 'PAYMENT_REMINDER_SENT',
      resourceType: 'Apartment',
      resourceId: apartmentId,
      payload: {
        unitNumber: apt.unitNumber,
        outstandingEur: totalStr,
        recipients: recipients.length,
        unpaidCount: apt.invoices.length,
      },
    });
    return {
      ok: true,
      outstandingEur: totalStr,
      recipients: recipients.length,
      unpaidCount: apt.invoices.length,
    };
  }

  private async auditAnd(actorId: string, action: string, resourceId: string, payload?: any) {
    await this.audit.record({ actorId, action, resourceType: 'Apartment', resourceId, payload });
  }

  async markPaid(user: AuthedUser, invoiceId: string, amount: string, paidAt: Date) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { buildingId: true, apartmentId: true, status: true },
    });
    if (!invoice) throw new NotFoundException();
    this.assertAdmin(user, invoice.buildingId);
    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          apartmentId: invoice.apartmentId,
          invoiceId,
          amount,
          paidAt,
          source: 'MANUAL',
        },
      }),
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID' },
      }),
    ]);
    await this.audit.record({
      actorId: user.id,
      action: 'INVOICE_PAID',
      resourceType: 'Invoice',
      resourceId: invoiceId,
      payload: { amount },
    });
    return payment;
  }

  private assertAdmin(user: AuthedUser, buildingId: string) {
    const ok = user.memberships.some(
      (m) => m.buildingId === buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (!ok) throw new ForbiddenException();
  }
}
