/**
 * SuppliersService — CRUD pre dodávateľov SVB / BD.
 *
 * Dodávateľ je opakujúca sa firma (energie, výťah, plynár, atď.)
 * Pri uploadu prijatej faktúry sa systém pokúsi rozpoznať dodávateľa podľa IČO
 * — ak existuje, automaticky priradí. Inak predseda dodávateľa vytvorí.
 */
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AuthedUser { id: string; }

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthedUser, buildingId: string) {
    await this.assertBuildingAccess(user, buildingId);
    return this.prisma.supplier.findMany({
      where: { buildingId },
      orderBy: [{ name: 'asc' }],
      include: { _count: { select: { invoices: true } } },
    });
  }

  async create(user: AuthedUser, dto: {
    buildingId: string;
    name: string;
    ico?: string;
    dic?: string;
    vatId?: string;
    iban?: string;
    email?: string;
    phone?: string;
    address?: string;
    category?: string;
    note?: string;
  }) {
    await this.assertBuildingAccess(user, dto.buildingId);
    return this.prisma.supplier.create({ data: dto });
  }

  async update(user: AuthedUser, id: string, patch: Partial<{
    name: string; ico: string | null; dic: string | null; vatId: string | null;
    iban: string | null; email: string | null; phone: string | null;
    address: string | null; category: string | null; note: string | null;
  }>) {
    const s = await this.prisma.supplier.findUnique({ where: { id } });
    if (!s) throw new NotFoundException();
    await this.assertBuildingAccess(user, s.buildingId);
    return this.prisma.supplier.update({ where: { id }, data: patch });
  }

  async remove(user: AuthedUser, id: string) {
    const s = await this.prisma.supplier.findUnique({ where: { id } });
    if (!s) throw new NotFoundException();
    await this.assertBuildingAccess(user, s.buildingId);
    await this.prisma.supplier.delete({ where: { id } });
    return { ok: true };
  }

  /** Vyhľadanie dodávateľa podľa IČO — používa OCR pri rozpoznaní faktúry. */
  async findByIco(buildingId: string, ico: string) {
    return this.prisma.supplier.findFirst({
      where: { buildingId, ico: { equals: ico.trim() } },
    });
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
