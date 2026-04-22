import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { InvoiceCategory } from '@prisma/client';
import { FinanceService } from './finance.service';
import { SepaQrService } from './sepa-qr.service';
import { BankImportService } from './bank-import.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CreateInvoiceDto {
  @IsString() buildingId!: string;
  @IsString() apartmentId!: string;
  @IsString() @MaxLength(50) number!: string;
  @IsEnum(['MAINTENANCE_FUND', 'SERVICES', 'MANAGEMENT_FEE', 'ONE_TIME', 'OTHER'])
  category!: InvoiceCategory;
  @IsString() @MaxLength(20) period!: string;
  @IsNumberString() amount!: string;
  @IsDateString() dueDate!: string;
  @IsOptional() @IsString() note?: string;
}

class MarkPaidDto {
  @IsNumberString() amount!: string;
  @IsDateString() paidAt!: string;
}

/**
 * Nepovinné platobné údaje budovy používané pri SEPA QR. V produkcii
 * by boli uložené v Building entite — pre MVP vezmeme z env alebo pevne.
 */
function beneficiaryFor(buildingName: string) {
  return {
    beneficiaryName: buildingName,
    iban: process.env.BUILDING_IBAN ?? 'SK8312000000001987426353',
    bic: process.env.BUILDING_BIC ?? 'SUBASKBX',
  };
}

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly sepaQr: SepaQrService,
    private readonly bankImport: BankImportService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('invoices')
  create(@Req() req: { user: any }, @Body() dto: CreateInvoiceDto) {
    return this.finance.createInvoice(req.user, {
      ...dto,
      dueDate: new Date(dto.dueDate),
    });
  }

  @Get('apartment/:id/invoices')
  listForApartment(@Req() req: { user: any }, @Param('id') apartmentId: string) {
    return this.finance.listForApartment(req.user, apartmentId);
  }

  @Get('apartment/:id/balance')
  balance(@Req() req: { user: any }, @Param('id') apartmentId: string) {
    return this.finance.balanceForApartment(req.user, apartmentId);
  }

  @Get('apartment/:id/payment-history')
  paymentHistory(@Req() req: { user: any }, @Param('id') apartmentId: string) {
    return this.finance.paymentHistory(req.user, apartmentId);
  }

  /** Hromadné vystavenie faktúry pre všetky byty v budove. */
  @Post('building/:buildingId/issue-bulk')
  issueBulk(
    @Req() req: { user: any },
    @Param('buildingId') buildingId: string,
    @Body() dto: {
      category: InvoiceCategory;
      period: string;
      amount: string;
      dueDate: string;
      note?: string;
    },
  ) {
    return this.finance.issueBulkForBuilding(req.user, {
      buildingId,
      category: dto.category,
      period: dto.period,
      amount: dto.amount,
      dueDate: new Date(dto.dueDate),
      note: dto.note,
    });
  }

  @Get('building/:buildingId/payments-overview')
  paymentsOverview(@Req() req: { user: any }, @Param('buildingId') buildingId: string) {
    return this.finance.buildingPaymentsOverview(req.user, buildingId);
  }

  @Post('apartment/:id/send-reminder')
  sendReminder(@Req() req: { user: any }, @Param('id') apartmentId: string) {
    return this.finance.sendReminder(req.user, apartmentId);
  }

  @Post('invoices/:id/mark-paid')
  markPaid(
    @Req() req: { user: any },
    @Param('id') invoiceId: string,
    @Body() dto: MarkPaidDto,
  ) {
    return this.finance.markPaid(req.user, invoiceId, dto.amount, new Date(dto.paidAt));
  }

  /**
   * SEPA EPC QR kód faktúry (data URL PNG). Vlastník ho naskenuje
   * mobilnou bankou a predvyplní prevod.
   */
  @Get('invoices/:id/qr')
  async qr(@Req() req: { user: any }, @Param('id') invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { building: { select: { name: true, id: true } } },
    });
    if (!invoice) throw new NotFoundException();
    const authed = req.user as { memberships: Array<{ buildingId: string; apartmentId: string | null; role: string }> };
    const canView =
      authed.memberships.some(
        (m) => m.apartmentId === invoice.apartmentId,
      ) ||
      authed.memberships.some(
        (m) => m.buildingId === invoice.buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
      );
    if (!canView) throw new ForbiddenException();
    const ben = beneficiaryFor(invoice.building.name);
    const dataUrl = await this.sepaQr.buildDataUrl({
      beneficiaryName: ben.beneficiaryName,
      iban: ben.iban,
      bic: ben.bic,
      amountEur: invoice.amount.toString(),
      reference: invoice.number,
    });
    return {
      dataUrl,
      amount: invoice.amount.toString(),
      currency: invoice.currency,
      iban: ben.iban,
      reference: invoice.number,
    };
  }

  /**
   * Admin uploadne CSV výpis z banky — spárujeme platby s faktúrami
   * podľa čísla faktúry v referencii.
   */
  @Post('bank-import/:buildingId')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  async bankImportCsv(
    @Req() req: { user: any },
    @Param('buildingId') buildingId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Chýba CSV súbor.');
    return this.bankImport.importCsv(req.user, buildingId, file.buffer);
  }
}
