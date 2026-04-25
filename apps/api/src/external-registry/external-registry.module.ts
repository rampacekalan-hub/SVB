import { Module } from '@nestjs/common';
import { ExternalRegistryController } from './external-registry.controller';
import { ExternalRegistryService } from './external-registry.service';

@Module({
  controllers: [ExternalRegistryController],
  providers: [ExternalRegistryService],
  exports: [ExternalRegistryService],
})
export class ExternalRegistryModule {}
