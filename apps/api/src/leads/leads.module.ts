import { Body, Controller, Module, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';

class CreateLeadDto {
  @IsEmail() email!: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsInt() @Min(1) units?: number;
  @IsOptional() @IsString() @MaxLength(40) source?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  /**
   * Otvorený endpoint z landing page — rate-limit 5/min/IP kvôli spamu.
   * Odosiela notifikačný email adminovi (MAIL_ADMIN_RECIPIENT) ak je SMTP nastavený.
   */
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async create(@Body() dto: CreateLeadDto) {
    const lead = await this.prisma.lead.create({
      data: {
        email: dto.email,
        phone: dto.phone ?? null,
        city: dto.city ?? null,
        units: dto.units ?? null,
        source: dto.source ?? 'landing',
        note: dto.note ?? null,
      },
    });
    await this.audit.record({
      action: 'LEAD_SUBMITTED',
      resourceType: 'Lead',
      resourceId: lead.id,
      payload: { email: lead.email, city: lead.city },
    });
    const recipient = process.env.MAIL_ADMIN_RECIPIENT;
    if (recipient) {
      await this.mail
        .send({
          to: recipient,
          subject: `DomovPlus — nový lead: ${dto.email}`,
          text:
            `Nový záujem o pilot:\n\n` +
            `Email:  ${dto.email}\n` +
            `Telefón: ${dto.phone ?? '—'}\n` +
            `Mesto:  ${dto.city ?? '—'}\n` +
            `Byty:   ${dto.units ?? '—'}\n` +
            `Zdroj:  ${dto.source ?? '—'}\n`,
        })
        .catch(() => void 0);
    }
    return { ok: true, id: lead.id };
  }
}

@Module({
  controllers: [LeadsController],
})
export class LeadsModule {}
