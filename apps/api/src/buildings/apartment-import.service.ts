import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as XLSX from 'xlsx';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface AuthedUser {
  id: string;
  memberships: Array<{ buildingId: string; role: string }>;
}

export interface ImportRow {
  unitNumber: string;
  floor?: number | null;
  area: string;
  ownershipShare: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  codesIssued: number;
  errors: Array<{ row: number; unitNumber?: string; message: string }>;
  rows: Array<{ unitNumber: string; activationCode: string }>;
}

/**
 * Očakávané hlavičky v xlsx (prvý list, prvý riadok):
 *   unitNumber | floor | area | ownershipShare
 * Akceptujeme aj slovenské synonymá: 'byt', 'poschodie', 'plocha', 'podiel'.
 * Každý novovytvorený byt dostane Membership role=OWNER s vygenerovaným
 * aktivačným kódom (12 hex znakov). Kód sa vlastníkovi doručí na papieri.
 */
@Injectable()
export class ApartmentImportService {
  private readonly log = new Logger(ApartmentImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async importFromXlsx(
    user: AuthedUser,
    buildingId: string,
    file: Buffer,
  ): Promise<ImportResult> {
    this.assertAdmin(user, buildingId);

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file, { type: 'buffer' });
    } catch {
      throw new BadRequestException('Súbor sa nepodarilo prečítať ako xlsx/csv.');
    }
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new BadRequestException('V súbore nie je žiadny list.');
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });

    const result: ImportResult = {
      created: 0,
      skipped: 0,
      codesIssued: 0,
      errors: [],
      rows: [],
    };

    for (let i = 0; i < raw.length; i++) {
      const rowNum = i + 2; // +2: 1-based plus header row
      const r = raw[i];
      try {
        const parsed = parseRow(r);
        const existing = await this.prisma.apartment.findUnique({
          where: {
            buildingId_unitNumber: { buildingId, unitNumber: parsed.unitNumber },
          },
        });
        if (existing) {
          result.skipped++;
          continue;
        }
        const code = randomBytes(6).toString('hex').toUpperCase();
        await this.prisma.$transaction(async (tx) => {
          const apt = await tx.apartment.create({
            data: {
              buildingId,
              unitNumber: parsed.unitNumber,
              floor: parsed.floor ?? null,
              area: parsed.area,
              ownershipShare: parsed.ownershipShare,
            },
          });
          await tx.membership.create({
            data: {
              buildingId,
              apartmentId: apt.id,
              role: 'OWNER',
              activationCode: code,
            },
          });
        });
        result.created++;
        result.codesIssued++;
        result.rows.push({ unitNumber: parsed.unitNumber, activationCode: code });
      } catch (err) {
        result.errors.push({
          row: rowNum,
          unitNumber: typeof r?.unitNumber === 'string' ? r.unitNumber : undefined,
          message: (err as Error).message,
        });
      }
    }

    await this.audit.record({
      actorId: user.id,
      action: 'APARTMENTS_IMPORTED',
      resourceType: 'Building',
      resourceId: buildingId,
      payload: { created: result.created, skipped: result.skipped, errors: result.errors.length },
    });

    return result;
  }

  /** Aktuálne nepoužité kódy (ešte neuplatnené) — pre PDF na tlač. */
  async listPendingCodes(user: AuthedUser, buildingId: string) {
    this.assertAdmin(user, buildingId);
    return this.prisma.membership.findMany({
      where: {
        buildingId,
        role: 'OWNER',
        userId: null,
        activationCode: { not: null },
      },
      include: { apartment: { select: { unitNumber: true, floor: true } } },
      orderBy: { apartment: { unitNumber: 'asc' } },
    });
  }

  private assertAdmin(user: AuthedUser, buildingId: string) {
    const ok = user.memberships.some(
      (m) => m.buildingId === buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (!ok) throw new ForbiddenException('Iba predseda / správca môže importovať byty.');
  }
}

function parseRow(raw: Record<string, any>): ImportRow {
  // Akceptuj viacero variantov hlavičiek (slovensky / anglicky, rôzne veľkosti)
  const get = (keys: string[]) => {
    for (const k of keys) {
      const hit = Object.keys(raw).find((h) => h.toLowerCase().trim() === k.toLowerCase());
      if (hit && raw[hit] !== null && raw[hit] !== '') return raw[hit];
    }
    return null;
  };

  const unitNumberRaw = get(['unitNumber', 'byt', 'č.bytu', 'cislobytu', 'unit']);
  const floor = get(['floor', 'poschodie', 'pod']);
  const area = get(['area', 'plocha', 'm2', 'výmera', 'vymera']);
  const share = get(['ownershipShare', 'podiel', 'share']);

  if (!unitNumberRaw) throw new Error('Chýba číslo bytu (stĺpec unitNumber / byt).');
  if (area === null) throw new Error('Chýba výmera bytu (area / plocha).');
  if (share === null) throw new Error('Chýba spoluvlastnícky podiel (ownershipShare / podiel).');

  const unitNumber = String(unitNumberRaw).trim();
  const areaStr = toDecimalString(area);
  const shareStr = toDecimalString(share);
  if (!/^\d+(\.\d+)?$/.test(areaStr)) throw new Error(`Neplatná výmera: ${area}`);
  if (!/^\d+(\.\d+)?$/.test(shareStr)) throw new Error(`Neplatný podiel: ${share}`);
  const floorNum = floor === null ? null : parseInt(String(floor), 10);
  if (floor !== null && Number.isNaN(floorNum)) throw new Error(`Neplatné poschodie: ${floor}`);

  return {
    unitNumber,
    floor: floorNum,
    area: areaStr,
    ownershipShare: shareStr,
  };
}

function toDecimalString(v: unknown): string {
  if (typeof v === 'number') return String(v);
  return String(v).trim().replace(',', '.');
}

export function buildTemplateXlsx(): Buffer {
  const rows = [
    { unitNumber: '01', floor: 1, area: 65.5, ownershipShare: 1666.666667 },
    { unitNumber: '02', floor: 1, area: 82.0, ownershipShare: 2088.0 },
    { unitNumber: '03', floor: 2, area: 65.5, ownershipShare: 1666.666667 },
  ];
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ['unitNumber', 'floor', 'area', 'ownershipShare'],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Byty');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
