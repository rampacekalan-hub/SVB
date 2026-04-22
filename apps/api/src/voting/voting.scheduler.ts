import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { VotingService } from './voting.service';

/**
 * Automaticky uzatvára hlasovania, ktorým uplynul closesAt.
 * Beží každých 5 minút. Uzávierka je idempotentná — ak iný proces
 * stihol uzavrieť skôr, finalize() vráti BadRequest a my tu iba zalogujeme.
 */
@Injectable()
export class VotingScheduler {
  private readonly log = new Logger(VotingScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly voting: VotingService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoClose() {
    const due = await this.prisma.voting.findMany({
      where: { status: 'OPEN', closesAt: { lt: new Date() } },
      select: { id: true, title: true },
    });
    if (due.length === 0) return;
    this.log.log(`Auto-close: ${due.length} hlasovaní po uzávierke`);
    for (const v of due) {
      try {
        await this.voting.closeBySystem(v.id);
        this.log.log(`Uzavreté: ${v.title} (${v.id})`);
      } catch (err) {
        this.log.warn(`Auto-close zlyhal pre ${v.id}: ${(err as Error).message}`);
      }
    }
  }
}
