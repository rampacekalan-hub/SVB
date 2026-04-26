import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { IncomingInvoicesService } from './incoming-invoices.service';
import { OcrService } from './ocr.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { ExternalRegistryService } from '../external-registry/external-registry.service';

@ApiTags('incoming-invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('incoming-invoices')
export class IncomingInvoicesController {
  constructor(
    private readonly svc: IncomingInvoicesService,
    private readonly ocr: OcrService,
    private readonly suppliers: SuppliersService,
    private readonly registry: ExternalRegistryService,
  ) {}

  @Get('building/:buildingId')
  list(
    @Req() req: { user: any },
    @Param('buildingId') buildingId: string,
    @Query('status') status?: any,
  ) {
    return this.svc.list(req.user, buildingId, status);
  }

  @Get('building/:buildingId/dashboard')
  dashboard(@Req() req: { user: any }, @Param('buildingId') buildingId: string) {
    return this.svc.getDashboard(req.user, buildingId);
  }

  @Get(':id')
  getOne(@Req() req: { user: any }, @Param('id') id: string) {
    return this.svc.getOne(req.user, id);
  }

  @Post()
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  create(@Req() req: { user: any }, @Body() dto: any) {
    return this.svc.create(req.user, dto);
  }

  @Patch(':id')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  update(@Req() req: { user: any }, @Param('id') id: string, @Body() patch: any) {
    return this.svc.update(req.user, id, patch);
  }

  @Post(':id/mark-paid')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  markPaid(@Req() req: { user: any }, @Param('id') id: string, @Body() dto: any) {
    return this.svc.markPaid(req.user, id, dto);
  }

  @Delete(':id')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  remove(@Req() req: { user: any }, @Param('id') id: string) {
    return this.svc.remove(req.user, id);
  }

  /** Upload prílohy (foto/PDF) k existujúcej faktúre. */
  @Post(':id/attachments')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  uploadAttachment(
    @Req() req: { user: any },
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.svc.addAttachment(req.user, id, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });
  }

  @Get('attachments/:id/url')
  attachmentUrl(@Req() req: { user: any }, @Param('id') id: string) {
    return this.svc.getAttachmentUrl(req.user, id);
  }

  @Delete('attachments/:id')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  removeAttachment(@Req() req: { user: any }, @Param('id') id: string) {
    return this.svc.deleteAttachment(req.user, id);
  }

  /**
   * OCR endpoint — predseda nahrá fotku, my vrátime extrakt + suggested supplier.
   * Vytvorenie faktúry je samostatný krok (predseda potvrdí).
   */
  @Post('ocr-preview')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, buildingId: { type: 'string' } } } })
  async ocrPreview(
    @Req() req: { user: any },
    @UploadedFile() file: Express.Multer.File,
    @Body('buildingId') buildingId: string,
  ) {
    // Univerzálne extract (PDF text alebo OCR podľa typu súboru)
    const extraction = await this.ocr.extract(file.buffer, file.mimetype);

    // Lookup dodávateľa podľa IČO — najprv v lokálnej DB
    let existingSupplier = null;
    if (extraction.ico) {
      existingSupplier = await this.suppliers.findByIco(buildingId, extraction.ico);
    }

    // Paralelne — fetch z RPO/ORSR ak máme IČO
    let registryData = null;
    if (extraction.ico) {
      try {
        registryData = await this.registry.lookup(extraction.ico, 'SK');
      } catch {
        // ignore — registry môže byť dočasne nedostupný
      }
    }

    // Detekcia rozdielov medzi DB a registrom (ak existujúci dodávateľ + máme registry data)
    const drift = this.detectSupplierDrift(existingSupplier, registryData);

    return {
      extraction,
      existingSupplier,
      registryData,
      drift,
      suggestedSupplier: existingSupplier ?? (registryData?.found ? registryData : null),
    };
  }

  /**
   * Porovná údaje z DB so súčasnými údajmi v RPO/ORSR.
   * Vráti pole rozdielov pre UI alert ("DIČ sa zmenil v RPO oproti vašej DB").
   */
  private detectSupplierDrift(existing: any, registry: any): Array<{ field: string; db: string; registry: string }> | null {
    if (!existing || !registry?.found) return null;
    const diffs: Array<{ field: string; db: string; registry: string }> = [];
    const compare = (field: string, dbVal?: string | null, regVal?: string | null) => {
      if (!regVal) return;
      const a = (dbVal ?? '').trim();
      const b = (regVal ?? '').trim();
      if (a && b && a !== b) diffs.push({ field, db: a, registry: b });
    };
    compare('Názov', existing.name, registry.name);
    compare('DIČ', existing.dic, registry.dic);
    compare('IČ DPH', existing.vatId, registry.vatId);
    compare('Adresa', existing.address, registry.address);
    return diffs.length > 0 ? diffs : null;
  }
}
