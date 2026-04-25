import { Module } from '@nestjs/common';
import { IncomingInvoicesController } from './incoming-invoices.controller';
import { IncomingInvoicesService } from './incoming-invoices.service';
import { OcrService } from './ocr.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SuppliersModule } from '../suppliers/suppliers.module';

@Module({
  imports: [PrismaModule, SuppliersModule],
  controllers: [IncomingInvoicesController],
  providers: [IncomingInvoicesService, OcrService],
  exports: [IncomingInvoicesService],
})
export class IncomingInvoicesModule {}
