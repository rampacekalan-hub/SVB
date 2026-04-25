/**
 * IncomingInvoicesService — prijaté faktúry od dodávateľov.
 *
 * Workflow (predseda):
 *   1. Klikne „Pridať faktúru" → buď nahrá fotku/PDF, alebo zadá ručne.
 *   2. Backend: súbor → storage, OCR sa pokúsi vytiahnuť údaje (suma, IBAN, IČO, VS, dátum).
 *   3. Predseda potvrdí / opraví údaje → status = PENDING.
 *   4. Po úhrade ho označí ako PAID s dátumom a sumou.
 *
 * Auto-pairing dodávateľa:
 *   - Ak OCR vytiahne IČO a v DB existuje Supplier s rovnakým IČO,
 *     supplierId sa nastaví automaticky.
 */
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { IncomingInvoiceStatus } from '@prisma/client';

interface AuthedUser { id: string; }

@Injectable()
export class IncomingInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly suppliers: SuppliersService,
  ) {}

  async list(user: AuthedUser, buildingId: string, status?: IncomingInvoiceStatus) {
    await this.assertBuildingAccess(user, buildingId);
    return this.prisma.incomingInvoice.findMany({
      where: { buildingId, ...(status ? { status } : {}) },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        supplier: true,
        attachments: true,
      },
    });
  }

  async getOne(user: AuthedUser, id: string) {
    const inv = await this.prisma.incomingInvoice.findUnique({
      where: { id },
      include: { supplier: true, attachments: true },
    });
    if (!inv) throw new NotFoundException();
    await this.assertBuildingAccess(user, inv.buildingId);
    return inv;
  }

  async create(user: AuthedUser, dto: {
    buildingId: string;
    supplierId?: string;
    invoiceNumber?: string;
    variableSymbol?: string;
    issueDate?: string;
    dueDate?: string;
    taxableDate?: string;
    amount: string | number;
    currency?: string;
    iban?: string;
    description?: string;
    category?: string;
  }) {
    await this.assertBuildingAccess(user, dto.buildingId);
    return this.prisma.incomingInvoice.create({
      data: {
        buildingId: dto.buildingId,
        supplierId: dto.supplierId,
        invoiceNumber: dto.invoiceNumber,
        variableSymbol: dto.variableSymbol,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        taxableDate: dto.taxableDate ? new Date(dto.taxableDate) : undefined,
        amount: String(dto.amount),
        currency: dto.currency ?? 'EUR',
        iban: dto.iban,
        description: dto.description,
        category: dto.category,
        status: 'PENDING',
        createdById: user.id,
      },
      include: { supplier: true, attachments: true },
    });
  }

  async update(user: AuthedUser, id: string, patch: any) {
    const inv = await this.prisma.incomingInvoice.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException();
    await this.assertBuildingAccess(user, inv.buildingId);

    const data: any = { ...patch };
    if (patch.amount != null) data.amount = String(patch.amount);
    if (patch.issueDate) data.issueDate = new Date(patch.issueDate);
    if (patch.dueDate) data.dueDate = new Date(patch.dueDate);
    if (patch.taxableDate) data.taxableDate = new Date(patch.taxableDate);

    return this.prisma.incomingInvoice.update({
      where: { id },
      data,
      include: { supplier: true, attachments: true },
    });
  }

  async markPaid(user: AuthedUser, id: string, dto: { paidAt?: string; paidAmount?: string | number; paidNote?: string }) {
    const inv = await this.prisma.incomingInvoice.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException();
    await this.assertBuildingAccess(user, inv.buildingId);
    return this.prisma.incomingInvoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        paidAmount: dto.paidAmount != null ? String(dto.paidAmount) : inv.amount,
        paidNote: dto.paidNote,
      },
    });
  }

  async remove(user: AuthedUser, id: string) {
    const inv = await this.prisma.incomingInvoice.findUnique({
      where: { id },
      include: { attachments: true },
    });
    if (!inv) throw new NotFoundException();
    await this.assertBuildingAccess(user, inv.buildingId);

    // Vymaže prílohy zo storage (best-effort)
    for (const att of inv.attachments) {
      try { await this.storage.remove(att.storageKey); } catch { /* ignore */ }
    }
    await this.prisma.incomingInvoice.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Upload prílohy (fotka, PDF, sken) k existujúcej faktúre.
   * Volajúci najprv (alebo súčasne) môže vyrobiť faktúru cez `create`,
   * potom k nej posiela attachments. Alebo vytvorí cez `createFromUpload`.
   */
  async addAttachment(user: AuthedUser, invoiceId: string, file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }) {
    const inv = await this.prisma.incomingInvoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException();
    await this.assertBuildingAccess(user, inv.buildingId);

    const ext = (file.originalname.split('.').pop() ?? 'bin').toLowerCase();
    const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'bin';
    const key = `incoming-invoices/${inv.buildingId}/${invoiceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    const result = await this.storage.put(key, file.buffer, file.mimetype);

    return this.prisma.incomingInvoiceAttachment.create({
      data: {
        invoiceId,
        storageKey: result.storageKey,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: result.size,
        sha256: result.sha256,
        uploadedById: user.id,
      },
    });
  }

  async getAttachmentUrl(user: AuthedUser, attachmentId: string) {
    const att = await this.prisma.incomingInvoiceAttachment.findUnique({
      where: { id: attachmentId },
      include: { invoice: true },
    });
    if (!att) throw new NotFoundException();
    await this.assertBuildingAccess(user, att.invoice.buildingId);
    const url = await this.storage.getPresignedUrl(att.storageKey, 600);
    return { url, filename: att.filename, mimeType: att.mimeType };
  }

  async deleteAttachment(user: AuthedUser, attachmentId: string) {
    const att = await this.prisma.incomingInvoiceAttachment.findUnique({
      where: { id: attachmentId },
      include: { invoice: true },
    });
    if (!att) throw new NotFoundException();
    await this.assertBuildingAccess(user, att.invoice.buildingId);
    try { await this.storage.remove(att.storageKey); } catch { /* ignore */ }
    await this.prisma.incomingInvoiceAttachment.delete({ where: { id: attachmentId } });
    return { ok: true };
  }

  /**
   * Štatistiky pre dashboard — koľko nezaplatených, koľko po splatnosti, atď.
   */
  async getDashboard(user: AuthedUser, buildingId: string) {
    await this.assertBuildingAccess(user, buildingId);

    const now = new Date();
    const [pending, overdue, paidThisMonth, totalUnpaid] = await Promise.all([
      this.prisma.incomingInvoice.count({
        where: { buildingId, status: { in: ['PENDING', 'APPROVED'] } },
      }),
      this.prisma.incomingInvoice.count({
        where: { buildingId, status: { in: ['PENDING', 'APPROVED'] }, dueDate: { lt: now } },
      }),
      this.prisma.incomingInvoice.count({
        where: {
          buildingId,
          status: 'PAID',
          paidAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
      }),
      this.prisma.incomingInvoice.aggregate({
        where: { buildingId, status: { in: ['PENDING', 'APPROVED'] } },
        _sum: { amount: true },
      }),
    ]);

    return {
      pendingCount: pending,
      overdueCount: overdue,
      paidThisMonthCount: paidThisMonth,
      totalUnpaidAmount: totalUnpaid._sum.amount?.toString() ?? '0',
    };
  }

  private async assertBuildingAccess(user: AuthedUser, buildingId: string) {
    const m = await this.prisma.membership.findFirst({
      where: {
        userId: user.id,
        buildingId,
        role: { in: ['CHAIRMAN', 'MANAGER', 'ADMIN'] },
      },
    });
    if (!m) throw new ForbiddenException('Nemáte oprávnenie pre túto budovu.');
  }
}
