/**
 * CompanyNameSearch — autocomplete vyhľadávanie firmy podľa názvu.
 *
 * Volá GET /external-registry/search?q=...&country=SK
 * Zdroj SK: ORSR.sk (vracia mená, ale nie IČO — preto klik otvorí ORSR detail
 * v novom okne, kde user nájde IČO a vráti sa).
 *
 * Pre rýchle priradenie odporúčame zadávať IČO priamo (auto-fill cez RPO).
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

export interface NameSearchResult {
  ico?: string;
  name?: string;
  dic?: string;
  vatId?: string;
  address?: string;
  legalForm?: string;
  registry?: string;
  source: 'RPO_SK' | 'ARES_CZ' | 'NONE';
}

interface Props {
  query: string;
  country?: 'SK' | 'CZ';
  onPick: (result: NameSearchResult) => void;
}

export function CompanyNameSearch({ query, country = 'SK', onPick }: Props) {
  const [results, setResults] = useState<NameSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const lastQuery = useRef('');

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    timer.current = window.setTimeout(async () => {
      lastQuery.current = query;
      try {
        const r = await api<NameSearchResult[]>(
          `/external-registry/search?q=${encodeURIComponent(query)}&country=${country}`,
        );
        if (lastQuery.current === query) setResults(r);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 700);
  }, [query, country]);

  if (!open || query.trim().length < 3) return null;

  const orsrUrl = `https://www.orsr.sk/hladaj_subjekt.asp?OBMENO=${encodeURIComponent(query)}&PF=0&SID=0&S=on&R=on`;

  return (
    <div className="cns">
      {loading && (
        <div className="cns-row cns-loading">
          <span className="ico-hint-spinner" /> Vyhľadávam v {country === 'CZ' ? 'ARES' : 'ORSR'}…
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="cns-row cns-empty">
          Nenašiel som výsledky.{' '}
          <a href={orsrUrl} target="_blank" rel="noreferrer">Otvoriť ORSR.sk →</a>
        </div>
      )}

      {!loading && results.map((r, i) => (
        <button
          key={i}
          type="button"
          className="cns-row cns-result"
          onClick={async () => {
            setOpen(false);
            // Ak máme IČO, ešte raz zavoláme lookup pre full enrich (DIČ, IČ DPH, registry)
            if (r.ico) {
              try {
                const enriched = await api<NameSearchResult & { dic?: string; vatId?: string; legalForm?: string; registry?: string }>(
                  `/external-registry/lookup?ico=${r.ico}&country=${country}`,
                );
                onPick({ ...r, ...enriched });
                return;
              } catch { /* fallback na základné dáta */ }
            }
            onPick(r);
          }}
        >
          <div>
            <strong>{r.name}</strong>
            {r.ico && <span className="cns-ico"> · IČO {r.ico}</span>}
            {r.address && <div className="cns-addr">{r.address}</div>}
          </div>
          <span className="cns-arrow">→</span>
        </button>
      ))}

      {!loading && results.length > 0 && (
        <a href={orsrUrl} target="_blank" rel="noreferrer" className="cns-more">
          Viac výsledkov na ORSR.sk →
        </a>
      )}
    </div>
  );
}
