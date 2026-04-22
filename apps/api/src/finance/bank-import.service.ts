import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface AuthedUser {
  id: string;
  memberships: Array<{ buildingId: string; role: string }>;
}

export interface BankImportRow {
  paidAt: string;
  amount: string;
  reference?: string;
  note?: string;
}

export interface BankImportResult {
  matched: number;
  unmatched: number;
  errors: Array<{ row: number; message: string }>;
  matches: Array<{ row: number; invoiceNumber: string; amount: string }>;
  unmatchedRows: Array<{ row: number; reference: string | null; amount: string; paidAt: string }>;
}

/**
 * CSV import bankového výpisu. Akceptujeme slovensko/česko bežný formát:
 *   paidAt;amount;reference;note
 *   2026-04-10;124.50;202604000002;Zalohy sluzby
 *
 * Reference sa pokúsi spárovať s číslom faktúry — ak match, vytvoríme Payment
 * a faktúru označíme ako PAID. Ak nie, riadok ide do unmatched zoznamu a správca
 * ho spáruje ručne.
 */
@Injectable()
export class BankImportService {
  private readonly log = new Logger(BankImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async importCsv(
    user: AuthedUser,
    buildingId: string,
    file: Buffer,
  ): Promise<BankImportResult> {
    this.assertAdmin(user, buildingId);

    const text = file.toString('utf8').replace(/^\uFEFF/, '');
    let rows: BankImportRow[];
    try {
      rows = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: [';', ','],
        relax_column_count: true,
      }) as BankImportRow[];
    } catch (err) {
      throw new Error('CSV sa nepodarilo prečítať: ' + (err as Error).message);
    }

    const result: BankImportResult = {
      matched: 0,
      unmatched: 0,
      errors: [],
      matches: [],
      unmatchedRows: [],
    };

    const invoices = await this.prisma.invoice.findMany({
      where: { buildingId },
      select: { id: true, number: true, apartmentId: true, amount: true, status: true },
    });
    // Index podľa čísla faktúry pre rýchle párovanie (case-insensitive).
    const byNumber = new Map<string, (typeof invoices)[number]>();
    for (const inv of invoices) byNumber.set(normalizeRef(inv.number), inv);

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // 1-based + header
      const row = rows[i];
      try {
        if (!row.paidAt || !row.amount) {
          throw new Error('Chýba paidAt alebo amount.');
        }
        const amount = normalizeAmount(row.amount);
        const paidAt = new Date(row.paidAt);
        if (Number.isNaN(paidAt.getTime())) throw new Error(`Neplatný dátum: ${row.paidAt}`);
        const ref = row.reference ? normalizeRef(row.reference) : null;

        const invoice = ref ? byNumber.get(ref) : undefined;
        if (invoice) {
          await this.prisma.$transaction([
            this.prisma.payment.create({
              data: {
                apartmentId: invoice.apartmentId,
                invoiceId: invoice.id,
                amount,
                paidAt,
                reference: row.reference,
                source: 'BANK_IMPORT',
              },
            }),
            this.prisma.invoice.update({
              where: { id: invoice.id },
              data: { status: 'PAID' },
            }),
          ]);
          result.matched++;
          result.matches.push({ row: rowNum, invoiceNumber: invoice.number, amount });
        } else {
          result.unmatched++;
          result.unmatchedRows.push({
            row: rowNum,
            reference: row.reference ?? null,
            amount,
            paidAt: paidAt.toISOString(),
          });
        }
      } catch (err) {
        result.errors.push({ row: rowNum, message: (err as Error).message });
      }
    }

    await this.audit.record({
      actorId: user.id,
      action: 'BANK_FEED_IMPORTED',
      resourceType: 'Building',
      resourceId: buildingId,
      payload: {
        matched: result.matched,
        unmatched: result.unmatched,
        errors: result.errors.length,
      },
    });

    return result;
  }

  private assertAdmin(user: AuthedUser, buildingId: string) {
    const ok = user.memberships.some(
      (m) => m.buildingId === buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (!ok) throw new ForbiddenException();
  }
}

function normalizeRef(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '');
}

function normalizeAmount(v: string): string {
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`Neplatná suma: ${v}`);
  return new Prisma.Decimal(s).toString();
}
