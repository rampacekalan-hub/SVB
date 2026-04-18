import { Module } from '@nestjs/common';
import { EnergyController } from './energy.controller';
import { EnergyService } from './energy.service';
import { EnergyAllocationService } from './energy-allocation.service';

@Module({
  controllers: [EnergyController],
  providers: [EnergyService, EnergyAllocationService],
  exports: [EnergyService, EnergyAllocationService],
})
export class EnergyModule {}
