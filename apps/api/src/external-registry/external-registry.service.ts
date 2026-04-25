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
  // SK — Finstat.sk scraping (RPO API nemá verejný endpoint).
  // Stránka https://www.finstat.sk/{ICO} obsahuje stabilné HTML
  // s <title>, <meta>, JSON-LD a tabuľkou s DIČ, IČ DPH, adresou.
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

    // 1) Názov firmy z <title>
    const titleMatch = html.match(/<title>([^<]+?)\s*-\s*(?:historický[^<]*-\s*)?(?:zisk|trž|hospod)/i)
      ?? html.match(/<title>([^<]+?)<\/title>/i);
    const name = titleMatch ? this.decodeHtml(titleMatch[1]).trim() : undefined;

    // 2) DIČ — hľadá "DIČ:" alebo "DIČ </td><td>2023456789</td>"
    const dicMatch = html.match(/D[IČ]Č[^\d]{0,40}(\d{10})/i);
    const dic = dicMatch?.[1];

    // 3) IČ DPH — "IČ DPH" / "VAT" + SK + 10 čísiel
    const vatMatch = html.match(/I[ČC]\s*DPH[^A-Z]{0,40}(SK\d{10})/i);
    const vatId = vatMatch?.[1];

    // 4) Adresa — title="Adresa: ..." alebo <div class="address">
    const addrMatch = html.match(/[Aa]dresa[^<]{0,5}<\/td>\s*<td[^>]*>([^<]+)/)
      ?? html.match(/itemprop=["']address["'][^>]*>([^<]+)</);
    const address = addrMatch ? this.decodeHtml(addrMatch[1]).replace(/\s+/g, ' ').trim() : undefined;

    // 5) Právna forma — "Právna forma" + ďalší text
    const lfMatch = html.match(/Pr[áa]vna\s+forma[^<]*<\/td>\s*<td[^>]*>([^<]+)/);
    const legalForm = lfMatch ? this.decodeHtml(lfMatch[1]).trim() : undefined;

    // 6) Status / aktívnosť
    const inactive = /(zrušen|zanikl|likvid)/i.test(html.slice(0, 5000));

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
      registry: legalForm ? `${legalForm}` : undefined,
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

  private async searchRpoName(name: string): Promise<RegistryLookupResult[]> {
    // Finstat search returns HTML — skip pre teraz, vrátime prázdne
    // Predseda zatiaľ musí zadať IČO. Future: parsovanie /search?term=
    return [];
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
