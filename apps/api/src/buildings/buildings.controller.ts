import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { BuildingsService } from './buildings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

class GenerateCodeDto {
  @IsUUID()
  buildingId!: string;

  @IsUUID()
  apartmentId!: string;

  @IsEnum(['OWNER', 'CHAIRMAN', 'MAINTENANCE'])
  role!: 'OWNER' | 'CHAIRMAN' | 'MAINTENANCE';
}

@ApiTags('buildings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('buildings')
export class BuildingsController {
  constructor(private readonly buildings: BuildingsService) {}

  @Get()
  list(@Req() req: { user: { id: string } }) {
    return this.buildings.listForUser(req.user.id);
  }

  @Get(':id')
  detail(@Req() req: { user: any }, @Param('id') id: string) {
    return this.buildings.detail(req.user, id);
  }

  @Post('activation-code')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  generateCode(@Req() req: { user: any }, @Body() dto: GenerateCodeDto) {
    return this.buildings.generateActivationCode(req.user, dto);
  }
}
