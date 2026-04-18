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
      if (!user.totpSecret || !this.totp.verify(user.totpSecret, totpToken)) {
        throw new UnauthorizedException('Neplatný TOTP kód.');
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
