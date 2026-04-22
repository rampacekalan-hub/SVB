/**
 * AdminSettings — /b/:buildingId/nastavenia
 *
 * Všetky technické akcie, ktoré predtým zašpinili dashboard:
 *   - import bytov z Excelu
 *   - CSV bank import
 *   - PDF aktivačných kódov
 *   - info o budove
 *
 * Cieľ: držať dashboard čistý, admin akcie na jednom mieste pre správcu.
 */
import { useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '../api';
import { EmptyState, Greeting, Section, StatusPill } from '../components/ui';

interface ImportResult {
  created: number;
  skipped: number;
  codesIssued: number;
  errors: Array<{ row: number; unitNumber?: string; message: string }>;
  rows: Array<{ unitNumber: string; activationCode: string }>;
}

interface BankResult {
  matched: number;
  unmatched: number;
  errors: Array<{ row: number; message: string }>;
  unmatchedRows?: Array<any>;
  duplicates?: number;
}

export function AdminSettingsPage({ buildingId }: { buildingId: string }) {
  const [info, setInfo] = useState<any | null>(null);

  useEffect(() => {
    api<any>(`/buildings/${buildingId}`).then(setInfo).catch(() => {});
  }, [buildingId]);

  return (
    <>
      <Greeting firstName="Nastavenia" subtitle="Administratívna zóna — mimo denného prehľadu" />

      {info && (
        <Section title="Budova">
          <div className="card" style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <Info label="Názov" value={info.name} />
              <Info label="Adresa" value={`${info.address}, ${info.zip} ${info.city}`} />
              <Info label="Právna forma" value={info.legalForm ?? '—'} />
              <Info label="IČO" value={info.ico ?? '—'} />
              <Info label="Krajina" value={info.country} />
              <Info label="Počet bytov" value={info.apartments?.length ?? '—'} />
            </div>
          </div>
        </Section>
      )}

      <ImportApartments buildingId={buildingId} />
      <BankImport buildingId={buildingId} />
      <ActivationCodes buildingId={buildingId} />
    </>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--fg-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontWeight: 500, marginTop: 4 }}>{value}</div>
    </div>
  );
}

/* ---------- Import bytov ---------- */

function ImportApartments({ buildingId }: { buildingId: string }) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await apiUpload<ImportResult>(`/buildings/${buildingId}/import-apartments`, file);
      setResult(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <Section title="Import bytov z Excelu">
      <div className="card" style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        <p style={{ margin: '0 0 12px', color: 'var(--fg-muted)' }}>
          Nahrajte <code>.xlsx</code> so zoznamom bytov. Systém vytvorí každý byt a vygeneruje jednorazový
          aktivačný kód pre vlastníka. Akceptované stĺpce:{' '}
          <code>unitNumber, floor, area, ownershipShare</code> (aj slovensky: byt, poschodie, plocha, podiel).
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="ui-btn ui-btn-primary" onClick={() => fileInput.current?.click()} disabled={busy}>
            {busy ? 'Importujem…' : 'Nahrať .xlsx'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <button className="ui-btn ui-btn-ghost" onClick={() => downloadBlob('/buildings/import/template.xlsx', 'domovplus-sablona.xlsx')}>
            Stiahnuť šablónu
          </button>
        </div>
        {err && <p role="alert" style={{ color: 'var(--urgent)', marginTop: 12 }}>{err}</p>}
        {result && (
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatusPill tone="ok">Vytvorených: {result.created}</StatusPill>
            {result.skipped > 0 && <StatusPill>Preskočené (existujú): {result.skipped}</StatusPill>}
            {result.errors.length > 0 && <StatusPill tone="urgent">Chyby: {result.errors.length}</StatusPill>}
          </div>
        )}
        {result && result.errors.length > 0 && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer' }}>Zobraziť chyby ({result.errors.length})</summary>
            <ul style={{ marginTop: 8, color: 'var(--fg-muted)' }}>
              {result.errors.map((e, i) => (
                <li key={i}>Riadok {e.row}: {e.message}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Section>
  );
}

/* ---------- Bank CSV import ---------- */

function BankImport({ buildingId }: { buildingId: string }) {
  const [result, setResult] = useState<BankResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await apiUpload<BankResult>(`/finance/bank-import/${buildingId}`, file);
      setResult(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <Section title="Import bankového výpisu">
      <div className="card" style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        <p style={{ margin: '0 0 12px', color: 'var(--fg-muted)' }}>
          Nahrajte CSV z banky — platby sa automaticky spárujú s faktúrami podľa variabilného symbolu
          (čísla faktúry). Nespárované riadky zobrazíme na manuálne priradenie.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="ui-btn ui-btn-primary" onClick={() => fileInput.current?.click()} disabled={busy}>
            {busy ? 'Importujem…' : 'Nahrať CSV'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </div>
        {err && <p role="alert" style={{ color: 'var(--urgent)', marginTop: 12 }}>{err}</p>}
        {result && (
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatusPill tone="ok">Spárovaných: {result.matched}</StatusPill>
            {result.unmatched > 0 && <StatusPill tone="pending">Nespárovaných: {result.unmatched}</StatusPill>}
            {result.duplicates ? <StatusPill>Duplicity: {result.duplicates}</StatusPill> : null}
            {result.errors.length > 0 && <StatusPill tone="urgent">Chyby: {result.errors.length}</StatusPill>}
          </div>
        )}
      </div>
    </Section>
  );
}

/* ---------- Aktivačné kódy ---------- */

function ActivationCodes({ buildingId }: { buildingId: string }) {
  return (
    <Section title="Aktivačné kódy vlastníkov">
      <div className="card" style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        <p style={{ margin: '0 0 12px', color: 'var(--fg-muted)' }}>
          Vytlačte PDF so zoznamom nevyužitých aktivačných kódov. Rozdajte / vhoďte do schránok.
        </p>
        <button
          className="ui-btn ui-btn-primary"
          onClick={() => downloadBlob(`/buildings/${buildingId}/activation-codes.pdf`, `kody-${buildingId.slice(0, 8)}.pdf`)}
        >
          Stiahnuť PDF
        </button>
      </div>
    </Section>
  );
}

async function downloadBlob(path: string, filename: string) {
  const token = localStorage.getItem('domovplus.accessToken');
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    alert(`Sťahovanie zlyhalo (${res.status})`);
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
