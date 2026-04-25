/**
 * HealthController — dva endpointy:
 *
 *   GET /health       — rýchly liveness probe (200 OK ak proces žije)
 *   GET /health/full  — detailný stav komponentov (DB, storage, mail, push)
 *                       používa ho verejná /status stránka.
 *
 * Public (bez auth) — status page musí byť dostupná aj anonymom.
 */
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

type Component = 'ok' | 'degraded' | 'down';

interface FullHealth {
  api: Component;
  db: Component;
  storage: Component;
  mail: Component;
  push: Component;
  uptime: number;
  version: string;
  checkedAt: string;
}

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  ping() {
    return { status: 'ok', ts: new Date().toISOString() };
  }

  @Get('full')
  async full(): Promise<FullHealth> {
    const [db, storage] = await Promise.all([
      this.checkDb(),
      this.checkStorage(),
    ]);

    return {
      api: 'ok', // ak nás niekto zavolal, api žije
      db,
      storage,
      mail: process.env.SMTP_HOST ? 'ok' : 'degraded',
      push: process.env.VAPID_PUBLIC_KEY ? 'ok' : 'degraded',
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      version: process.env.APP_VERSION || '0.1.0',
      checkedAt: new Date().toISOString(),
    };
  }

  private async checkDb(): Promise<Component> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async checkStorage(): Promise<Component> {
    try {
      return (await this.storage.isReady()) ? 'ok' : 'degraded';
    } catch {
      return 'down';
    }
  }
}
