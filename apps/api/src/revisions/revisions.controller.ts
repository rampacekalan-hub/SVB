import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { RevisionType } from '@prisma/client';
import { RevisionsService } from './revisions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CreateRevisionDto {
  @IsString() buildingId!: string;
  @IsEnum(RevisionType) type!: RevisionType;
  @IsString() @MaxLength(200) title!: string;
  @IsDateString() dueDate!: string;
  @IsOptional() @IsInt() @Min(1) intervalMonths?: number;
  @IsOptional() @IsString() @MaxLength(200) contractorName?: string;
  @IsOptional() @IsString() @MaxLength(40) contractorPhone?: string;
  @IsOptional() @IsEmail() contractorEmail?: string;
  @IsOptional() @IsString() notes?: string;
}

class CompleteRevisionDto {
  @IsDateString() completedAt!: string;
  @IsOptional() @IsString() reportPdfKey?: string;
  @IsOptional() @IsString() notes?: string;
}

@ApiTags('revisions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('revisions')
export class RevisionsController {
  constructor(private readonly revisions: RevisionsService) {}

  @Post()
  create(@Req() req: { user: any }, @Body() dto: CreateRevisionDto) {
    return this.revisions.create(req.user, { ...dto, dueDate: new Date(dto.dueDate) });
  }

  @Get('building/:buildingId')
  list(@Req() req: { user: any }, @Param('buildingId') buildingId: string) {
    return this.revisions.list(req.user, buildingId);
  }

  @Post(':id/complete')
  complete(@Req() req: { user: any }, @Param('id') id: string, @Body() dto: CompleteRevisionDto) {
    return this.revisions.complete(req.user, id, {
      ...dto,
      completedAt: new Date(dto.completedAt),
    });
  }

  @Delete(':id')
  remove(@Req() req: { user: any }, @Param('id') id: string) {
    return this.revisions.remove(req.user, id);
  }
}
