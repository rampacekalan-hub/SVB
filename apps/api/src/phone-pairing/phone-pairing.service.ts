/**
 * PhonePairingService — krátkodobá session na prenos foto z mobilu na PC.
 *
 * Flow:
 *   1. Predseda na PC klikne „Odfotiť mobilom" v nejakej obrazovke
 *      (napr. Pridať faktúru, Nahlásiť poruchu).
 *   2. Backend vytvorí session: token, purpose, contextId, expiresAt (15 min).
 *   3. UI zobrazí QR kód s URL `https://domovplus.sk/p/<token>`.
 *   4. Predseda namieri mobil → otvorí URL → kamera → fotí → upload.
 *   5. PC polluje (alebo SSE) endpoint a vidí keď uploady prídu.
 *
 * Pre teraz: krátky token v DB. SSE / WebSocket nie je potrebné — UI polluje 1×/2s.
 */
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PhonePairingPurpose } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

interface AuthedUser { id: string; }

const TTL_MIN = 15;

@Injectable()
export class PhonePairingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async create(user: AuthedUser, dto: {
    purpose: PhonePairingPurpose;
    buildingId: string;
    contextId?: string;
  }) {
    await this.assertBuildingAccess(user, dto.buildingId);

    const token = randomBytes(16).toString('hex'); // 32 chars
    const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000);

    const session = await this.prisma.phonePairingSession.create({
      data: {
        token,
        purpose: dto.purpose,
        buildingId: dto.buildingId,
        contextId: dto.contextId,
        createdById: user.id,
        expiresAt,
      },
    });

    const webBase = (this.config.get<string>('PUBLIC_WEB_URL') ?? 'http://localhost:5174').replace(/\/$/, '');
    return {
      ...session,
      pairUrl: `${webBase}/p/${token}`,
      ttlSeconds: TTL_MIN * 60,
    };
  }

  /** Polling endpoint — UI zisťuje stav session (consumed? ktoré keys?). */
  async getStatus(user: AuthedUser, sessionId: string) {
    const s = await this.prisma.phonePairingSession.findUnique({ where: { id: sessionId } });
    if (!s) throw new NotFoundException();
    await this.assertBuildingAccess(user, s.buildingId);
    return {
      consumedAt: s.consumedAt,
      expiresAt: s.expiresAt,
      uploadedKeys: s.uploadedKeys ? s.uploadedKeys.split(',').filter(Boolean) : [],
    };
  }

  /** Verejné — mobil otvorí token URL. Vráti meta info bez auth. */
  async resolveToken(token: string) {
    const s = await this.prisma.phonePairingSession.findUnique({ where: { token } });
    if (!s) throw new NotFoundException('Token nenájdený alebo expiroval.');
    if (s.expiresAt < new Date()) throw new NotFoundException('Token expiroval.');
    return {
      id: s.id,
      purpose: s.purpose,
      contextId: s.contextId,
      expiresAt: s.expiresAt,
    };
  }

  /**
   * Verejne dostupný upload — autentifikácia je samotný platný token.
   * Mobil neposiela JWT (vlastník bytu nemusí byť prihlásený).
   */
  async uploadFromMobile(token: string, file: { buffer: Buffer; originalname: string; mimetype: string }) {
    const s = await this.prisma.phonePairingSession.findUnique({ where: { token } });
    if (!s || s.expiresAt < new Date()) throw new NotFoundException('Token neplatný.');

    const ext = (file.originalname.split('.').pop() ?? 'jpg').toLowerCase();
    const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'bin';
    const key = `phone-pairing/${s.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    const result = await this.storage.put(key, file.buffer, file.mimetype);

    const existing = s.uploadedKeys ? s.uploadedKeys.split(',').filter(Boolean) : [];
    existing.push(result.storageKey);
    await this.prisma.phonePairingSession.update({
      where: { id: s.id },
      data: {
        uploadedKeys: existing.join(','),
        consumedAt: s.consumedAt ?? new Date(),
      },
    });

    return { ok: true, storageKey: result.storageKey, count: existing.length };
  }

  private async assertBuildingAccess(user: AuthedUser, buildingId: string) {
    const m = await this.prisma.membership.findFirst({
      where: { userId: user.id, buildingId, role: { in: ['CHAIRMAN', 'MANAGER', 'ADMIN'] } },
    });
    if (!m) throw new ForbiddenException();
  }
}
