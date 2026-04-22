import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MeetingStatus } from '@prisma/client';
import { MeetingsService } from './meetings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CreateMeetingDto {
  @IsString() buildingId!: string;
  @IsString() @MaxLength(200) title!: string;
  @IsDateString() scheduledAt!: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsString() agenda!: string;
}

class RsvpDto {
  @IsEnum(['YES', 'NO', 'MAYBE']) rsvp!: 'YES' | 'NO' | 'MAYBE';
}

class UpdateStatusDto {
  @IsEnum(['SCHEDULED', 'CANCELLED', 'COMPLETED']) status!: MeetingStatus;
  @IsOptional() @IsString() minutes?: string;
}

@ApiTags('meetings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Post()
  create(@Req() req: { user: any }, @Body() dto: CreateMeetingDto) {
    return this.meetings.create(req.user, {
      ...dto,
      scheduledAt: new Date(dto.scheduledAt),
    });
  }

  @Get('building/:buildingId')
  list(@Req() req: { user: any }, @Param('buildingId') buildingId: string) {
    return this.meetings.list(req.user, buildingId);
  }

  @Get(':id')
  detail(@Req() req: { user: any }, @Param('id') id: string) {
    return this.meetings.detail(req.user, id);
  }

  @Post(':id/rsvp')
  rsvp(@Req() req: { user: any }, @Param('id') id: string, @Body() dto: RsvpDto) {
    return this.meetings.rsvp(req.user, id, dto.rsvp);
  }

  @Patch(':id/status')
  updateStatus(@Req() req: { user: any }, @Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.meetings.updateStatus(req.user, id, dto.status, dto.minutes);
  }

  @Post(':id/minutes')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  async uploadMinutes(
    @Req() req: { user: any },
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Chýba PDF zápisnica (field: file).');
    return this.meetings.uploadMinutes(req.user, id, {
      buffer: file.buffer,
      mimeType: file.mimetype,
    });
  }

  @Get(':id/minutes/download')
  minutesDownload(@Req() req: { user: any }, @Param('id') id: string) {
    return this.meetings.minutesDownloadUrl(req.user, id);
  }
}
