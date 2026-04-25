/**
 * useIcoLookup — debounced auto-fill firmy podľa IČO.
 *
 * Používa sa v formulároch (Supplier, BillingSettings).
 * Po napísaní 8-ciferného IČO sa po 600ms automaticky volá backend
 * (RPO pre SK, ARES pre CZ) a vráti údaje.
 *
 * UI signalizuje stav: idle | searching | found | notFound | error
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

export interface RegistryResult {
  found: boolean;
  source: 'RPO_SK' | 'ARES_CZ' | 'NONE';
  ico?: string;
  name?: string;
  dic?: string;
  vatId?: string;
  legalForm?: string;
  address?: string;
  active?: boolean;
  registry?: string;
}

export type LookupState = 'idle' | 'searching' | 'found' | 'notFound' | 'error';

export function useIcoLookup(ico: string, country: 'SK' | 'CZ' = 'SK') {
  const [state, setState] = useState<LookupState>('idle');
  const [result, setResult] = useState<RegistryResult | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const cleaned = ico.replace(/\s+/g, '');
    if (!/^\d{8}$/.test(cleaned)) {
      setState('idle');
      setResult(null);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setState('searching');
    timeoutRef.current = window.setTimeout(async () => {
      try {
        const r = await api<RegistryResult>(`/external-registry/lookup?ico=${cleaned}&country=${country}`);
        setResult(r);
        setState(r.found ? 'found' : 'notFound');
      } catch {
        setState('error');
        setResult(null);
      }
    }, 600);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [ico, country]);

  return { state, result };
}
