import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TotpService } from './totp.service';
import { MailService } from '../mail/mail.service';

export interface JwtPayload {
  sub: string;
  email: string;
  mfa: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly totp: TotpService,
    private readonly mail: MailService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    activationCode: string;
  }) {
    const membership = await this.prisma.membership.findUnique({
      where: { activationCode: input.activationCode },
    });
    if (!membership) {
      throw new BadRequestException('Neplatný aktivačný kód.');
    }
    if (membership.verifiedAt) {
      throw new ConflictException('Tento kód už bol použitý.');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('Používateľ s týmto emailom už existuje.');
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });
      await tx.membership.update({
        where: { id: membership.id },
        data: { userId: created.id, verifiedAt: new Date(), activationCode: null },
      });
      return created;
    });

    await this.audit.record({
      actorId: user.id,
      action: 'USER_REGISTERED',
      resourceType: 'User',
      resourceId: user.id,
    });

    return this.issueTokens(user.id, user.email, false);
  }

  /**
   * Registrácia správcu budovy bez aktivačného kódu.
   * Neudelí automaticky žiadnu rolu — tá sa priradí pri vytvorení budovy.
   * Po úspechu admin prejde do onboarding wizardu a vytvorí si budovu.
   */
  async registerAdmin(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('Používateľ s týmto emailom už existuje.');
    }
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        emailVerified: false,
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'ADMIN_REGISTERED',
      resourceType: 'User',
      resourceId: user.id,
    });
    return this.issueTokens(user.id, user.email, false);
  }

  /**
   * Uplatnenie aktivačného kódu prihláseným používateľom — pripojí
   * membership k jeho existujúcemu účtu. Rieši UX prípad: "Ja som už
   * registrovaný vlastník jedného bytu a teraz dostávam kód pre ďalší".
   */
  async linkActivationCodeToUser(userId: string, code: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { activationCode: code },
    });
    if (!membership) throw new BadRequestException('Tento aktivačný kód neexistuje.');
    if (membership.verifiedAt) throw new ConflictException('Tento kód už bol použitý.');
    // Ak už existuje membership rovnakej role v rovnakej budove/byte, nevytváraj duplikát
    const already = await this.prisma.membership.findFirst({
      where: {
        userId,
        buildingId: membership.buildingId,
        apartmentId: membership.apartmentId,
        role: membership.role,
      },
    });
    if (already) {
      throw new ConflictException('K tomuto bytu / budove ste už pripojený.');
    }
    const updated = await this.prisma.membership.update({
      where: { id: membership.id },
      data: { userId, verifiedAt: new Date(), activationCode: null },
    });
    await this.audit.record({
      actorId: userId,
      action: 'MEMBERSHIP_LINKED_BY_CODE',
      resourceType: 'Membership',
      resourceId: updated.id,
      payload: { buildingId: updated.buildingId, role: updated.role },
    });
    return { buildingId: updated.buildingId, role: updated.role, apartmentId: updated.apartmentId };
  }

  /** Non-consuming preview — iba info, kód sa neminie. */
  async previewActivationCode(code: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { activationCode: code },
      include: {
        building: { select: { id: true, name: true, city: true } },
        apartment: { select: { id: true, unitNumber: true } },
      },
    });
    if (!membership) {
      throw new BadRequestException('Tento aktivačný kód neexistuje alebo už bol použitý.');
    }
    if (membership.verifiedAt) {
      throw new ConflictException('Tento aktivačný kód už bol použitý.');
    }
    return {
      role: membership.role,
      building: membership.building,
      apartment: membership.apartment,
    };
  }

  /**
   * Demo login — vydá JWT tokeny pre seedový demo účet.
   * Žiadne heslo z frontendu — používame fixný env DEMO_EMAIL.
   * Vyžaduje aby seed bol spustený a používateľ existoval.
   */
  async demoLogin() {
    const email = process.env.DEMO_EMAIL || 'predseda@domovplus.local';
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      throw new UnauthorizedException(
        'Demo účet zatiaľ nie je dostupný — pripravujeme ho. Skúste „Začať zdarma" alebo nás kontaktujte.',
      );
    }
    await this.audit.record({
      actorId: user.id,
      action: 'USER_LOGIN',
      resourceType: 'User',
      resourceId: user.id,
      payload: { demo: true },
    });
    return this.issueTokens(user.id, user.email, false);
  }

  async login(email: string, password: string, totpToken?: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      throw new UnauthorizedException('Neplatné prihlasovacie údaje.');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      throw new UnauthorizedException('Neplatné prihlasovacie údaje.');
    }

    let mfa = false;
    if (user.totpEnabled) {
      if (!totpToken) {
        return { mfaRequired: true };
      }
      const cleaned = totpToken.replace(/\s+/g, '');
      const isTotpFormat = /^\d{6}$/.test(cleaned);
      if (isTotpFormat) {
        if (!user.totpSecret || !this.totp.verify(user.totpSecret, cleaned)) {
          throw new UnauthorizedException('Neplatný TOTP kód.');
        }
      } else {
        // skús recovery kód formát xxxxx-xxxxx
        const ok = await this.consumeRecoveryCode(user.id, cleaned);
        if (!ok) throw new UnauthorizedException('Neplatný kód.');
      }
      mfa = true;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.record({
      actorId: user.id,
      action: 'USER_LOGIN',
      resourceType: 'User',
      resourceId: user.id,
      payload: { mfa },
    });

    return this.issueTokens(user.id, user.email, mfa);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Neplatný refresh token.');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(record.userId, record.user.email, false);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async requestPasswordReset(email: string) {
    // Nikdy neprezraď, či email existuje — odpoveď je vždy rovnaká.
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.active) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = this.hashToken(rawToken);
      const ttlMs = 30 * 60 * 1000; // 30 minút
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + ttlMs),
        },
      });
      const appUrl = process.env.APP_URL ?? 'http://localhost:5173';
      const resetUrl = `${appUrl}/obnova-hesla?token=${rawToken}`;
      const mailResult = await this.mail.sendPasswordReset(user.email, user.firstName, resetUrl);
      // V dev režime + bez SMTP: token sa aj tak loguje cez MailService.
      // Ak SMTP beží a odoslanie zlyhá, mail service vyhodí exception — loggerne.
      if (!mailResult.delivered && process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log(`[PASSWORD RESET] ${email} → resetUrl=${resetUrl}`);
      }
      await this.audit.record({
        actorId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        resourceType: 'User',
        resourceId: user.id,
      });
    }
    return { ok: true, message: 'Ak email existuje, poslali sme inštrukcie na obnovenie hesla.' };
  }

  async confirmPasswordReset(rawToken: string, newPassword: string) {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Neplatný alebo expirovaný token.');
    }
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Zruš všetky aktívne refresh tokeny — vynúti odhlásenie zo všetkých zariadení.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.record({
      actorId: record.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      resourceType: 'User',
      resourceId: record.userId,
    });
    return { ok: true };
  }

  async enableTotp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const secret = this.totp.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret, totpEnabled: false },
    });
    return {
      secret,
      otpauthUrl: this.totp.buildUri(user.email, secret),
      qrDataUrl: await this.totp.buildQrDataUrl(user.email, secret),
    };
  }

  /**
   * Vygeneruje 10 jednorazových záložných kódov. Staré sa zmažú.
   * Plain kódy sa vrátia iba tu — v DB sú SHA-256 hashe.
   */
  async generateRecoveryCodes(userId: string) {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const raw = randomBytes(5).toString('hex'); // 10 hex znakov
      codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
    }
    await this.prisma.$transaction([
      this.prisma.totpRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.totpRecoveryCode.createMany({
        data: codes.map((c) => ({
          userId,
          codeHash: this.hashToken(c),
        })),
      }),
    ]);
    await this.audit.record({
      actorId: userId,
      action: 'TOTP_RECOVERY_CODES_GENERATED',
      resourceType: 'User',
      resourceId: userId,
    });
    return { codes };
  }

  /** Použitie recovery kódu namiesto TOTP — každý kód sa dá použiť raz. */
  async consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    const codeHash = this.hashToken(code.replace(/\s+/g, ''));
    const rec = await this.prisma.totpRecoveryCode.findUnique({ where: { codeHash } });
    if (!rec || rec.userId !== userId || rec.usedAt) return false;
    await this.prisma.totpRecoveryCode.update({
      where: { id: rec.id },
      data: { usedAt: new Date() },
    });
    await this.audit.record({
      actorId: userId,
      action: 'TOTP_RECOVERY_CODE_USED',
      resourceType: 'User',
      resourceId: userId,
    });
    return true;
  }

  /** Aktívne session (refresh tokens, ktoré neboli revokované). */
  async listSessions(userId: string) {
    const sessions = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const result = await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw new BadRequestException('Session nenájdená.');
    await this.audit.record({
      actorId: userId,
      action: 'SESSION_REVOKED',
      resourceType: 'RefreshToken',
      resourceId: sessionId,
    });
    return { ok: true };
  }

  /**
   * GDPR článok 20 — právo na prenositeľnosť údajov.
   * Vráti všetky osobné údaje používateľa v JSON.
   */
  async gdprExport(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: { include: { building: true, apartment: true } },
        notifications: { include: { announcement: { select: { title: true, body: true, publishedAt: true } } } },
        createdTickets: true,
        assignedTickets: true,
        classifieds: true,
      },
    });
    if (!user) throw new UnauthorizedException();
    // Odfiltrujeme citlivé veci (passwordHash, totpSecret) — tie sú interné, nie sú "jeho dáta".
    const { passwordHash: _p, totpSecret: _t, ...userPublic } = user as any;
    await this.audit.record({
      actorId: userId,
      action: 'GDPR_EXPORT',
      resourceType: 'User',
      resourceId: userId,
    });
    return {
      exportedAt: new Date().toISOString(),
      user: userPublic,
    };
  }

  /** GDPR článok 17 — právo na výmaz. Tvrdý delete účtu (cascades). */
  async gdprDelete(userId: string) {
    await this.audit.record({
      actorId: userId,
      action: 'GDPR_DELETE',
      resourceType: 'User',
      resourceId: userId,
    });
    await this.prisma.user.delete({ where: { id: userId } });
    return { ok: true };
  }

  async confirmTotp(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) {
      throw new BadRequestException('TOTP nie je inicializované.');
    }
    if (!this.totp.verify(user.totpSecret, token)) {
      throw new BadRequestException('Neplatný TOTP kód.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });
    await this.audit.record({
      actorId: userId,
      action: 'USER_TOTP_ENABLED',
      resourceType: 'User',
      resourceId: userId,
    });
    return { enabled: true };
  }

  private async issueTokens(userId: string, email: string, mfa: boolean) {
    const payload: JwtPayload = { sub: userId, email, mfa };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(refreshToken);
    const refreshExpiresIn = parseDuration(process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + refreshExpiresIn),
      },
    });
    return { accessToken, refreshToken, mfa };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

function parseDuration(value: string): number {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 3600 * 1000;
  const n = Number(match[1]);
  switch (match[2]) {
    case 's': return n * 1000;
    case 'm': return n * 60_000;
    case 'h': return n * 3_600_000;
    case 'd': return n * 86_400_000;
    default: return 7 * 86_400_000;
  }
}
