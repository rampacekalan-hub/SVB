import {
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
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CreateTicketDto {
  @IsUUID()
  buildingId!: string;

  @IsOptional()
  @IsUUID()
  apartmentId?: string;

  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(5)
  description!: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}

class SetStatusDto {
  @IsEnum(TicketStatus)
  status!: TicketStatus;
}

class AssignDto {
  @IsUUID()
  assigneeId!: string;
}

class CommentDto {
  @IsString()
  @MinLength(1)
  body!: string;
}

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  create(@Req() req: { user: any }, @Body() dto: CreateTicketDto) {
    return this.tickets.create(req.user, dto);
  }

  @Get('building/:buildingId')
  list(@Req() req: { user: any }, @Param('buildingId') buildingId: string) {
    return this.tickets.list(req.user, buildingId);
  }

  @Get(':id')
  detail(@Req() req: { user: any }, @Param('id') id: string) {
    return this.tickets.detail(req.user, id);
  }

  @Patch(':id/status')
  setStatus(@Req() req: { user: any }, @Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.tickets.setStatus(req.user, id, dto.status);
  }

  @Patch(':id/assign')
  assign(@Req() req: { user: any }, @Param('id') id: string, @Body() dto: AssignDto) {
    return this.tickets.assign(req.user, id, dto.assigneeId);
  }

  @Post(':id/comments')
  comment(@Req() req: { user: any }, @Param('id') id: string, @Body() dto: CommentDto) {
    return this.tickets.comment(req.user, id, dto.body);
  }

  @Post(':id/attachments')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  attach(
    @Req() req: { user: any },
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string },
  ) {
    return this.tickets.attach(req.user, id, { buffer: file.buffer, mimeType: file.mimetype });
  }
}
