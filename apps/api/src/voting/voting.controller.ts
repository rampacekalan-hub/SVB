import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VotingService } from './voting.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MfaRequired, Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CastElectronicDto,
  CastPaperDto,
  CreateVotingDto,
} from './voting.dto';

@ApiTags('voting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('voting')
export class VotingController {
  constructor(private readonly voting: VotingService) {}

  @Post()
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  create(@Req() req: { user: any }, @Body() dto: CreateVotingDto) {
    return this.voting.create(req.user, {
      ...dto,
      opensAt: new Date(dto.opensAt),
      closesAt: new Date(dto.closesAt),
      meetingId: dto.meetingId,
    });
  }

  @Post(':id/open')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  open(@Req() req: { user: any }, @Param('id') id: string) {
    return this.voting.open(req.user, id);
  }

  @Post(':id/cast')
  @MfaRequired()
  @Roles('OWNER')
  castElectronic(
    @Req() req: { user: any },
    @Param('id') id: string,
    @Body() dto: CastElectronicDto,
  ) {
    return this.voting.castElectronic(req.user, {
      votingId: id,
      apartmentId: dto.apartmentId,
      choice: dto.choice,
      sessionFingerprint: dto.sessionFingerprint,
    });
  }

  @Post(':id/paper')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  castPaper(
    @Req() req: { user: any },
    @Param('id') id: string,
    @Body() dto: CastPaperDto,
  ) {
    return this.voting.castPaper(req.user, {
      votingId: id,
      apartmentId: dto.apartmentId,
      choice: dto.choice,
      paperBallotReference: dto.paperBallotReference,
      castAt: dto.castAt ? new Date(dto.castAt) : undefined,
      proxyFromApartmentId: dto.proxyFromApartmentId,
      proxyDocumentKey: dto.proxyDocumentKey,
    });
  }

  @Post(':id/close')
  @Roles('CHAIRMAN', 'MANAGER', 'ADMIN')
  close(@Req() req: { user: any }, @Param('id') id: string) {
    return this.voting.close(req.user, id);
  }

  @Get('building/:buildingId')
  list(@Req() req: { user: any }, @Param('buildingId') buildingId: string) {
    return this.voting.listForBuilding(req.user, buildingId);
  }

  @Get(':id')
  detail(@Req() req: { user: any }, @Param('id') id: string) {
    return this.voting.getDetail(req.user, id);
  }

  /** Vráti presigned URL pre PDF zápisnicu. Klient si ho otvorí v novom okne. */
  @Get(':id/minutes-url')
  async minutesUrl(@Req() req: { user: any }, @Param('id') id: string) {
    return this.voting.getMinutesDownloadUrl(req.user, id);
  }
}
