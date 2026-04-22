import { Module } from '@nestjs/common';
import { RevisionsController } from './revisions.controller';
import { RevisionsService } from './revisions.service';

@Module({
  controllers: [RevisionsController],
  providers: [RevisionsService],
})
export class RevisionsModule {}
