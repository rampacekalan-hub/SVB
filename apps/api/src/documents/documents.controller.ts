import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DocumentCategory } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class UploadDocumentDto {
  @IsString()
  buildingId!: string;

  @IsEnum(DocumentCategory)
  category!: DocumentCategory;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Req() req: { user: any },
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: { buffer: Buffer; mimetype: string },
  ) {
    return this.docs.upload(req.user, {
      ...dto,
      file: { buffer: file.buffer, mimeType: file.mimetype },
    });
  }

  @Get('building/:buildingId')
  list(
    @Req() req: { user: any },
    @Param('buildingId') buildingId: string,
    @Query('category') category?: DocumentCategory,
  ) {
    return this.docs.list(req.user, buildingId, category);
  }

  @Get(':id/download-url')
  download(@Req() req: { user: any }, @Param('id') id: string) {
    return this.docs.download(req.user, id);
  }
}
