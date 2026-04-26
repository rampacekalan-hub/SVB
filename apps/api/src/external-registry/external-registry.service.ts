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
        // Paralelne: finstat (lokálne má priestor pre IČ DPH, DIČ, adresa, právna forma)
        // + ORSR detail by IČO (registry info, Oddiel + Vložka)
        const [finstat, orsr] = await Promise.all([
          this.lookupRpo(cleaned).catch(() => ({ found: false, source: 'NONE' as const })),
          this.lookupOrsrByIco(cleaned).catch(() => ({ found: false, source: 'NONE' as const })),
        ]);
        result = this.mergeResults(finstat, orsr, cleaned);
      } else {
        // Auto: skúsi SK paralelne, ak nenájde tak CZ
        const [finstat, orsr] = await Promise.all([
          this.lookupRpo(cleaned).catch(() => ({ found: false, source: 'NONE' as const })),
          this.lookupOrsrByIco(cleaned).catch(() => ({ found: false, source: 'NONE' as const })),
        ]);
        result = this.mergeResults(finstat, orsr, cleaned);
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
      // Registry necháme prázdne — ORSR ho vyplní s reálnym Oddielom + Vložkou
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
    const stripped = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    if (stripped.length < 2) return [];

    const listUrl = `https://www.orsr.sk/hladaj_subjekt.asp?OBMENO=${encodeURIComponent(stripped)}&PF=0&SID=0&S=on&R=on`;
    try {
      const res = await fetch(listUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (DomovPlus/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];
      const html = new TextDecoder('windows-1250').decode(await res.arrayBuffer());

      // 1) Vytiahni list mien + vypis IDs
      const matches = Array.from(html.matchAll(
        /<a\s+href="vypis\.asp\?ID=(\d+)&amp;SID=(\d+)&amp;P=0"\s+class\s*=\s*"link"\s+alt="[^"]*"\s+title="[^"]*"[^>]*>([^<]+)<\/a>/gi,
      ));

      type Entry = { id: string; sid: string; name: string };
      const entries: Entry[] = [];
      const seen = new Set<string>();
      for (const m of matches) {
        const name = m[3].trim();
        if (seen.has(name) || /^(aktu[aá]lny|[uú]pln[yý])$/i.test(name)) continue;
        seen.add(name);
        entries.push({ id: m[1], sid: m[2], name });
        if (entries.length >= 6) break;
      }

      // 2) Pre každý výsledok PARALELNE načítame detail a vytiahneme IČO + registry
      const enriched = await Promise.all(entries.map(async (e) => {
        try {
          const detail = await this.fetchOrsrDetail(e.id, e.sid);
          return {
            found: true,
            source: 'RPO_SK' as const,
            ico: detail.ico,
            name: detail.name ?? e.name,
            address: detail.address,
            legalForm: detail.legalForm,
            registry: detail.registry,
            active: detail.active,
          };
        } catch {
          return {
            found: true,
            source: 'RPO_SK' as const,
            name: e.name,
          };
        }
      }));

      return enriched;
    } catch {
      return [];
    }
  }

  /**
   * Vyhľadá v ORSR podľa IČO → načíta detail vypis.asp → vráti všetky polia
   * vrátane "Zápis v registri" (Oddiel + Vložka číslo + súd).
   */
  private async lookupOrsrByIco(ico: string): Promise<RegistryLookupResult> {
    // ORSR má SAMOSTATNÝ endpoint pre IČO search: hladaj_ico.asp
    const listUrl = `https://www.orsr.sk/hladaj_ico.asp?ICO=${ico}&SID=0`;
    const res = await fetch(listUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (DomovPlus/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { found: false, source: 'NONE' };
    const html = new TextDecoder('windows-1250').decode(await res.arrayBuffer());

    // Vytiahni prvý link na vypis.asp?ID=...
    const m = html.match(/<a\s+href="vypis\.asp\?ID=(\d+)&amp;SID=(\d+)&amp;P=0"\s+class\s*=\s*"link"\s+alt="[^"]*"/i);
    if (!m) return { found: false, source: 'NONE' };

    const detail = await this.fetchOrsrDetail(m[1], m[2]);
    if (!detail.ico && !detail.name) return { found: false, source: 'NONE' };

    return {
      found: true,
      source: 'RPO_SK',
      ico: detail.ico ?? ico,
      name: detail.name,
      address: detail.address,
      legalForm: detail.legalForm,
      registry: detail.registry,
      active: detail.active,
    };
  }

  /**
   * Merge dvoch zdrojov (finstat + ORSR) — preferuje neprázdne hodnoty.
   * Ak ani jeden nenašiel firmu, vráti not-found.
   */
  private mergeResults(
    a: RegistryLookupResult,
    b: RegistryLookupResult,
    fallbackIco: string,
  ): RegistryLookupResult {
    if (!a.found && !b.found) return { found: false, source: 'NONE' };
    const pick = <K extends keyof RegistryLookupResult>(k: K): RegistryLookupResult[K] =>
      (a[k] as any) || (b[k] as any);

    return {
      found: true,
      source: a.found ? a.source : b.source,
      ico: pick('ico') ?? fallbackIco,
      name: pick('name'),
      dic: pick('dic'),
      vatId: pick('vatId'),
      legalForm: pick('legalForm'),
      address: pick('address'),
      registry: pick('registry'),
      active: a.active ?? b.active ?? true,
    };
  }

  /** Načíta ORSR vypis page a vytiahne IČO + adresu + meno + právnu formu. */
  private async fetchOrsrDetail(id: string, sid: string) {
    const url = `https://www.orsr.sk/vypis.asp?ID=${id}&SID=${sid}&P=0`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (DomovPlus/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return {};
    const html = new TextDecoder('windows-1250').decode(await res.arrayBuffer());

    // Helper: po riadku <span class="tl">LABEL:&nbsp;</span> nasleduje ďalej hodnota v <span class='ra'>VAL</span>
    // Layout je multi-row table, takže hľadáme prvý span class='ra' po danom labele
    const fieldValue = (label: string): string | undefined => {
      const labelRe = new RegExp(`<span class="tl">${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:&nbsp;</span>`, 'i');
      const labelIdx = html.search(labelRe);
      if (labelIdx < 0) return undefined;
      // Nájdi prvý <span class='ra'>... potom v ďalšom HTML
      const slice = html.slice(labelIdx, labelIdx + 1500);
      const m = slice.match(/<span class=['"]ra['"][^>]*>([^<]+)<\/span>/);
      return m ? m[1].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : undefined;
    };

    // IČO môže byť "  56 908 377 " — strip whitespace
    const icoRaw = fieldValue('IČO');
    const ico = icoRaw?.replace(/\s+/g, '');

    const name = fieldValue('Obchodné meno');

    // Sídlo má viacero čiastkových polí (Ulica, Obec, PSČ) → vytiahnem všetky <span class='ra'> v okolí Sídla
    let address: string | undefined;
    const sidloMatch = html.match(/<span class="tl">Sídlo:&nbsp;<\/span>[\s\S]*?(?=<span class="tl">|<\/table>\s*<\/td>\s*<\/tr>\s*<tr)/i);
    if (sidloMatch) {
      const parts = Array.from(sidloMatch[0].matchAll(/<span class=['"]ra['"][^>]*>([^<]+)<\/span>/g))
        .map((m) => m[1].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
        .filter((s) => s && !s.startsWith('(od:') && !/^\(/.test(s));
      address = parts.length ? parts.join(', ') : undefined;
    }

    const legalForm = fieldValue('Právna forma');

    // Zápis v registri — extrahuj Oddiel + Vložka číslo + Registrový súd
    // Vzor v HTML:
    //   <span class="tl">Oddiel:&nbsp;</span> <span class="ra">Sro</span>
    //   <span class="tl">Vložka číslo:&nbsp;</span> <span class="ra">187159/B </span>
    // + niekedy je v top header "Okresný súd Bratislava III"
    const oddiel = fieldValue('Oddiel');
    const vlozka = fieldValue('Vložka číslo');
    const courtMatch = html.match(/Okresn[ýý]\s+s[úu]d\s+([A-Za-zÁ-žĎ-ž\s]+?)(?:[,<]|\s+v\s+)/i);
    const court = courtMatch?.[1].trim();

    let registry: string | undefined;
    if (oddiel || vlozka) {
      const parts: string[] = [];
      if (court) parts.push(`OS ${court}`);
      if (oddiel) parts.push(`Oddiel ${oddiel}`);
      if (vlozka) parts.push(`Vložka ${vlozka}`);
      registry = parts.join(', ');
    }

    // Aktívnosť — header obsahuje "Stav firmy: Aktívny" / "Stav firmy: V likvidácii" / "Vymazaná"
    const inactive = /v\s+likvid[áa]cii|vymazan[áé]|zaniknut[áé]/i.test(html.slice(0, 5000));

    return { ico, name, address, legalForm, registry, active: !inactive };
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
