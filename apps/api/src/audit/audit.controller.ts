import { Controller, ForbiddenException, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('verify')
  @Roles('ADMIN', 'CHAIRMAN', 'MANAGER')
  verify() {
    return this.audit.verifyChain();
  }

  @Get('building/:id')
  async buildingTimeline(
    @Req() req: { user: { memberships: Array<{ buildingId: string; role: string }> } },
    @Param('id') buildingId: string,
  ) {
    const ok = req.user.memberships.some(
      (m) => m.buildingId === buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
    );
    if (!ok) throw new ForbiddenException();
    return this.audit.buildingTimeline(buildingId);
  }
}
