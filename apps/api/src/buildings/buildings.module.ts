import { Module } from '@nestjs/common';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';
import { ApartmentImportService } from './apartment-import.service';
import { ActivationCodesPdfService } from './activation-codes-pdf.service';
import { ApartmentsController } from './apartments.controller';
import { MembersController } from './members.controller';

@Module({
  controllers: [BuildingsController, ApartmentsController, MembersController],
  providers: [BuildingsService, ApartmentImportService, ActivationCodesPdfService],
  exports: [BuildingsService],
})
export class BuildingsModule {}
