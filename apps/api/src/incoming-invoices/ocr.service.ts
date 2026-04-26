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
  description?: string;
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
   *
   * HARDENING:
   * 1. Detekcia PDF magic bytes (4 varianty: %PDF, PDF-1.x, iText, etc.)
   * 2. 30s timeout — ak Tesseract visel, kill worker
   * 3. try-catch na worker.recognize() — any crash je graceful
   */
  async extractFromImage(buffer: Buffer): Promise<OcrExtraction> {
    // 1. ROBUST PDF detection — check magic bytes (PDF header + variants)
    const isPdfLikely = this.isPdfOrNonImage(buffer);
    if (isPdfLikely) {
      this.log.warn('Buffer vyzerá ako PDF alebo non-image — Tesseract by padol. Vraciam prázdny extrakt.');
      return { rawText: '', confidence: 0 };
    }

    let rawText = '';
    let confidence = 0;
    let worker: any = null;
    let timeoutHandle: NodeJS.Timeout | null = null;

    try {
      const { createWorker } = await import('tesseract.js');
      worker = await createWorker(['slk', 'ces'], 1, { logger: () => undefined });

      // 2. 30-second timeout guard — ak Tesseract visel, kill a vrátiť empty
      const recognizePromise = worker.recognize(buffer);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Tesseract timeout (30s)')), 30000)
      );

      const result = await Promise.race([recognizePromise, timeoutPromise]) as any;
      rawText = result.data.text;
      confidence = (result.data.confidence ?? 0) / 100;
    } catch (err) {
      const message = (err as Error).message;
      this.log.warn(`OCR zlyhal (${message}) — vraciam prázdny extrakt`);
      // Keď je timeout, force-kill worker
      if (message.includes('timeout') && worker) {
        try {
          await worker.terminate();
          worker = null;
        } catch {
          // Force kill — ignore errors
          worker = null;
        }
      }
      return { rawText: '', confidence: 0 };
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (worker) {
        try {
          await worker.terminate();
        } catch {
          /* ignore */
        }
      }
    }

    return this.parse(rawText, confidence);
  }

  /**
   * Detekuje či buffer je PDF alebo iný non-image format.
   * Kontroluje viaceré magic bytes aby som vylúčil PDF variácie.
   */
  private isPdfOrNonImage(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;

    // PDF magic bytes: %PDF (25 50 44 46), PDF-1.x variants
    const first4 = buffer.slice(0, 4);
    if (first4.equals(Buffer.from('%PDF'))) return true;
    if (first4.equals(Buffer.from('\x25PDF'))) return true; // decimal notation

    // iText PDF variant: %PDF...%EOF
    if (buffer.toString('utf8', 0, 4).includes('PDF')) return true;

    // PostScript / TIFF / DWG — iné formáty, Tesseract neunestie
    if (first4[0] === 0x25 && first4[1] === 0x21) return true; // %! (PostScript)
    if (buffer.toString('utf8', 0, 2) === 'II' || buffer.toString('utf8', 0, 2) === 'MM') {
      // TIFF magic bytes (little/big endian)
      return true;
    }
    if (buffer.toString('utf8', 0, 2) === 'AC') return true; // AutoCAD DWG

    return false;
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

    // Popis predmetu faktúry — heuristika:
    //   1. "Fakturujeme Vám za ..." / "Fakturujeme za ..." (najčastejší formát)
    //   2. "Predmet faktúry: ..." / "Predmet:"
    //   3. Riadok medzi tabuľkou položiek a súčtom (typicky obsahuje "ks")
    let description: string | undefined;
    const descPatterns = [
      // "Fakturujeme Vám za prenájom kancelárskych priestorov na adrese ... za obdobie apríl 2026."
      /Fakturujeme(?:\s+V[áa]m)?\s+za\s+([^.\n]+?)(?:\s+(?:Po(?:Z|z)n[áa]mka|Celkov[áa]\s+sum[ay]|Spolu|Suma|Cena\s+celkom|N[áa]zov\s+a\s+popis)|[\.\n])/i,
      // "Predmet faktúry: ..." / "Predmet: ..."
      /Predmet(?:\s+fakt[uú]ry)?[\s:]+([^\n]+?)(?:\s+(?:Po(?:z)n[áa]mka|Celkov[áa]|Spolu|Cena|Suma|$))/i,
      // "Fakturácia za ..." / "Faktúra za ..."
      /Fakt[uú]r(?:[au]|[áa]cia)\s+za\s+([^\n]+?)(?:\s+(?:N[áa]zov|Po(?:z)n[áa]mka|Celkov[áa]|Spolu|Cena|$))/i,
    ];
    for (const re of descPatterns) {
      const m = text.match(re);
      if (m) {
        const candidate = m[1].trim().replace(/\s+/g, ' ');
        if (candidate.length >= 5 && candidate.length <= 250) {
          description = candidate;
          break;
        }
      }
    }
    // Fallback: ak neexistuje, skús extrahovať prvú „položku" z tabuľky
    if (!description) {
      // Hľadaj riadok obsahujúci "ks" alebo "kus" + číslo (typický formát položky)
      const itemMatch = text.match(/(?:N[áa]zov\s+a\s+popis\s+polo[žz]ky|Polo[žz]ka|Popis)[^\n]*\n?\s*([^\n]{20,200}?)(?:\s+\d+\s+(?:ks|kus))/i);
      if (itemMatch) {
        description = itemMatch[1].trim().replace(/\s+/g, ' ');
      }
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
      description,
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
