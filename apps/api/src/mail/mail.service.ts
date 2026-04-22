import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailInput {
  to: string;
  subject: string;
  /** Prostý text (fallback pre klientov bez HTML) */
  text: string;
  /** HTML verzia; ak chýba, pošle sa len text. */
  html?: string;
}

/**
 * SMTP klient s self-hosted friendly konfiguráciou.
 *
 * V produkcii odporúčame **Postal** (self-hosted MTA, docker-compose.yml),
 * **Haraka** alebo čistý **Postfix + Dovecot**. Služba konfiguruje klienta
 * cez env premenné:
 *   SMTP_HOST           (napr. mail.domovplus.sk)
 *   SMTP_PORT           (default 587 STARTTLS / 465 SMTPS)
 *   SMTP_SECURE         "true" pre 465, inak STARTTLS
 *   SMTP_USER
 *   SMTP_PASS
 *   MAIL_FROM           "DomovPlus <no-reply@domovplus.sk>"
 *
 * Ak SMTP_HOST chýba (dev), emaily sa iba logujú do konzoly — žiadny skutočný
 * transport. Každý volajúci (napr. auth.service) tak môže volať sendMail()
 * bez rozlišovania prostredia.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly log = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress = 'DomovPlus <no-reply@domovplus.sk>';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.log.warn('SMTP_HOST nie je nastavený — emaily sa budú iba logovať (dev mode).');
      return;
    }
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const secure = (this.config.get<string>('SMTP_SECURE') ?? 'false') === 'true';
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    this.fromAddress = this.config.get<string>('MAIL_FROM') ?? this.fromAddress;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      // Self-signed certifikát prípustný iba pre development.
      tls: { rejectUnauthorized: this.config.get<string>('NODE_ENV') === 'production' },
    });
    this.transporter
      .verify()
      .then(() => this.log.log(`SMTP pripojenie overené (${host}:${port}).`))
      .catch((err) => this.log.error(`SMTP verify zlyhal: ${err.message}`));
  }

  async send(input: SendMailInput): Promise<{ delivered: boolean; messageId?: string }> {
    if (!this.transporter) {
      this.log.log(`[MAIL→${input.to}] ${input.subject}\n${input.text}`);
      return { delivered: false };
    }
    const info = await this.transporter.sendMail({
      from: this.fromAddress,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { delivered: true, messageId: info.messageId };
  }

  /** Preddefinované emaily — drží sa tu, aby šablóny nežili v servisných triedach. */
  async sendPasswordReset(email: string, firstName: string, resetUrl: string) {
    return this.send({
      to: email,
      subject: 'DomovPlus — obnovenie hesla',
      text:
        `Dobrý deň ${firstName},\n\n` +
        `dostali sme žiadosť o obnovenie hesla k vášmu účtu DomovPlus.\n` +
        `Nové heslo si nastavíte na adrese:\n${resetUrl}\n\n` +
        `Odkaz platí 30 minút a dá sa použiť iba raz. Ak ste o zmenu nežiadali, tento email ignorujte.\n\n` +
        `S pozdravom,\nDomovPlus`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#0f766e">Obnovenie hesla</h2>
          <p>Dobrý deň ${escapeHtml(firstName)},</p>
          <p>dostali sme žiadosť o obnovenie hesla k vášmu účtu DomovPlus.</p>
          <p style="margin:24px 0">
            <a href="${resetUrl}" style="background:#0f766e;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
              Nastaviť nové heslo
            </a>
          </p>
          <p style="color:#78716c;font-size:14px">
            Odkaz platí 30 minút a dá sa použiť iba raz. Ak ste o zmenu nežiadali, tento email ignorujte.
          </p>
          <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0" />
          <p style="color:#a8a29e;font-size:12px">DomovPlus — správa bytového domu</p>
        </div>
      `,
    });
  }

  async sendActivationInvite(email: string, unitNumber: string, buildingName: string, code: string, registerUrl: string) {
    return this.send({
      to: email,
      subject: `DomovPlus — pozvánka pre byt ${unitNumber}`,
      text:
        `Vitajte v DomovPlus,\n\n` +
        `pre váš byt č. ${unitNumber} v budove ${buildingName} bol vygenerovaný aktivačný kód:\n` +
        `    ${code}\n\n` +
        `Registrácia: ${registerUrl}\n\n` +
        `Kód platí jednorazovo a dá sa použiť len pre tento byt.`,
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}
