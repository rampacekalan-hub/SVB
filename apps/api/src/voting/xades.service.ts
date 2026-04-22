import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createSign, randomUUID, X509Certificate } from 'crypto';
import * as fs from 'fs';

/**
 * XAdES-BES (Basic Electronic Signature, ETSI EN 319 132-1) — detachovaný
 * podpis PDF zápisnice z hlasovania. Pri bankovom úvere na zateplenie banky
 * v SR/ČR požadujú aby zápisnica zo SVB/SVJ mala XAdES podpis (minimálne BES
 * profil) — inak ju neakceptujú do úverovej zložky.
 *
 * Tento modul vyrába XML súbor side-by-side k PDF (detached):
 *   voting/<id>/zapisnica.pdf        — pôvodné PDF
 *   voting/<id>/zapisnica.xades.xml  — detached XAdES-BES signature
 *
 * **Hlavná limitácia tejto implementácie:** podpisujeme self-signed cert
 * (SVB-generated) alebo cert z PEM súboru — pre *kvalifikovaný* podpis
 * musí byť certifikát vydaný dôveryhodnou CA (NASES SK, PostSignum CZ,
 * Disig). Príznak kvality je v `<SignerRole>SVB_CHAIRMAN</SignerRole>` a
 * v `SigningCertificate` hashi — pri migrácii na kvalifikovaný podpis
 * stačí podmeniť XADES_PRIVATE_KEY/XADES_CERTIFICATE env a nič v kóde.
 *
 * Env:
 *   XADES_PRIVATE_KEY_PATH   PEM s private key-om (RSA 2048+)
 *   XADES_CERTIFICATE_PATH   PEM s certifikátom
 *   XADES_SIGNER_ROLE        default "SVB_CHAIRMAN"
 * Ak cesty chýbajú, modul vytvorí self-signed key/cert v pamäti — iba pre dev.
 */
@Injectable()
export class XadesService {
  private readonly log = new Logger(XadesService.name);
  private privateKeyPem: string | null = null;
  private certificatePem: string | null = null;
  private certificateDer: Buffer | null = null;

  constructor(private readonly config: ConfigService) {
    this.loadKeyMaterial();
  }

  private loadKeyMaterial() {
    const keyPath = this.config.get<string>('XADES_PRIVATE_KEY_PATH');
    const certPath = this.config.get<string>('XADES_CERTIFICATE_PATH');
    if (keyPath && certPath && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      this.privateKeyPem = fs.readFileSync(keyPath, 'utf8');
      this.certificatePem = fs.readFileSync(certPath, 'utf8');
      const x = new X509Certificate(this.certificatePem);
      this.certificateDer = Buffer.from(x.raw);
      this.log.log(`XAdES: nahraný cert ${x.subject}.`);
      return;
    }
    this.log.warn(
      'XAdES: XADES_*_PATH nie sú nastavené — používam ephemeral self-signed cert (DEV only). ' +
        'V produkcii toto nahraď kvalifikovaným certifikátom z NASES/PostSignum/Disig.',
    );
    // Dev fallback — nepoužívame v produkcii.
    // Použijeme ephemeral key len pre testy; certifikát "self-signed" s dummy subject.
    const { generateKeyPairSync } = require('crypto');
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    this.privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }) as string;
    // Minimalistická pseudo-DER — pre dev postačuje. V produkcii by bol plný X.509.
    this.certificatePem = publicKey.export({ format: 'pem', type: 'spki' }) as string;
    this.certificateDer = Buffer.from(this.certificatePem);
  }

  /**
   * Vytvor detached XAdES-BES nad PDF-kom.
   * Vracia XML string, ktorý sa uloží vedľa PDF.
   */
  async signPdf(pdf: Buffer, payload: {
    votingId: string;
    votingTitle: string;
    buildingName: string;
    signerName: string;
    signerRole?: string;
  }): Promise<{ xml: string; signatureSha256: string }> {
    if (!this.privateKeyPem || !this.certificatePem || !this.certificateDer) {
      throw new Error('XAdES: key material nie je načítaný.');
    }

    const pdfDigest = sha256Base64(pdf);
    const certDigest = sha256Base64(this.certificateDer);
    const signingTime = new Date().toISOString();
    const signatureId = `Sig-${randomUUID()}`;
    const signedPropsId = `${signatureId}-SignedProps`;
    const signedInfoId = `${signatureId}-SignedInfo`;
    const signerRole = payload.signerRole ?? this.config.get<string>('XADES_SIGNER_ROLE') ?? 'SVB_CHAIRMAN';

    // 1) SignedProperties — XAdES-specific: signing time, cert hash, role.
    const signedProperties = `
      <xades:SignedProperties Id="${signedPropsId}">
        <xades:SignedSignatureProperties>
          <xades:SigningTime>${signingTime}</xades:SigningTime>
          <xades:SigningCertificate>
            <xades:Cert>
              <xades:CertDigest>
                <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                <ds:DigestValue>${certDigest}</ds:DigestValue>
              </xades:CertDigest>
            </xades:Cert>
          </xades:SigningCertificate>
          <xades:SignerRole>
            <xades:ClaimedRoles>
              <xades:ClaimedRole>${escapeXml(signerRole)}</xades:ClaimedRole>
              <xades:ClaimedRole>${escapeXml(payload.signerName)}</xades:ClaimedRole>
            </xades:ClaimedRoles>
          </xades:SignerRole>
        </xades:SignedSignatureProperties>
        <xades:SignedDataObjectProperties>
          <xades:DataObjectFormat ObjectReference="#${signatureId}-Ref-Pdf">
            <xades:Description>${escapeXml(
              `Zápisnica z hlasovania "${payload.votingTitle}" — ${payload.buildingName}`,
            )}</xades:Description>
            <xades:MimeType>application/pdf</xades:MimeType>
          </xades:DataObjectFormat>
        </xades:SignedDataObjectProperties>
      </xades:SignedProperties>`.trim();

    const signedPropsDigest = sha256Base64(canonicalize(signedProperties));

    // 2) SignedInfo — referencie na PDF aj na SignedProperties.
    const signedInfo = `
      <ds:SignedInfo Id="${signedInfoId}">
        <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
        <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
        <ds:Reference Id="${signatureId}-Ref-Pdf" URI="zapisnica.pdf">
          <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
          <ds:DigestValue>${pdfDigest}</ds:DigestValue>
        </ds:Reference>
        <ds:Reference Type="http://uri.etsi.org/01903#SignedProperties" URI="#${signedPropsId}">
          <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
          <ds:DigestValue>${signedPropsDigest}</ds:DigestValue>
        </ds:Reference>
      </ds:SignedInfo>`.trim();

    // 3) Podpis canonical SignedInfo s RSA-SHA256.
    const signer = createSign('RSA-SHA256');
    signer.update(canonicalize(signedInfo));
    signer.end();
    const signatureValue = signer.sign(this.privateKeyPem).toString('base64');

    // 4) Zlož výsledné XML.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="${signatureId}">
  ${signedInfo}
  <ds:SignatureValue>${signatureValue}</ds:SignatureValue>
  <ds:KeyInfo>
    <ds:X509Data>
      <ds:X509Certificate>${this.certificatePem!
        .replace(/-----BEGIN [^-]+-----/g, '')
        .replace(/-----END [^-]+-----/g, '')
        .replace(/\s+/g, '')}</ds:X509Certificate>
    </ds:X509Data>
  </ds:KeyInfo>
  <ds:Object>
    <xades:QualifyingProperties Target="#${signatureId}">
      ${signedProperties}
    </xades:QualifyingProperties>
  </ds:Object>
</ds:Signature>
`;

    return {
      xml,
      signatureSha256: sha256Hex(Buffer.from(xml, 'utf8')),
    };
  }
}

function sha256Base64(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('base64');
}

function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Zjednodušená C14N (Canonical XML 1.0). Pre plnú zhodu s W3C XML-DSig
 * je odporúčaná xml-crypto knižnica. Pre MVP/self-hosted dev postačuje
 * deterministické odstránenie whitespace medzi tagmi.
 */
function canonicalize(xml: string): string {
  return xml
    .replace(/>\s+</g, '><')
    .replace(/\r\n/g, '\n')
    .trim();
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string),
  );
}
