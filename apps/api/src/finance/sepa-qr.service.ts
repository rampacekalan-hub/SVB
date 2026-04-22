import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

/**
 * Generátor SEPA EPC069-12 QR kódu ("Pay by QR").
 * Štandard EPC069-12 v2 — akceptovaný slovenskými aj českými bankami
 * v ich mobilných aplikáciách (Tatrabanka, SLSP, VÚB, ČSOB, Raiffeisen,
 * Fio, Moneta atď.). Formát: 10 riadkov oddelených \n.
 *
 * Pozor: IBAN musí byť platný; BIC v SEPA SK/CZ je voliteľný od 2016.
 * Reference je použitá ako SCOR (štruktúrovaný odkaz) resp. unstructured.
 */
@Injectable()
export class SepaQrService {
  build(args: {
    beneficiaryName: string; // max 70
    iban: string;
    bic?: string;
    amountEur: string; // 'EUR 124.50' bez medzier oddelené bodkou
    reference?: string; // VS → unstructured remittance
    purpose?: string; // 4-char ISO (napr. 'RENT')
  }): string {
    const amount = Number(args.amountEur).toFixed(2);
    return [
      'BCD', // service tag
      '002', // version
      '1', // charset UTF-8
      'SCT', // SEPA Credit Transfer
      args.bic ?? '',
      truncate(args.beneficiaryName, 70),
      args.iban.replace(/\s+/g, '').toUpperCase(),
      `EUR${amount}`,
      args.purpose ?? '',
      '', // SCOR ref — tu necháme prázdne
      truncate(args.reference ?? '', 140), // unstructured remittance
      '', // beneficiary to originator info
    ].join('\n');
  }

  async buildDataUrl(args: Parameters<SepaQrService['build']>[0]): Promise<string> {
    const payload = this.build(args);
    return QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 6,
    });
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}
