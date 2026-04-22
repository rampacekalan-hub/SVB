import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { BuildingsService } from './buildings.service';
import { ApartmentImportService } from './apartment-import.service';
import { ActivationCodesPdfService } from './activation-codes-pdf.service';
import { buildTemplateXlsx } from './apartment-import.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

class GenerateCodeDto {
  @IsUUID()
  buildingId!: string;

  @IsUUID()
  apartmentId!: string;

  @IsEnum(['OWNER', 'CHAIRMAN', 'MAINTENANCE'])
  role!: 'OWNER' | 'CHAIRMAN' | 'MAINTENANCE';
}

class CreateBuildingDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(200)
  address!: string;

  @IsString()
  @MaxLength(100)
  city!: string;

  @IsString()
  @Length(3, 10)
  zip!: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  legalForm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  ico?: string;
}

@ApiTags('buildings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('buildings')
export class BuildingsController {
  constructor(
    private readonly buildings: BuildingsService,
    private readonly importer: ApartmentImportService,
    private readonly pdfs: ActivationCodesPdfService,
  ) {}

  @Get()
  list(@Req() req: { user: { id: string } }) {
    return this.buildings.listForUser(req.user.id);
  }

  @Post()
  create(@Req() req: { user: { id: string } }, @Body() dto: CreateBuildingDto) {
    return this.buildings.create(req.user.id, dto);
  }

  @Get(':id')
  detail(@Req() req: { user: any }, @Param('id') id: string) {
    return this.buildings.detail(req.user, id);
  }

  @Get(':id/admin-stats')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  adminStats(@Req() req: { user: any }, @Param('id') id: string) {
    return this.buildings.adminStats(req.user, id);
  }

  @Post('activation-code')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  generateCode(@Req() req: { user: any }, @Body() dto: GenerateCodeDto) {
    return this.buildings.generateActivationCode(req.user, dto);
  }

  /** Stiahne prázdnu xlsx šablónu pre import bytov. */
  @Get('import/template.xlsx')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  template(@Res() res: Response) {
    const buf = buildTemplateXlsx();
    res
      .status(200)
      .header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .header('Content-Disposition', 'attachment; filename="domovplus-byty-sablona.xlsx"')
      .send(buf);
  }

  /**
   * Nahrá xlsx so zoznamom bytov — vytvorí Apartment + Membership
   * s aktivačným kódom pre každý nový riadok. Duplicitné (rovnaké unitNumber)
   * sú preskočené.
   */
  @Post(':id/import-apartments')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async importApartments(
    @Req() req: { user: any },
    @Param('id') buildingId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Chýba súbor (field name: file).');
    return this.importer.importFromXlsx(req.user, buildingId, file.buffer);
  }

  /** PDF zoznam nevyužitých aktivačných kódov na tlač. */
  @Get(':id/activation-codes.pdf')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  async activationCodesPdf(
    @Req() req: { user: any },
    @Param('id') buildingId: string,
    @Res() res: Response,
  ) {
    const building = await this.buildings.detail(req.user, buildingId);
    const memberships = await this.importer.listPendingCodes(req.user, buildingId);
    const rows = memberships
      .filter((m) => m.apartment && m.activationCode)
      .map((m) => ({
        unitNumber: m.apartment!.unitNumber,
        floor: m.apartment!.floor ?? null,
        activationCode: m.activationCode!,
      }));
    const pdf = await this.pdfs.generate(building.name, rows);
    res
      .status(200)
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        `attachment; filename="domovplus-kody-${building.id}.pdf"`,
      )
      .send(pdf);
  }
}
