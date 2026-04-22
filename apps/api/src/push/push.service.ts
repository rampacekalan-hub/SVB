import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Web Push (VAPID) notifikácie. Self-hosted — žiadny FCM / APNs:
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT         "mailto:admin@domovplus.sk"
 *
 * Generovanie kľúčov raz: `npx web-push generate-vapid-keys`.
 * Ak chýbajú, push sa len loguje (dev mode).
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly log = new Logger(PushService.name);
  private configured = false;
  private publicKey = '';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const pub = this.config.get<string>('VAPID_PUBLIC_KEY');
    const priv = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subj = this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:admin@domovplus.sk';
    if (!pub || !priv) {
      this.log.warn('VAPID_* nie sú nastavené — push sa bude iba logovať (dev).');
      return;
    }
    webpush.setVapidDetails(subj, pub, priv);
    this.publicKey = pub;
    this.configured = true;
    this.log.log('VAPID nakonfigurovaný.');
  }

  getPublicKey() {
    return this.publicKey;
  }

  async subscribe(
    userId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string,
  ) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: {
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent,
      },
      update: {
        userId,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent,
        lastSeenAt: new Date(),
      },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { ok: true };
  }

  /** Pošle push všetkým subscriptionom používateľa. Zlyhania tíško loguje. */
  async sendToUser(userId: string, payload: PushPayload) {
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return { delivered: 0 };
    if (!this.configured) {
      this.log.log(`[PUSH→${userId}] ${payload.title}: ${payload.body}`);
      return { delivered: 0, dev: true };
    }
    let delivered = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        delivered++;
      } catch (err: any) {
        // 410 Gone / 404 → subscription už neexistuje, vymaž.
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => void 0);
        } else {
          this.log.warn(`Push send zlyhal pre ${s.id}: ${err.message ?? err}`);
        }
      }
    }
    return { delivered };
  }

  async sendToBuildingOwners(buildingId: string, payload: PushPayload) {
    const memberships = await this.prisma.membership.findMany({
      where: { buildingId, userId: { not: null } },
      select: { userId: true },
      distinct: ['userId'],
    });
    let total = 0;
    for (const m of memberships) {
      if (!m.userId) continue;
      const r = await this.sendToUser(m.userId, payload);
      total += r.delivered;
    }
    return { delivered: total };
  }
}
