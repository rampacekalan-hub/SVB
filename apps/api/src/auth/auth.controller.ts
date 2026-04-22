import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  LoginDto,
  RegisterDto,
  RegisterAdminDto,
  RefreshDto,
  ConfirmTotpDto,
  PasswordResetRequestDto,
  PasswordResetConfirmDto,
} from './auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('register-admin')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  registerAdmin(@Body() dto: RegisterAdminDto) {
    return this.auth.registerAdmin(dto);
  }

  /**
   * Non-consuming preview aktivačného kódu.
   * Ukáže užívateľovi kontext (budova, byt, rola) ešte pred tým, než
   * zadá heslo a potvrdí registráciu — prevencia proti preklepom kódu.
   */
  @Get('activation-code/:code/preview')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  previewCode(@Param('code') code: string) {
    return this.auth.previewActivationCode(code);
  }

  /** Pripojenie aktivačného kódu k už prihlásenému účtu. */
  @Post('activation-code/:code/link')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  linkCode(@Req() req: { user: { id: string } }, @Param('code') code: string) {
    return this.auth.linkActivationCodeToUser(req.user.id, code);
  }

  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password, dto.totpToken);
  }

  @Post('password/reset-request')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  passwordResetRequest(@Body() dto: PasswordResetRequestDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Post('password/reset')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  passwordResetConfirm(@Body() dto: PasswordResetConfirmDto) {
    return this.auth.confirmPasswordReset(dto.token, dto.newPassword);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Post('totp/enable')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  enableTotp(@Req() req: { user: { id: string } }) {
    return this.auth.enableTotp(req.user.id);
  }

  @Post('totp/confirm')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  confirmTotp(@Req() req: { user: { id: string } }, @Body() dto: ConfirmTotpDto) {
    return this.auth.confirmTotp(req.user.id, dto.token);
  }

  @Post('totp/recovery-codes')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  recoveryCodes(@Req() req: { user: { id: string } }) {
    return this.auth.generateRecoveryCodes(req.user.id);
  }

  @Get('sessions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  sessions(@Req() req: { user: { id: string } }) {
    return this.auth.listSessions(req.user.id);
  }

  @Delete('sessions/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  revokeSession(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.auth.revokeSession(req.user.id, id);
  }

  @Get('gdpr/export')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  gdprExport(@Req() req: { user: { id: string } }) {
    return this.auth.gdprExport(req.user.id);
  }

  @Delete('gdpr/delete')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  gdprDelete(@Req() req: { user: { id: string } }) {
    return this.auth.gdprDelete(req.user.id);
  }
}
