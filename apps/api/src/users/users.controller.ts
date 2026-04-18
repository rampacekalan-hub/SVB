import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class UpdatePreferencesDto {
  @IsOptional()
  @IsEnum(['SK', 'CS'])
  locale?: 'SK' | 'CS';

  @IsOptional()
  @IsBoolean()
  seniorMode?: boolean;
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@Req() req: { user: { id: string } }) {
    return this.users.me(req.user.id);
  }

  @Patch('me/preferences')
  updatePrefs(@Req() req: { user: { id: string } }, @Body() dto: UpdatePreferencesDto) {
    return this.users.updatePreferences(req.user.id, dto);
  }
}
