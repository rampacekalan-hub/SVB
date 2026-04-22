import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsNumberString, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CreateApartmentDto {
  @IsString() buildingId!: string;
  @IsString() @MaxLength(20) unitNumber!: string;
  @IsOptional() @IsInt() floor?: number;
  @IsNumberString() area!: string;
  @IsNumberString() ownershipShare!: string;
}

class UpdateApartmentDto {
  @IsOptional() @IsString() @MaxLength(20) unitNumber?: string;
  @IsOptional() @IsInt() floor?: number;
  @IsOptional() @IsNumberString() area?: string;
  @IsOptional() @IsNumberString() ownershipShare?: string;
}

interface AuthedUser {
  id: string;
  memberships: Array<{ buildingId: string; role: string }>;
}

/**
 * Evidencia bytov — plný CRUD pre správcu budovy.
 *
 * Zoznam v `list` vráti byt + všetkých členov s metadátami pre tabuľku:
 *   - ownership share
 *   - kto je registrovaný vlastník (email, meno) alebo aktivačný kód, ak je nevyužitý
 *
 * Revidovateľnosť: každá zmena sa loguje v AuditEvent (UPDATE, DELETE, REGEN).
 */
@ApiTags('apartments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('apartments')
export class ApartmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Zoznam bytov v budove + členovia + stav aktivácie. */
  @Get('by-building/:buildingId')
  async list(@Req() req: { user: AuthedUser }, @Param('buildingId') buildingId: string) {
    this.assertMember(req.user, buildingId);
    const apts = await this.prisma.apartment.findMany({
      where: { buildingId },
      orderBy: { unitNumber: 'asc' },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, lastLoginAt: true, totpEnabled: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    const totalBuildingShare = apts.reduce((s, a) => s + Number(a.ownershipShare), 0);
    return apts.map((a) => {
      const owners = a.memberships.filter((m) => m.role === 'OWNER');
      const registered = owners.filter((m) => m.userId);
      const pendingCode = owners.find((m) => !m.userId && m.activationCode);
      return {
        id: a.id,
        unitNumber: a.unitNumber,
        floor: a.floor,
        area: a.area.toString(),
        ownershipShare: a.ownershipShare.toString(),
        sharePercent: totalBuildingShare > 0
          ? Number(((Number(a.ownershipShare) / totalBuildingShare) * 100).toFixed(3))
          : 0,
        registeredOwners: registered.map((m) => ({
          membershipId: m.id,
          user: m.user,
          verifiedAt: m.verifiedAt,
        })),
        pendingActivation: pendingCode
          ? { membershipId: pendingCode.id, code: pendingCode.activationCode }
          : null,
        createdAt: a.createdAt,
      };
    });
  }

  @Post()
  async create(@Req() req: { user: AuthedUser }, @Body() dto: CreateApartmentDto) {
    this.assertAdmin(req.user, dto.buildingId);
    const existing = await this.prisma.apartment.findUnique({
      where: { buildingId_unitNumber: { buildingId: dto.buildingId, unitNumber: dto.unitNumber } },
    });
    if (existing) {
      throw new BadRequestException(`Byt ${dto.unitNumber} už v budove existuje.`);
    }
    const code = randomBytes(6).toString('hex').toUpperCase();
    const apt = await this.prisma.$transaction(async (tx) => {
      const a = await tx.apartment.create({
        data: {
          buildingId: dto.buildingId,
          unitNumber: dto.unitNumber,
          floor: dto.floor ?? null,
          area: dto.area,
          ownershipShare: dto.ownershipShare,
        },
      });
      await tx.membership.create({
        data: {
          buildingId: dto.buildingId,
          apartmentId: a.id,
          role: 'OWNER',
          activationCode: code,
        },
      });
      return a;
    });
    await this.audit.record({
      actorId: req.user.id,
      action: 'APARTMENT_CREATED',
      resourceType: 'Apartment',
      resourceId: apt.id,
      payload: { unitNumber: apt.unitNumber, activationCode: code },
    });
    return { id: apt.id, activationCode: code };
  }

  @Patch(':id')
  async update(@Req() req: { user: AuthedUser }, @Param('id') id: string, @Body() dto: UpdateApartmentDto) {
    const apt = await this.prisma.apartment.findUnique({ where: { id } });
    if (!apt) throw new NotFoundException();
    this.assertAdmin(req.user, apt.buildingId);
    const updated = await this.prisma.apartment.update({
      where: { id },
      data: {
        unitNumber: dto.unitNumber ?? apt.unitNumber,
        floor: dto.floor ?? apt.floor,
        area: dto.area ?? apt.area,
        ownershipShare: dto.ownershipShare ?? apt.ownershipShare,
      },
    });
    await this.audit.record({
      actorId: req.user.id,
      action: 'APARTMENT_UPDATED',
      resourceType: 'Apartment',
      resourceId: id,
      payload: dto as any,
    });
    return updated;
  }

  @Delete(':id')
  async remove(@Req() req: { user: AuthedUser }, @Param('id') id: string) {
    const apt = await this.prisma.apartment.findUnique({
      where: { id },
      include: { _count: { select: { invoices: true, voteRecords: true, tickets: true } } },
    });
    if (!apt) throw new NotFoundException();
    this.assertAdmin(req.user, apt.buildingId);
    // Safety: nedovolíme vymazať byt, ktorý má históriu (faktúry, hlasy, tikety).
    const counts = apt._count as any;
    if (counts.invoices > 0 || counts.voteRecords > 0 || counts.tickets > 0) {
      throw new BadRequestException(
        `Byt ${apt.unitNumber} má záznamy (faktúry/hlasy/tikety) a nemožno ho vymazať. Kontaktujte support.`,
      );
    }
    await this.prisma.apartment.delete({ where: { id } });
    await this.audit.record({
      actorId: req.user.id,
      action: 'APARTMENT_DELETED',
      resourceType: 'Apartment',
      resourceId: id,
      payload: { unitNumber: apt.unitNumber },
    });
    return { ok: true };
  }

  /** Vygeneruje nový aktivačný kód pre byt — starý sa prepíše. */
  @Post(':id/regenerate-code')
  async regenerateCode(@Req() req: { user: AuthedUser }, @Param('id') id: string) {
    const apt = await this.prisma.apartment.findUnique({
      where: { id },
      include: { memberships: true },
    });
    if (!apt) throw new NotFoundException();
    this.assertAdmin(req.user, apt.buildingId);
    const pendingOwner = apt.memberships.find((m) => m.role === 'OWNER' && !m.userId);
    const code = randomBytes(6).toString('hex').toUpperCase();
    if (pendingOwner) {
      await this.prisma.membership.update({
        where: { id: pendingOwner.id },
        data: { activationCode: code },
      });
    } else {
      await this.prisma.membership.create({
        data: {
          buildingId: apt.buildingId,
          apartmentId: apt.id,
          role: 'OWNER',
          activationCode: code,
        },
      });
    }
    await this.audit.record({
      actorId: req.user.id,
      action: 'ACTIVATION_CODE_REGENERATED',
      resourceType: 'Apartment',
      resourceId: id,
      payload: { unitNumber: apt.unitNumber },
    });
    return { activationCode: code };
  }

  /** Odoberie vlastníka z bytu (zruší jeho membership). */
  @Delete('memberships/:membershipId')
  async removeMembership(
    @Req() req: { user: AuthedUser },
    @Param('membershipId') membershipId: string,
  ) {
    const m = await this.prisma.membership.findUnique({ where: { id: membershipId } });
    if (!m) throw new NotFoundException();
    this.assertAdmin(req.user, m.buildingId);
    await this.prisma.membership.delete({ where: { id: membershipId } });
    await this.audit.record({
      actorId: req.user.id,
      action: 'MEMBERSHIP_REMOVED',
      resourceType: 'Membership',
      resourceId: membershipId,
    });
    return { ok: true };
  }

  private assertMember(user: AuthedUser, buildingId: string) {
    if (!user.memberships.some((m) => m.buildingId === buildingId)) {
      throw new ForbiddenException();
    }
  }
  private assertAdmin(user: AuthedUser, buildingId: string) {
    const ok = user.memberships.some(
      (m) => m.buildingId === buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (!ok) throw new ForbiddenException('Iba predseda / správca môže upravovať byty.');
  }
}
