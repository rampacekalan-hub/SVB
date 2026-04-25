import { Module } from '@nestjs/common';
import { PhonePairingController } from './phone-pairing.controller';
import { PhonePairingService } from './phone-pairing.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PhonePairingController],
  providers: [PhonePairingService],
  exports: [PhonePairingService],
})
export class PhonePairingModule {}
