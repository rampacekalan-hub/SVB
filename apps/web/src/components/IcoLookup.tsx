/**
 * IcoLookupHint — vizuálny widget pod IČO políčkom.
 *
 * Zobrazuje stav vyhľadávania v RPO (SK) / ARES (CZ) a tlačidlo „Použiť údaje"
 * ktoré po kliknutí vyplní formulár podľa registra.
 *
 *   <IcoLookupHint
 *     ico={form.ico}
 *     country="SK"
 *     onApply={(data) => setForm({ ...form, ...mappedFields })}
 *     applied={someFlag}  // skryť tlačidlo Použiť, ak už máme dáta
 *   />
 */
import { LookupState, RegistryResult, useIcoLookup } from '../hooks/useIcoLookup';

interface Props {
  ico: string;
  country?: 'SK' | 'CZ';
  onApply: (data: RegistryResult) => void;
  applied?: boolean;
  /** Ak false, hint sa nespúšťa (napr. hodnota je už uložená a nezmenená). */
  enabled?: boolean;
}

export function IcoLookupHint({ ico, country = 'SK', onApply, applied, enabled = true }: Props) {
  const { state, result } = useIcoLookup(ico, country, enabled);

  if (state === 'idle') return null;

  return (
    <div className={`ico-hint ico-hint-${state}`}>
      {state === 'searching' && (
        <>
          <span className="ico-hint-spinner" />
          <span>Vyhľadávam v {country === 'CZ' ? 'ARES (ČR)' : 'RPO (SR)'}…</span>
        </>
      )}

      {state === 'notFound' && (
        <>
          <span className="ico-hint-icon">⚠️</span>
          <span>IČO sa nenašlo v {country === 'CZ' ? 'ARES' : 'RPO'} — zadajte údaje ručne.</span>
        </>
      )}

      {state === 'error' && (
        <>
          <span className="ico-hint-icon">⚠️</span>
          <span>Register nedostupný — skúste neskôr alebo zadajte ručne.</span>
        </>
      )}

      {state === 'found' && result && (
        <>
          <span className="ico-hint-icon">✓</span>
          <div className="ico-hint-body">
            <div className="ico-hint-title">
              {result.name}
              {result.active === false && <span className="ico-hint-inactive"> · neaktívny</span>}
            </div>
            <div className="ico-hint-sub">
              {result.address && <>{result.address}</>}
              {result.dic && <> · DIČ {result.dic}</>}
            </div>
            <div className="ico-hint-source">
              Zdroj: {result.source === 'ARES_CZ' ? 'ARES (ČR)' : 'RPO (SR)'}
            </div>
          </div>
          {!applied && (
            <button
              type="button"
              className="ico-hint-apply"
              onClick={() => onApply(result)}
            >
              Použiť údaje →
            </button>
          )}
          {applied && <span className="ico-hint-applied">Použité</span>}
        </>
      )}
    </div>
  );
}
