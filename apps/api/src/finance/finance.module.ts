import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { SepaQrService } from './sepa-qr.service';
import { BankImportService } from './bank-import.service';

@Module({
  controllers: [FinanceController],
  providers: [FinanceService, SepaQrService, BankImportService],
  exports: [FinanceService],
})
export class FinanceModule {}
