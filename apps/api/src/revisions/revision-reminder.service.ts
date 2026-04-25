/**
 * RevisionReminderService — denný cron, ktorý kontroluje revízie blížiace sa
 * k expirácii a posiela predsedovi pripomienku (email + push).
 *
 * Logika:
 *   - Každý deň o 09:00 SK / CZ času
 *   - Vyhľadá revízie kde `dueDate <= now + 30 dní` AND `reminderSentAt IS NULL`
 *   - Pre každú: email predsedovi/správcovi + push (ak má registrované zariadenie)
 *   - Po odoslaní zapíše `reminderSentAt = now()` aby sa to neopakovalo
 *
 * Druhá pripomienka (urgent) sa pošle 7 dní pred expiráciou — má vlastný flag,
 * preto stačí aby sme si poradili so semantikou: ak `reminderSentAt < dueDate - 7d`,
 * pošleme druhú pripomienku a updatne sa.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { PushService } from '../push/push.service';

const REVISION_LABEL: Record<string, string> = {
  BOILER: 'Kotol',
  ELEVATOR: 'Výťah',
  LIGHTNING_ROD: 'Bleskozvod',
  ELECTRICAL: 'Elektroinštalácia',
  GAS: 'Plynové rozvody',
  CHIMNEY: 'Komín',
  FIRE_SAFETY: 'Požiarna bezpečnosť',
  OTHER: 'Iné',
};

@Injectable()
export class RevisionReminderService {
  private readonly log = new Logger(RevisionReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly push: PushService,
  ) {}

  /** Denný cron: 09:00 SK/CZ — pripomienky 30 dní vopred. */
  @Cron('0 9 * * *', { timeZone: 'Europe/Bratislava' })
  async checkRevisions() {
    this.log.log('Spúšťam denný revision reminder check…');
    const stats = await this.runOnce();
    this.log.log(
      `Revision reminder dokončený: 30d=${stats.thirtyDay}, 7d=${stats.sevenDay}, prešvihnuté=${stats.overdue}`,
    );
  }

  /** Verejne volateľné z controllera (napr. manuálny trigger pre admina). */
  async runOnce() {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 1. PRVÁ PRIPOMIENKA — 30 dní vopred, ešte nikdy neoznámené
    const upcoming = await this.prisma.revision.findMany({
      where: {
        completedAt: null,
        reminderSentAt: null,
        dueDate: { lte: thirtyDaysFromNow, gt: now },
      },
      include: { building: { include: { memberships: { where: { role: { in: ['CHAIRMAN', 'MANAGER'] } }, include: { user: true } } } } },
    });

    let thirtyDay = 0;
    for (const rev of upcoming) {
      await this.notify(rev, 'thirty');
      await this.prisma.revision.update({
        where: { id: rev.id },
        data: { reminderSentAt: now },
      });
      thirtyDay++;
    }

    // 2. URGENTNÁ PRIPOMIENKA — 7 dní vopred, ešte nepripomenuté druhýkrát
    // Použijeme heuristiku: reminderSentAt < dueDate - 8 dní → 1. pripomienka už šla, 2. ešte nie.
    const urgent = await this.prisma.revision.findMany({
      where: {
        completedAt: null,
        dueDate: { lte: sevenDaysFromNow, gt: now },
        reminderSentAt: { not: null },
      },
      include: { building: { include: { memberships: { where: { role: { in: ['CHAIRMAN', 'MANAGER'] } }, include: { user: true } } } } },
    });

    let sevenDay = 0;
    for (const rev of urgent) {
      const eightDaysBeforeDue = new Date(rev.dueDate.getTime() - 8 * 24 * 60 * 60 * 1000);
      // už mu niekto pripomienku poslal (30-day), ale ešte nie urgent (7-day)
      if (rev.reminderSentAt && rev.reminderSentAt < eightDaysBeforeDue) {
        await this.notify(rev, 'seven');
        await this.prisma.revision.update({
          where: { id: rev.id },
          data: { reminderSentAt: now },
        });
        sevenDay++;
      }
    }

    // 3. PREŠVIHNUTÉ — prešlo dueDate, stále nedokončené (najurgentnejšie)
    const overdueList = await this.prisma.revision.findMany({
      where: {
        completedAt: null,
        dueDate: { lt: now },
      },
      include: { building: { include: { memberships: { where: { role: { in: ['CHAIRMAN', 'MANAGER'] } }, include: { user: true } } } } },
    });

    let overdue = 0;
    for (const rev of overdueList) {
      // Posielame len ak posledná pripomienka bola pred 7+ dňami (aby sme nespamovali denne)
      const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (!rev.reminderSentAt || rev.reminderSentAt < cutoff) {
        await this.notify(rev, 'overdue');
        await this.prisma.revision.update({
          where: { id: rev.id },
          data: { reminderSentAt: now },
        });
        overdue++;
      }
    }

    return { thirtyDay, sevenDay, overdue };
  }

  private async notify(rev: any, kind: 'thirty' | 'seven' | 'overdue') {
    const label = REVISION_LABEL[rev.type] ?? rev.type;
    const due = new Date(rev.dueDate).toLocaleDateString('sk-SK');
    const subjectMap = {
      thirty: `Revízia za 30 dní: ${label}`,
      seven: `URGENTNÉ — revízia za 7 dní: ${label}`,
      overdue: `PREŠVIHNUTÁ revízia: ${label}`,
    };
    const bodyMap = {
      thirty: `Pripomíname, že revízia "${rev.title}" (${label}) má termín ${due}. Stihnite naplánovať technika včas — pokuta za neuskutočnenú revíziu môže byť až 1 600 €.`,
      seven: `Posledná pripomienka: revízia "${rev.title}" (${label}) má termín ${due} — to je už za 7 dní. Skontaktujte technika dnes!`,
      overdue: `Revízia "${rev.title}" (${label}) bola naplánovaná na ${due} a stále nie je vykonaná. Riskujete pokutu, prosím riešte to bezodkladne.`,
    };

    const recipients = (rev.building?.memberships ?? [])
      .map((m: any) => m.user)
      .filter((u: any) => u?.email);

    for (const user of recipients) {
      // Email — MailService loguje keď SMTP nie je nastavené
      try {
        await this.mail.send({
          to: user.email,
          subject: subjectMap[kind],
          text: bodyMap[kind] +
            `\n\nDetail: ${process.env.WEB_URL ?? 'http://localhost:5174'}/b/${rev.buildingId}/revizie\n\n— DomovPlus`,
        });
      } catch (e) {
        this.log.warn(`Email pre revíziu ${rev.id} zlyhal: ${(e as Error).message}`);
      }

      // Push — ak má registrované zariadenie
      try {
        await this.push.sendToUser(user.id, {
          title: subjectMap[kind],
          body: `${rev.title} · termín ${due}`,
          url: `/b/${rev.buildingId}/revizie`,
        });
      } catch (e) {
        this.log.warn(`Push pre revíziu ${rev.id} zlyhal: ${(e as Error).message}`);
      }
    }
  }
}
