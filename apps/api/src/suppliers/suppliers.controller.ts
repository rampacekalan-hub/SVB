import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SuppliersService } from './suppliers.service';

@ApiTags('suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly svc: SuppliersService) {}

  @Get('building/:buildingId')
  list(@Req() req: { user: any }, @Param('buildingId') buildingId: string) {
    return this.svc.list(req.user, buildingId);
  }

  @Post()
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  create(@Req() req: { user: any }, @Body() dto: any) {
    return this.svc.create(req.user, dto);
  }

  @Patch(':id')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  update(@Req() req: { user: any }, @Param('id') id: string, @Body() patch: any) {
    return this.svc.update(req.user, id, patch);
  }

  @Delete(':id')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  remove(@Req() req: { user: any }, @Param('id') id: string) {
    return this.svc.remove(req.user, id);
  }

  @Get('lookup')
  lookup(@Query('buildingId') buildingId: string, @Query('ico') ico: string) {
    return this.svc.findByIco(buildingId, ico);
  }
}
