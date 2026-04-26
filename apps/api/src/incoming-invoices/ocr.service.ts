/**
 * OcrService — extrakcia údajov z fotky/PDF faktúry.
 *
 * Používa Tesseract.js (lokálne, zadarmo, slovenčina + čeština).
 * Pre PDF: vyrenderuje 1. stranu cez pdf-poppler / pdf-lib (TODO neskôr),
 * pre teraz akceptujeme len obrázky (JPG/PNG/WebP).
 *
 * Po extrakcii sa pokúsi regex-om vytiahnuť:
 *   - Suma (najväčšie EUR / Kč číslo s desatinnými miestami)
 *   - IBAN (SK\d{22} | CZ\d{22})
 *   - IČO (8 číslic na samostatnom mieste)
 *   - DIČ (10 číslic, prefix DIČ:/DIC:)
 *   - Variabilný symbol (VS: \d+)
 *   - Dátum splatnosti (DD.MM.YYYY)
 *
 * Vracia parciálne dáta + raw text. Predseda v UI potvrdí / opraví.
 */
import { Injectable, Logger } from '@nestjs/common';

export interface OcrExtraction {
  rawText: string;
  confidence: number; // 0–1
  amount?: string;
  iban?: string;
  ico?: string;
  dic?: string;
  variableSymbol?: string;
  dueDate?: string; // ISO
  issueDate?: string;
  invoiceNumber?: string;
}

@Injectable()
export class OcrService {
  private readonly log = new Logger(OcrService.name);

  /**
   * Univerzálna metóda — detekuje typ súboru a deleguje:
   *   PDF → pdf-parse (extrahuje text PRIAMO, žiadny OCR, vysoká presnosť)
   *   Image → Tesseract.js OCR (pomalšie, lower confidence)
   *
   * Vracia extrakt s rovnakou štruktúrou ako predtým.
   */
  async extract(buffer: Buffer, mimeType?: string): Promise<OcrExtraction> {
    const isPdf = mimeType === 'application/pdf' || (buffer.length > 4 && buffer.slice(0, 4).toString() === '%PDF');
    if (isPdf) {
      return this.extractFromPdf(buffer);
    }
    return this.extractFromImage(buffer);
  }

  /** PDF text extraction — vysoká presnosť, žiadny OCR. */
  async extractFromPdf(buffer: Buffer): Promise<OcrExtraction> {
    try {
      // pdf-parse má rôzne export tvary v rôznych verziách — bezpečne probni oboje
      const mod: any = await import('pdf-parse');
      const pdfParse = mod.default ?? mod;
      const data: any = await pdfParse(buffer);
      const text = data?.text ?? '';
      this.log.log(`PDF extrahovaný (${text.length} znakov)`);
      return this.parse(text, 0.95); // PDF text je vždy presný
    } catch (err) {
      this.log.warn(`PDF parse zlyhal, fallback na OCR: ${(err as Error).message}`);
      return this.extractFromImage(buffer);
    }
  }

  /**
   * Spustí OCR na image bufferi a parse-ne typické polia.
   * Tesseract import je dynamický — knižnica je veľká (35 MB), nezaťažuje boot.
   */
  async extractFromImage(buffer: Buffer): Promise<OcrExtraction> {
    let rawText = '';
    let confidence = 0;
    try {
      // Dynamic import — Tesseract.js je 35 MB
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(['slk', 'ces'], 1, {
        logger: () => undefined, // silence default progress logging
      });
      const result = await worker.recognize(buffer);
      rawText = result.data.text;
      confidence = (result.data.confidence ?? 0) / 100;
      await worker.terminate();
    } catch (err) {
      this.log.warn(`OCR zlyhal (vraciam prázdny extrakt): ${(err as Error).message}`);
      return { rawText: '', confidence: 0 };
    }

    return this.parse(rawText, confidence);
  }

  /**
   * Public — predseda môže ručne poslať text (napr. vlepený z PDF kopírovania)
   * a získať extrakciu polí.
   */
  parse(rawText: string, confidence = 1): OcrExtraction {
    const text = rawText.replace(/\s+/g, ' ');

    // IBAN — SK / CZ + 22 alfanumerických
    const ibanMatch = text.match(/\b(SK\d{2}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}|CZ\d{2}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4})\b/i);
    const iban = ibanMatch ? ibanMatch[1].replace(/\s+/g, '').toUpperCase() : undefined;

    // IČO — slovo "IČO" alebo "IC:" + 8 číslic; alebo samostatných 8 číslic za "Dodávateľ" oblasťou
    const icoMatch = text.match(/I[ČC]O[\s:]*(\d{8})\b/i) || text.match(/\bD[ICČ]O?[\s:]*(\d{8})\b/i);
    const ico = icoMatch ? icoMatch[1] : undefined;

    // DIČ — 10 číslic
    const dicMatch = text.match(/D[ICČ][\s:]*(\d{10})\b/i);
    const dic = dicMatch ? dicMatch[1] : undefined;

    // VS — variabilný symbol
    const vsMatch = text.match(/(?:VS|Variabiln[ýy] symbol|Var\.\s*sym\.)[\s:]*(\d+)/i);
    const variableSymbol = vsMatch ? vsMatch[1] : undefined;

    // Dátum splatnosti — DD.MM.YYYY
    const splatDate = this.matchDate(
      text.match(/Splatnos[tť][\s:]*(\d{1,2}[.\s/-]\d{1,2}[.\s/-]\d{2,4})/i)?.[1]
        ?? text.match(/Due\s*date[\s:]*(\d{1,2}[.\s/-]\d{1,2}[.\s/-]\d{2,4})/i)?.[1],
    );

    // Dátum vystavenia
    const issueDate = this.matchDate(
      text.match(/D[áa]tum\s+vystavenia[\s:]*(\d{1,2}[.\s/-]\d{1,2}[.\s/-]\d{2,4})/i)?.[1]
        ?? text.match(/Vystaven[áé][\s:]*(\d{1,2}[.\s/-]\d{1,2}[.\s/-]\d{2,4})/i)?.[1],
    );

    // Suma — najväčšie číslo s desatinnou čiarkou alebo bodkou + €/EUR/Kč
    const amounts = Array.from(text.matchAll(/(\d{1,3}(?:[ .]\d{3})*[,.]\d{2})\s*(?:€|EUR|Kč|CZK)?/gi))
      .map((m) => parseFloat(m[1].replace(/[\s.]/g, '').replace(',', '.')))
      .filter((n) => !isNaN(n) && n > 0);
    const amount = amounts.length ? Math.max(...amounts).toFixed(2) : undefined;

    // Číslo faktúry — heuristika: za "Faktúra č." / "FA č." / "Číslo faktúry"
    const invMatch = text.match(/(?:Fakt[uú]ra\s*č\.?|FA\s*č\.?|Č[íi]slo\s*fakt[uú]ry)[\s:]*([A-Z0-9./-]+)/i);
    const invoiceNumber = invMatch ? invMatch[1].replace(/[.,]$/, '') : undefined;

    return {
      rawText,
      confidence,
      amount,
      iban,
      ico,
      dic,
      variableSymbol,
      dueDate: splatDate,
      issueDate,
      invoiceNumber,
    };
  }

  private matchDate(s: string | undefined): string | undefined {
    if (!s) return undefined;
    const m = s.match(/(\d{1,2})[.\s/-](\d{1,2})[.\s/-](\d{2,4})/);
    if (!m) return undefined;
    let [, d, mo, y] = m;
    if (y.length === 2) y = (parseInt(y) > 50 ? '19' : '20') + y;
    const date = new Date(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`);
    return isNaN(date.getTime()) ? undefined : date.toISOString();
  }
}
