import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExternalRegistryService } from './external-registry.service';

@ApiTags('external-registry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('external-registry')
export class ExternalRegistryController {
  constructor(private readonly svc: ExternalRegistryService) {}

  /**
   * Auto-fill firmy podľa IČO.
   * Primárne SK (RPO), fallback na CZ (ARES).
   *
   *   GET /external-registry/lookup?ico=12345678&country=SK
   */
  @Get('lookup')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  lookup(@Query('ico') ico: string, @Query('country') country?: 'SK' | 'CZ') {
    return this.svc.lookup(ico, country);
  }

  /** Vyhľadanie podľa mena firmy (max 5 výsledkov). */
  @Get('search')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  search(@Query('q') q: string, @Query('country') country: 'SK' | 'CZ' = 'SK') {
    return this.svc.searchByName(q, country);
  }
}
