import {
  Body, Controller, Get, Param, Post, Req, UploadedFile,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PhonePairingService } from './phone-pairing.service';

@ApiTags('phone-pairing')
@Controller('phone-pairing')
export class PhonePairingController {
  constructor(private readonly svc: PhonePairingService) {}

  /** PC strana — vytvor session a získaj QR URL. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  @Post()
  create(@Req() req: { user: any }, @Body() dto: any) {
    return this.svc.create(req.user, dto);
  }

  /** PC strana — polling stav session. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id/status')
  status(@Req() req: { user: any }, @Param('id') id: string) {
    return this.svc.getStatus(req.user, id);
  }

  /** Mobil otvorí URL — bez auth, len token. Resolve metadata. */
  @Get('token/:token')
  resolve(@Param('token') token: string) {
    return this.svc.resolveToken(token);
  }

  /** Mobil upload — bez JWT, autorizuje token v URL. */
  @Post('token/:token/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  upload(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.svc.uploadFromMobile(token, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });
  }
}
