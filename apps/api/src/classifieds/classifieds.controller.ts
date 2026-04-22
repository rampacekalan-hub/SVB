import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ClassifiedType } from '@prisma/client';
import { ClassifiedsService } from './classifieds.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CreateClassifiedDto {
  @IsString() buildingId!: string;
  @IsEnum(ClassifiedType) type!: ClassifiedType;
  @IsString() @MaxLength(200) title!: string;
  @IsString() @MaxLength(4000) body!: string;
  @IsOptional() @IsNumberString() priceEur?: string;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(40) contactApartment?: string;
}

@ApiTags('classifieds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('classifieds')
export class ClassifiedsController {
  constructor(private readonly classifieds: ClassifiedsService) {}

  @Post()
  create(@Req() req: { user: any }, @Body() dto: CreateClassifiedDto) {
    return this.classifieds.create(req.user, dto);
  }

  @Get('building/:buildingId')
  list(
    @Req() req: { user: any },
    @Param('buildingId') buildingId: string,
    @Query('type') type?: ClassifiedType,
  ) {
    return this.classifieds.list(req.user, buildingId, type);
  }

  @Patch(':id/close')
  close(@Req() req: { user: any }, @Param('id') id: string) {
    return this.classifieds.close(req.user, id);
  }
}
