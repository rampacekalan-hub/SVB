import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { AnnouncementSeverity } from '@prisma/client';
import { AnnouncementsService } from './announcements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class PublishDto {
  @IsString()
  buildingId!: string;

  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(3)
  body!: string;

  @IsOptional()
  @IsEnum(AnnouncementSeverity)
  severity?: AnnouncementSeverity;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

@ApiTags('announcements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly svc: AnnouncementsService) {}

  @Post()
  publish(@Req() req: { user: any }, @Body() dto: PublishDto) {
    return this.svc.publish(req.user, {
      ...dto,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  @Get('feed')
  feed(@Req() req: { user: any }) {
    return this.svc.feed(req.user);
  }

  @Get('building/:buildingId')
  buildingFeed(@Req() req: { user: any }, @Param('buildingId') buildingId: string) {
    return this.svc.buildingFeed(req.user, buildingId);
  }

  @Patch('receipts/:id/read')
  read(@Req() req: { user: any }, @Param('id') id: string) {
    return this.svc.acknowledge(req.user, id);
  }
}
