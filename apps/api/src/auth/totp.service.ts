import { Injectable } from '@nestjs/common';
import { TOTP, Secret } from 'otpauth';
import * as QRCode from 'qrcode';

@Injectable()
export class TotpService {
  private readonly issuer = process.env.TOTP_ISSUER ?? 'DomovPlus';

  generateSecret(): string {
    return new Secret({ size: 20 }).base32;
  }

  buildUri(email: string, secret: string): string {
    return new TOTP({
      issuer: this.issuer,
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    }).toString();
  }

  async buildQrDataUrl(email: string, secret: string): Promise<string> {
    return QRCode.toDataURL(this.buildUri(email, secret));
  }

  verify(secret: string, token: string): boolean {
    if (!/^\d{6}$/.test(token)) return false;
    const totp = new TOTP({
      issuer: this.issuer,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });
    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  }
}
