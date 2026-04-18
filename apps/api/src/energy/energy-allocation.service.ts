import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Alokuje výrobu PV v danom 15-minútovom intervale medzi byty.
 * Zjednodušený model EDC: podiel sa určí podľa ownershipShare jednotky.
 * Reálne nasadenie môže vymeniť algoritmus za dynamické kľúče (spotreba v reálnom čase).
 */
@Injectable()
export class EnergyAllocationService {
  constructor(private readonly prisma: PrismaService) {}

  async allocateInterval(buildingId: string, intervalStart: Date, intervalEnd: Date) {
    const [pvReading, apartments] = await Promise.all([
      this.prisma.energyReading.findFirst({
        where: {
          intervalStart,
          meter: { buildingId, type: 'PV_PRODUCTION' },
        },
      }),
      this.prisma.apartment.findMany({
        where: { buildingId },
        select: { id: true, ownershipShare: true },
      }),
    ]);
    if (!pvReading || apartments.length === 0) return { allocated: 0 };

    let total = new Prisma.Decimal(0);
    for (const a of apartments) total = total.plus(a.ownershipShare);
    if (total.lte(0)) return { allocated: 0 };

    const rows = apartments.map((a) => {
      const share = a.ownershipShare.dividedBy(total);
      const kwh = pvReading.value.mul(share);
      return {
        apartmentId: a.id,
        intervalStart,
        intervalEnd,
        allocatedKwh: kwh,
        sharePercent: share,
      };
    });

    await this.prisma.energyAllocation.createMany({ data: rows, skipDuplicates: true });
    return { allocated: rows.length };
  }
}
