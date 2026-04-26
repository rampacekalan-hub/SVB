/**
 * ExternalRegistryService — auto-fill firemných údajov podľa IČO.
 *
 * SK: Register právnických osôb (RPO) cez statistics.sk
 *     https://rpo.statistics.sk/rpo/v1/legalEntity?identifier=12345678
 *
 * CZ: ARES (Administrativní registr ekonomických subjektů)
 *     https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/12345678
 *
 * Cache: 24 h v pamäti (firemné údaje sa nemenia často).
 */
import { Injectable, Logger } from '@nestjs/common';

export interface RegistryLookupResult {
  found: boolean;
  source: 'RPO_SK' | 'ARES_CZ' | 'NONE';
  ico?: string;
  name?: string;
  dic?: string;
  vatId?: string;
  legalForm?: string; // s.r.o. / a.s. / SVB / BD
  address?: string;
  active?: boolean;
  registry?: string; // zápis v registri (kraj, č.)
  raw?: any; // surová odpoveď pre debugging
}

interface CacheEntry { result: RegistryLookupResult; expiresAt: number; }

@Injectable()
export class ExternalRegistryService {
  private readonly log = new Logger(ExternalRegistryService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 h

  /**
   * Vyhľadanie firmy podľa IČO. Country detekuje podľa IČO formátu (oba SK aj CZ majú 8 číslic),
   * ak country nie je explicitne, skúsi SK najprv, potom CZ.
   */
  async lookup(ico: string, country?: 'SK' | 'CZ'): Promise<RegistryLookupResult> {
    const cleaned = ico.replace(/\s+/g, '');
    if (!/^\d{8}$/.test(cleaned)) {
      return { found: false, source: 'NONE' };
    }
    const cacheKey = `${country ?? 'AUTO'}:${cleaned}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    let result: RegistryLookupResult = { found: false, source: 'NONE' };
    try {
      if (country === 'CZ') {
        result = await this.lookupAres(cleaned);
      } else if (country === 'SK') {
        result = await this.lookupRpo(cleaned);
      } else {
        // Auto: skúsi SK, ak nenájde tak CZ
        result = await this.lookupRpo(cleaned);
        if (!result.found) result = await this.lookupAres(cleaned);
      }
    } catch (err) {
      this.log.warn(`Registry lookup zlyhal pre IČO ${cleaned}: ${(err as Error).message}`);
      result = { found: false, source: 'NONE' };
    }

    this.cache.set(cacheKey, { result, expiresAt: Date.now() + this.TTL_MS });
    return result;
  }

  /**
   * Vyhľadanie podľa názvu firmy — pre prípady, keď user napíše meno a chce IČO.
   * Limit 5 výsledkov (typicky stačí).
   */
  async searchByName(query: string, country: 'SK' | 'CZ' = 'SK'): Promise<RegistryLookupResult[]> {
    if (query.length < 3) return [];
    try {
      if (country === 'CZ') return await this.searchAresName(query);
      return await this.searchRpoName(query);
    } catch (err) {
      this.log.warn(`Registry search zlyhal: ${(err as Error).message}`);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────
  // SK — Finstat.sk scraping. Stránka má stabilný formát:
  //   <li class="inline"><strong>IČO</strong> <span>56908377</span></li>
  //   <li><strong>Sídlo</strong> <span>NAME<br/>STREET PSČ MESTO</span></li>
  // ─────────────────────────────────────────────────────────
  private async lookupRpo(ico: string): Promise<RegistryLookupResult> {
    const url = `https://www.finstat.sk/${ico}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (DomovPlus/1.0; SK business registry lookup)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    if (!res.ok) return { found: false, source: 'NONE' };
    const html = await res.text();
    if (html.includes('Stránka nebola nájdená') || html.includes('nebol n&#xE1;jden')) {
      return { found: false, source: 'NONE' };
    }

    // Helper na vytiahnutie hodnoty z <li><strong>LABEL</strong> <span>HODNOTA</span>...
    const extractField = (label: string): string | undefined => {
      const re = new RegExp(`<strong>${label}<\\/strong>\\s*<span[^>]*>([\\s\\S]*?)<\\/span>`, 'i');
      const m = html.match(re);
      if (!m) return undefined;
      // Nahraď <br/> medzerami, strip ostatné HTML tagy
      return this.decodeHtml(m[1])
        .replace(/<br\s*\/?>/gi, ', ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Názov firmy — z <title> bez sufixu „- zisk, tržby, ...", alebo z prvého <h1>
    let name: string | undefined;
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) name = this.decodeHtml(h1Match[1]).trim();
    if (!name) {
      const titleMatch = html.match(/<title>([^<]+?)\s*-\s*(?:historick[ýy][^<]*-\s*)?(?:zisk|tr[žz]|hospod)/i);
      if (titleMatch) name = this.decodeHtml(titleMatch[1]).trim();
    }

    const dic = extractField('DIČ');
    const vatRaw = extractField('IČ DPH');
    // IČ DPH môže obsahovať "SKxxxxxxxxxx, podľa §7a..." — vytiahni len SK + 10 číslic
    const vatId = vatRaw?.match(/SK\d{10}/)?.[0];

    // Sídlo má formát "ALAN RAMPÁČEK s. r. o., Námestie Martina Benku 6302/10 811 07 Bratislava..."
    // Adresa je za prvou čiarkou (lebo prvá časť je názov firmy)
    const sidlo = extractField('Sídlo');
    let address: string | undefined;
    if (sidlo) {
      const idx = sidlo.indexOf(',');
      address = idx >= 0 ? sidlo.slice(idx + 1).trim() : sidlo.trim();
    }

    // Právna forma — niekedy je v li "Právna forma" alebo extrahuj z mena (s. r. o., a. s.)
    let legalForm = extractField('Právna forma');
    if (!legalForm && name) {
      const lfFromName = name.match(/\b(s\.\s*r\.\s*o\.|a\.\s*s\.|spol\.\s*s\.?\s*r\.\s*o\.|SVB|BD|SVJ|k\.\s*s\.|v\.\s*o\.\s*s\.)/i);
      legalForm = lfFromName?.[0];
    }

    // Status / aktívnosť — pozri či je v hornej časti stránky "v likvidácii", "zrušená"
    const inactive = /(v\s+likvid[áa]cii|zru[šs]en|zanikl|vyma[zý]an[áé])/i.test(html.slice(0, 8000));

    if (!name) return { found: false, source: 'NONE' };

    return {
      found: true,
      source: 'RPO_SK',
      ico,
      name,
      dic,
      vatId,
      legalForm,
      address,
      active: !inactive,
      registry: legalForm,
    };
  }

  private decodeHtml(s: string): string {
    return s
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ');
  }

  /**
   * Search-by-name cez ORSR.sk (Obchodný register SR).
   * ORSR vracia HTML v kódovaní windows-1250, parse-ujeme zoznam linkov vypis.asp.
   * Pre každý nájdený subjekt potrebujeme tiež IČO — to je v detail-e (vypis.asp).
   * Fetch detail-u všetkých výsledkov by bol pomalý, takže vraciame zatiaľ len
   * mená a vypis ID. Frontend môže ponúknuť „Vyhľadať na ORSR" link.
   *
   * Pre presný auto-fill: user musí poskytnúť IČO. Tento search je „discovery".
   */
  private async searchRpoName(query: string): Promise<RegistryLookupResult[]> {
    // ORSR.sk vyžaduje query BEZ DIAKRITIKY — inak vracia 0 výsledkov.
    // Strip diakritiky cez Unicode normalize NFD + odstrániť combining marks.
    const stripped = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // diacritic combining
      .toLowerCase()
      .trim();
    if (stripped.length < 2) return [];
    const url = `https://www.orsr.sk/hladaj_subjekt.asp?OBMENO=${encodeURIComponent(stripped)}&PF=0&SID=0&S=on&R=on`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (DomovPlus/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];
      const buf = await res.arrayBuffer();
      // ORSR vracia windows-1250 — node-fetch dekóduje ako utf-8 a rozbije diakritiku.
      // TextDecoder s 'windows-1250' funguje v Node 20+
      const html = new TextDecoder('windows-1250').decode(buf);

      // Pattern: <a href="vypis.asp?ID=21634&amp;SID=2&amp;P=0" class="link" alt="..." title="...">NAZOV</a>
      // Filter: len výsledky s alt= attribute (tie sú názvy firiem; "Aktuálny"/"Úplný" sú navigačné).
      const matches = Array.from(html.matchAll(
        /<a\s+href="vypis\.asp\?ID=(\d+)&amp;SID=\d+&amp;P=0"\s+class\s*=\s*"link"\s+alt="[^"]*"\s+title="[^"]*"[^>]*>([^<]+)<\/a>/gi,
      ));

      const results: RegistryLookupResult[] = [];
      const seen = new Set<string>();
      for (const m of matches) {
        const name = m[2].trim();
        if (seen.has(name)) continue;
        // Skip generic navigačné texty (defenzíva)
        if (/^(aktu[aá]lny|[uú]pln[yý])$/i.test(name)) continue;
        seen.add(name);
        results.push({
          found: true,
          source: 'RPO_SK',
          name,
          // ORSR vypis.asp?ID je interný ORSR identifikátor, nie IČO.
          // Frontend ponúkne "Otvoriť ORSR" link na detail.
        });
        if (results.length >= 6) break;
      }
      return results;
    } catch {
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────
  // CZ — ARES (api.gov.cz)
  // ─────────────────────────────────────────────────────────
  private async lookupAres(ico: string): Promise<RegistryLookupResult> {
    const url = `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'DomovPlus/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { found: false, source: 'NONE' };
    const r: any = await res.json();
    if (!r || !r.ico) return { found: false, source: 'NONE' };

    return {
      found: true,
      source: 'ARES_CZ',
      ico: r.ico,
      name: r.obchodniJmeno,
      dic: r.dic,
      legalForm: r.pravniForma?.nazev,
      address: this.formatAresAddress(r.sidlo),
      active: r.datumZaniku == null,
      registry: r.icoOver === undefined ? undefined : `Ares · ${r.pravniForma?.nazev ?? ''}`.trim(),
      raw: r,
    };
  }

  private formatAresAddress(s: any): string | undefined {
    if (!s) return undefined;
    const parts = [
      [s.nazevUlice, s.cisloDomovni].filter(Boolean).join(' '),
      [s.psc, s.nazevObce].filter(Boolean).join(' '),
    ].filter((p) => p && p.trim().length > 0);
    return parts.length ? parts.join(', ') : undefined;
  }

  private async searchAresName(name: string): Promise<RegistryLookupResult[]> {
    const url = `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat?obchodniJmeno=${encodeURIComponent(name)}&start=0&pocet=5`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ obchodniJmeno: name, start: 0, pocet: 5 }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    if (!res || !res.ok) return [];
    const data: any = await res.json();
    return (data.ekonomickeSubjekty ?? []).slice(0, 5).map((r: any) => ({
      found: true,
      source: 'ARES_CZ' as const,
      ico: r.ico,
      name: r.obchodniJmeno,
      address: this.formatAresAddress(r.sidlo),
      active: r.datumZaniku == null,
    }));
  }
}
