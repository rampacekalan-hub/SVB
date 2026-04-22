import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MeterType } from '@prisma/client';
import { EnergyService } from './energy.service';
import { EnergyAllocationService } from './energy-allocation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class RegisterMeterDto {
  @IsString()
  buildingId!: string;

  @IsOptional()
  @IsString()
  apartmentId?: string;

  @IsEnum(MeterType)
  type!: MeterType;

  @IsString()
  serialNumber!: string;

  @IsOptional()
  @IsString()
  label?: string;
}

class ReadingItemDto {
  @IsDateString()
  intervalStart!: string;

  @IsDateString()
  intervalEnd!: string;

  @IsString()
  value!: string;

  @IsOptional()
  @IsString()
  quality?: string;
}

class IngestDto {
  @IsString()
  meterSerial!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReadingItemDto)
  readings!: ReadingItemDto[];
}

class AllocateDto {
  @IsString()
  buildingId!: string;

  @IsDateString()
  intervalStart!: string;

  @IsDateString()
  intervalEnd!: string;
}

@ApiTags('energy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('energy')
export class EnergyController {
  constructor(
    private readonly energy: EnergyService,
    private readonly allocation: EnergyAllocationService,
  ) {}

  @Post('meters')
  register(@Req() req: { user: any }, @Body() dto: RegisterMeterDto) {
    return this.energy.registerMeter(req.user, dto);
  }

  @Post('readings')
  ingest(@Req() req: { user: any }, @Body() dto: IngestDto) {
    return this.energy.ingestReadings(req.user, {
      meterSerial: dto.meterSerial,
      readings: dto.readings.map((r) => ({
        intervalStart: new Date(r.intervalStart),
        intervalEnd: new Date(r.intervalEnd),
        value: r.value,
        quality: r.quality,
      })),
    });
  }

  @Post('allocate')
  allocate(@Body() dto: AllocateDto) {
    return this.allocation.allocateInterval(
      dto.buildingId,
      new Date(dto.intervalStart),
      new Date(dto.intervalEnd),
    );
  }

  @Get('dashboard/:apartmentId')
  dashboard(
    @Req() req: { user: any },
    @Param('apartmentId') apartmentId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.energy.apartmentDashboard(req.user, apartmentId, new Date(from), new Date(to));
  }
}
