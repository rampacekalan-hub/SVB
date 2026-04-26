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

  /**
   * PDF text extraction — vysoká presnosť, žiadny OCR.
   * Pri zlyhaní vraciame prázdny extrakt — Tesseract NEdá sa použiť na PDF
   * (podporuje len bitmapy a crashne celý Node process).
   */
  async extractFromPdf(buffer: Buffer): Promise<OcrExtraction> {
    try {
      // @ts-expect-error - pdf-parse v1 nemá TS types
      const mod: any = await import('pdf-parse');
      const pdfParse = mod.default ?? mod;
      if (typeof pdfParse !== 'function') {
        this.log.warn('pdf-parse nemá callable default export — preskakujem.');
        return { rawText: '', confidence: 0 };
      }
      const data: any = await pdfParse(buffer);
      const text = data?.text ?? '';
      this.log.log(`PDF extrahovaný (${text.length} znakov)`);
      if (!text || text.trim().length < 10) {
        // PDF je obrázkový sken — bez OCR engine na PDF nevieme čítať
        return {
          rawText: '',
          confidence: 0,
          // signál pre UI: PDF je sken, treba ručne zadať
        };
      }
      return this.parse(text, 0.95);
    } catch (err) {
      this.log.warn(`PDF parse zlyhal: ${(err as Error).message}`);
      return { rawText: '', confidence: 0 };
    }
  }

  /**
   * Spustí OCR na image bufferi a parse-ne typické polia.
   * Tesseract import je dynamický — knižnica je veľká (35 MB), nezaťažuje boot.
   */
  async extractFromImage(buffer: Buffer): Promise<OcrExtraction> {
    // Sanity check: PDF magic bytes — Tesseract padá na PDF a kraší Node!
    if (buffer.length > 4 && buffer.slice(0, 4).toString() === '%PDF') {
      this.log.warn('Tesseract OCR sa nedá použiť na PDF — vraciam prázdny extrakt.');
      return { rawText: '', confidence: 0 };
    }

    let rawText = '';
    let confidence = 0;
    let worker: any = null;

    // Globálny handler pre uncaughtException z Tesseract worker-a — zabraňuje crash Node-u
    const uncaughtHandler = (err: Error) => {
      this.log.error(`Tesseract worker uncaught: ${err.message}`);
    };
    process.once('uncaughtException', uncaughtHandler);

    try {
      const { createWorker } = await import('tesseract.js');
      worker = await createWorker(['slk', 'ces'], 1, { logger: () => undefined });
      const result = await worker.recognize(buffer);
      rawText = result.data.text;
      confidence = (result.data.confidence ?? 0) / 100;
    } catch (err) {
      this.log.warn(`OCR zlyhal (vraciam prázdny extrakt): ${(err as Error).message}`);
      return { rawText: '', confidence: 0 };
    } finally {
      process.removeListener('uncaughtException', uncaughtHandler);
      if (worker) try { await worker.terminate(); } catch { /* ignore */ }
    }

    return this.parse(rawText, confidence);
  }

  /**
   * Public — predseda môže ručne poslať text (napr. vlepený z PDF kopírovania)
   * a získať extrakciu polí.
   */
  parse(rawText: string, confidence = 1): OcrExtraction {
    const text = rawText.replace(/\s+/g, ' ');

    // IBAN — SK / CZ s alebo bez medzier
    const ibanMatch = text.match(/\b(SK\d{2}[\s]*[\d\s]{18,24}|CZ\d{2}[\s]*[\d\s]{18,24})\b/i);
    let iban: string | undefined;
    if (ibanMatch) {
      const cleaned = ibanMatch[1].replace(/\s+/g, '').toUpperCase();
      if (cleaned.length === 24) iban = cleaned; // SK/CZ IBAN je presne 24 znakov
    }

    // IČO — 8 číslic
    const icoMatch = text.match(/I[ČC]O[\s:]*(\d{8})\b/i);
    const ico = icoMatch ? icoMatch[1] : undefined;

    // DIČ — 10 číslic, ale nie ICDPH (SK + 10)
    const dicMatch = text.match(/D[ICČ][\s:]*(\d{10})\b/i);
    const dic = dicMatch ? dicMatch[1] : undefined;

    // VS — variabilný symbol
    const vsMatch = text.match(/(?:VS|Variabiln[ýy]\s+symbol|Var\.\s*sym\.|V\.\s*S\.?)[\s:]*(\d+)/i);
    const variableSymbol = vsMatch ? vsMatch[1] : undefined;

    // Dátum splatnosti — viac variantov
    const dueDate = this.matchDate(
      text.match(/(?:Splatnos[tť]\s+(?:do|faktur[yz])?|Termín\s+splatnosti|D[áa]tum\s+splatnosti|Splatn[áé]\s+do|Due\s*date)[\s:]*(\d{1,2}[.\s/-]\d{1,2}[.\s/-]\d{2,4})/i)?.[1]
        ?? text.match(/Splatnos[tť][\s:.]+(\d{1,2}[.\s/-]\d{1,2}[.\s/-]\d{2,4})/i)?.[1],
    );

    // Dátum vystavenia
    const issueDate = this.matchDate(
      text.match(/(?:D[áa]tum\s+vystavenia|Vystaven[áé]\s+(?:dňa|d\.)?|D[áa]tum\s+vyhotovenia|Issue\s*date)[\s:]*(\d{1,2}[.\s/-]\d{1,2}[.\s/-]\d{2,4})/i)?.[1],
    );

    // Suma — preferuj sumy pri "Spolu k úhrade" / "Celkom" / "Total"
    let amount: string | undefined;
    const totalContextMatch = text.match(/(?:Spolu\s+k\s+úhrade|Celkom\s+k\s+úhrade|K\s+úhrade|Sum[au]\s+celkom|Spolu\s+s?\s*DPH|Celkov[áa]\s+sum[ay]|Total\s+amount)[\s:]*(\d{1,3}(?:[\s.]\d{3})*[,.]\d{2})/i);
    if (totalContextMatch) {
      amount = parseFloat(totalContextMatch[1].replace(/[\s.]/g, '').replace(',', '.')).toFixed(2);
    } else {
      // Fallback — najväčšie číslo s desatinnou čiarkou + €/EUR
      const amounts = Array.from(text.matchAll(/(\d{1,3}(?:[\s.]\d{3})*[,.]\d{2})\s*(?:€|EUR|Kč|CZK)/gi))
        .map((m) => parseFloat(m[1].replace(/[\s.]/g, '').replace(',', '.')))
        .filter((n) => !isNaN(n) && n > 0);
      if (amounts.length) amount = Math.max(...amounts).toFixed(2);
    }

    // Číslo faktúry — viac variantov + filter na rozumné formáty (nie celé vety)
    let invoiceNumber: string | undefined;
    const invPatterns = [
      /(?:Fakt[uú]ra\s*č(?:íslo|\.|:))[\s:]*([A-Z0-9][A-Z0-9./_-]{1,30})/i,
      /(?:FA\s*č\.|FA-|Č[íi]slo\s*fakt[uú]ry|Č\.\s*fakt[uú]ry|Invoice\s*No\.?)[\s:]*([A-Z0-9][A-Z0-9./_-]{1,30})/i,
      /(?:Fakt[uú]ra\s*[-–]\s*da[ňn]ov[ýy]\s+doklad\s*č\.?)[\s:]*([A-Z0-9][A-Z0-9./_-]{1,30})/i,
      /(?:Da[ňn]ov[ýy]\s+doklad\s*č(?:\.|íslo))[\s:]*([A-Z0-9][A-Z0-9./_-]{1,30})/i,
    ];
    for (const re of invPatterns) {
      const m = text.match(re);
      if (m) {
        const candidate = m[1].replace(/[.,)]$/g, '').trim();
        // Filter: musí mať aspoň 1 číslicu, max 30 znakov, nesmie obsahovať medzery
        if (/\d/.test(candidate) && candidate.length <= 30 && !/\s/.test(candidate)) {
          invoiceNumber = candidate;
          break;
        }
      }
    }
    // Fallback — ak invoice number nenašiel ale VS áno, použij VS
    if (!invoiceNumber && variableSymbol) {
      invoiceNumber = variableSymbol;
    }

    return {
      rawText,
      confidence,
      amount,
      iban,
      ico,
      dic,
      variableSymbol,
      dueDate,
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
