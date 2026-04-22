import { Module } from '@nestjs/common';
import { VotingController } from './voting.controller';
import { VotingService } from './voting.service';
import { VotingTallyService } from './voting-tally.service';
import { VotingPdfService } from './voting-pdf.service';
import { VotingScheduler } from './voting.scheduler';
import { XadesService } from './xades.service';

@Module({
  controllers: [VotingController],
  providers: [VotingService, VotingTallyService, VotingPdfService, VotingScheduler, XadesService],
  exports: [VotingService, VotingTallyService],
})
export class VotingModule {}
