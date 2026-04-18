import { ForbiddenException, Injectable } from '@nestjs/common';
import { MeterType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface AuthedUser {
  id: string;
  memberships: Array<{ buildingId: string; apartmentId: string | null; role: string }>;
}

@Injectable()
export class EnergyService {
  constructor(private readonly prisma: PrismaService) {}

  async registerMeter(
    user: AuthedUser,
    input: {
      buildingId: string;
      apartmentId?: string;
      type: MeterType;
      serialNumber: string;
      label?: string;
    },
  ) {
    const allowed = user.memberships.some(
      (m) => m.buildingId === input.buildingId && ['MANAGER', 'CHAIRMAN', 'ADMIN'].includes(m.role),
    );
    if (!allowed) throw new ForbiddenException();
    return this.prisma.meter.create({
      data: {
        buildingId: input.buildingId,
        apartmentId: input.apartmentId,
        type: input.type,
        serialNumber: input.serialNumber,
        label: input.label,
        installedAt: new Date(),
      },
    });
  }

  async ingestReadings(
    user: AuthedUser,
    input: {
      meterSerial: string;
      readings: Array<{ intervalStart: Date; intervalEnd: Date; value: string; quality?: string }>;
    },
  ) {
    const meter = await this.prisma.meter.findUnique({ where: { serialNumber: input.meterSerial } });
    if (!meter) throw new ForbiddenException('Meter neexistuje.');
    const allowed = user.memberships.some(
      (m) =>
        m.buildingId === meter.buildingId &&
        ['MANAGER', 'CHAIRMAN', 'ADMIN', 'MAINTENANCE'].includes(m.role),
    );
    if (!allowed) throw new ForbiddenException();

    await this.prisma.energyReading.createMany({
      data: input.readings.map((r) => ({
        meterId: meter.id,
        intervalStart: r.intervalStart,
        intervalEnd: r.intervalEnd,
        value: new Prisma.Decimal(r.value),
        quality: r.quality ?? 'MEASURED',
      })),
      skipDuplicates: true,
    });
    return { ingested: input.readings.length };
  }

  async apartmentDashboard(user: AuthedUser, apartmentId: string, from: Date, to: Date) {
    const m = user.memberships.find(
      (m) => m.apartmentId === apartmentId && m.role === 'OWNER',
    );
    if (!m) throw new ForbiddenException();

    const [readings, allocations] = await Promise.all([
      this.prisma.energyReading.findMany({
        where: {
          meter: { apartmentId },
          intervalStart: { gte: from, lte: to },
        },
        include: { meter: { select: { type: true, serialNumber: true } } },
        orderBy: { intervalStart: 'asc' },
      }),
      this.prisma.energyAllocation.findMany({
        where: { apartmentId, intervalStart: { gte: from, lte: to } },
        orderBy: { intervalStart: 'asc' },
      }),
    ]);
    return { readings, pvAllocations: allocations };
  }
}
