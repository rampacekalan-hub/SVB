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
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type Role = 'OWNER' | 'CHAIRMAN' | 'MANAGER' | 'MAINTENANCE' | 'ADMIN';

class CreateMembershipDto {
  @IsEnum(['OWNER', 'CHAIRMAN', 'MANAGER', 'MAINTENANCE', 'ADMIN'])
  role!: Role;

  @IsOptional() @IsString() apartmentId?: string;
  @IsOptional() @IsEmail() email?: string; // ak je zadaný a user existuje, priradíme
  @IsOptional() @IsString() inviteName?: string; // pre UI hint, nikde sa neukladá
}

class UpdateMembershipDto {
  @IsEnum(['OWNER', 'CHAIRMAN', 'MANAGER', 'MAINTENANCE', 'ADMIN'])
  role!: Role;
}

interface AuthedUser {
  id: string;
  email: string;
  memberships: Array<{ buildingId: string; role: string }>;
}

/**
 * Správa účastníkov budovy — pre predsedu / správcu.
 *   GET    /buildings/:id/members           zoznam všetkých memberships, zoskupený po rolách
 *   POST   /buildings/:id/members           pridá MAINTENANCE / CHAIRMAN / MANAGER (+ activation code alebo email-invite)
 *   PATCH  /buildings/:id/members/:mid      zmení rolu (napr. handover)
 *   DELETE /buildings/:id/members/:mid      odoberie účastníka z budovy
 *
 * Vlastníci (OWNER role) sa pridávajú cez ApartmentsController (priradený k bytu).
 * Tu v členstvách spravujeme non-owner role alebo výnimočne druhého OWNER-a (spolu-vlastníctvo).
 */
@ApiTags('members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('buildings/:buildingId/members')
export class MembersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  @Get()
  async list(@Req() req: { user: AuthedUser }, @Param('buildingId') buildingId: string) {
    this.assertAdmin(req.user, buildingId);
    const memberships = await this.prisma.membership.findMany({
      where: { buildingId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, totpEnabled: true, lastLoginAt: true } },
        apartment: { select: { id: true, unitNumber: true } },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return memberships.map((m) => ({
      id: m.id,
      role: m.role,
      apartment: m.apartment,
      user: m.user,
      verifiedAt: m.verifiedAt,
      pendingActivationCode: m.userId ? null : m.activationCode,
      createdAt: m.createdAt,
      isYou: m.userId === req.user.id,
    }));
  }

  @Post()
  async create(
    @Req() req: { user: AuthedUser },
    @Param('buildingId') buildingId: string,
    @Body() dto: CreateMembershipDto,
  ) {
    this.assertAdmin(req.user, buildingId);
    if (dto.role === 'OWNER' && !dto.apartmentId) {
      throw new BadRequestException('OWNER musí byť priradený k bytu (apartmentId).');
    }

    // Ak je zadaný email a užívateľ existuje, priradíme ho priamo.
    let existing = dto.email
      ? await this.prisma.user.findUnique({ where: { email: dto.email } })
      : null;

    const code = existing ? null : randomBytes(6).toString('hex').toUpperCase();
    const membership = await this.prisma.membership.create({
      data: {
        buildingId,
        apartmentId: dto.apartmentId ?? null,
        role: dto.role,
        userId: existing?.id ?? null,
        activationCode: code,
        verifiedAt: existing ? new Date() : null,
      },
    });

    // Pošli mail — buď s aktivačným kódom (nový user) alebo s notifikáciou pridania (existujúci)
    if (dto.email) {
      const building = await this.prisma.building.findUnique({ where: { id: buildingId }, select: { name: true } });
      const title = existing
        ? `DomovPlus — boli ste pridaný do budovy ${building?.name}`
        : `DomovPlus — pozvánka do budovy ${building?.name}`;
      const body = existing
        ? `Dobrý deň ${existing.firstName},\n\nBoli ste pridaný ako ${roleLabel(dto.role)} do budovy ${building?.name}. Prihláste sa na https://domovplus.sk/prihlasenie.\n\nDomovPlus`
        : `Dobrý deň ${dto.inviteName ?? ''},\n\nPozývame vás do budovy ${building?.name} ako ${roleLabel(dto.role)}. Zaregistrujte sa aktivačným kódom: ${code}\n\nhttps://domovplus.sk/registracia\n\nDomovPlus`;
      await this.mail.send({ to: dto.email, subject: title, text: body }).catch(() => void 0);
    }

    await this.audit.record({
      actorId: req.user.id,
      action: 'MEMBERSHIP_CREATED',
      resourceType: 'Membership',
      resourceId: membership.id,
      payload: { buildingId, role: dto.role, email: dto.email ?? null, linkedExisting: !!existing },
    });

    return {
      id: membership.id,
      role: membership.role,
      activationCode: code,
      linkedUser: existing ? { email: existing.email, firstName: existing.firstName, lastName: existing.lastName } : null,
    };
  }

  @Patch(':mid')
  async changeRole(
    @Req() req: { user: AuthedUser },
    @Param('buildingId') buildingId: string,
    @Param('mid') membershipId: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    this.assertAdmin(req.user, buildingId);
    const m = await this.prisma.membership.findUnique({ where: { id: membershipId } });
    if (!m || m.buildingId !== buildingId) throw new NotFoundException();

    // Bezpečnostný check — nesmieš sa sám degradovať, ak si posledný CHAIRMAN
    if (m.userId === req.user.id && m.role === 'CHAIRMAN' && dto.role !== 'CHAIRMAN') {
      const otherChair = await this.prisma.membership.count({
        where: { buildingId, role: 'CHAIRMAN', userId: { not: null }, id: { not: m.id } },
      });
      if (otherChair === 0) {
        throw new BadRequestException(
          'Ste jediný predseda tejto budovy. Najskôr pridajte druhého predsedu, potom môžete zmeniť svoju rolu.',
        );
      }
    }

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: { role: dto.role },
    });
    await this.audit.record({
      actorId: req.user.id,
      action: 'MEMBERSHIP_ROLE_CHANGED',
      resourceType: 'Membership',
      resourceId: membershipId,
      payload: { from: m.role, to: dto.role, targetUserId: m.userId },
    });
    return updated;
  }

  @Delete(':mid')
  async remove(
    @Req() req: { user: AuthedUser },
    @Param('buildingId') buildingId: string,
    @Param('mid') membershipId: string,
  ) {
    this.assertAdmin(req.user, buildingId);
    const m = await this.prisma.membership.findUnique({ where: { id: membershipId } });
    if (!m || m.buildingId !== buildingId) throw new NotFoundException();

    // Bezpečnosť: nezmaz posledného CHAIRMAN
    if (m.role === 'CHAIRMAN') {
      const otherChair = await this.prisma.membership.count({
        where: { buildingId, role: 'CHAIRMAN', id: { not: m.id } },
      });
      if (otherChair === 0) {
        throw new BadRequestException('Nemôžete zmazať posledného predsedu budovy.');
      }
    }
    await this.prisma.membership.delete({ where: { id: membershipId } });
    await this.audit.record({
      actorId: req.user.id,
      action: 'MEMBERSHIP_REMOVED',
      resourceType: 'Membership',
      resourceId: membershipId,
      payload: { buildingId, role: m.role },
    });
    return { ok: true };
  }

  private assertAdmin(user: AuthedUser, buildingId: string) {
    const ok = user.memberships.some(
      (m) => m.buildingId === buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (!ok) throw new ForbiddenException('Iba predseda alebo správca môže spravovať účastníkov.');
  }
}

function roleLabel(r: Role): string {
  return ({
    OWNER: 'vlastník',
    CHAIRMAN: 'predseda',
    MANAGER: 'správca',
    MAINTENANCE: 'údržbár',
    ADMIN: 'administrátor',
  } as Record<Role, string>)[r];
}
