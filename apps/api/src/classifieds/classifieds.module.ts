import { Module } from '@nestjs/common';
import { ClassifiedsController } from './classifieds.controller';
import { ClassifiedsService } from './classifieds.service';

@Module({
  controllers: [ClassifiedsController],
  providers: [ClassifiedsService],
})
export class ClassifiedsModule {}
