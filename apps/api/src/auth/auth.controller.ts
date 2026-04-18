import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  LoginDto,
  RegisterDto,
  RefreshDto,
  ConfirmTotpDto,
} from './auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password, dto.totpToken);
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
}
